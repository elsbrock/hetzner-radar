/**
 * Analytics Query Service
 *
 * Handles querying Cloudflare Analytics Engine for historical cloud availability data
 */

/**
 * Envelope returned by the Analytics Engine SQL API.
 *
 * `fetch(...).json()` is typed `unknown`, so the shape has to be stated
 * somewhere; stating it once here beats asserting at each access site.
 */
interface AnalyticsEngineResponse<Row> {
	success: boolean;
	errors?: unknown;
	data?: Row[];
}

/** Row shape of the availability summary query (`blob1`/`blob2` are AE blob columns). */
interface AnalyticsSummaryRow {
	blob1: string;
	blob2: string;
	availableDataPoints: number;
	totalDataPoints: number;
}

interface AnalyticsQueryOptions {
	startDate: string; // ISO date string
	endDate: string; // ISO date string
	serverTypeId?: number;
	locationId?: number;
	/**
	 * Accepted for API compatibility but no longer used. The dataset holds
	 * *transitions*, not samples, so bucketing them destroys the very ordering a
	 * consumer needs to rebuild the availability step function — see
	 * `queryAvailabilityHistory`.
	 */
	granularity?: 'hour' | 'day' | 'week';
}

/** Raw transition row as returned by the events query. */
interface AnalyticsEventRow {
	timestamp: string;
	blob1: string;
	blob2: string;
	blob4?: string;
	blob5?: string;
	double1: number;
}

/** One row per (server type × location) carrying the state entering the window. */
interface AnalyticsSeedRow {
	blob1: string;
	blob2: string;
	serverTypeName?: string;
	locationName?: string;
	availability: number;
}

interface AvailabilityDataPoint {
	timestamp: string;
	serverTypeId: number;
	locationId: number;
	serverTypeName: string;
	locationName: string;
	available: boolean;
	availabilityRate?: number; // For aggregated data
	/**
	 * True for the synthetic point that carries the state in effect at
	 * `startDate` (the last real transition *before* the window). Consumers seed
	 * their step function from it instead of guessing.
	 */
	seed?: boolean;
}

/**
 * Upper bound on transition rows returned for a single history query.
 *
 * The dataset holds transitions only (~a handful per pair per day), so a 30d
 * window for one location stays far below this. The cap exists so a pathological
 * flapping period can't return an unbounded result set.
 */
const MAX_EVENT_ROWS = 10000;

/**
 * How far back to look for the transition that established the state entering
 * the window.
 *
 * This is Analytics Engine's full retention, deliberately: a scarce pair can sit
 * in one state for months, and a shorter lookback silently reports "no seed" for
 * exactly those pairs. At 30 days, cax21/fsn1 — unavailable since 2026-05-26 —
 * produced no seed for a 30-day window, and the client fell back to the live
 * snapshot and painted the whole month available (#287).
 *
 * Retention is documented as "three months" rather than a day count, so 92 is
 * the longest three consecutive calendar months (31 + 31 + 30) and never falls
 * short of it. Scanning past retention costs nothing — there are no rows there —
 * and the query is aggregated to one row per pair, so neither the response nor
 * the bill grows with the range. Analytics Engine bills per query, not per row.
 *
 * A pair whose last change predates retention still yields no row; the client
 * resolves that case from the window's own first transition instead.
 */
const SEED_LOOKBACK_MS = 92 * 24 * 60 * 60 * 1000;

export class AnalyticsQueryService {
	constructor() {
		// Analytics Engine access is provided via worker bindings
		// No authentication needed when using bindings
	}

	/**
	 * Fetch the availability transition history for a window.
	 *
	 * `cloud_availability_v2` records *state changes only* (see
	 * NotificationService.writeToAnalyticsEngine), so the result is a sparse edge
	 * stream, not a sample stream. Two consequences drive this implementation:
	 *
	 * 1. **No time bucketing.** Aggregating edges per hour with `MAX(double1)`
	 *    silently discards the "went unavailable" edge of any pair that flipped
	 *    twice inside one bucket, so a short availability blip renders as
	 *    "available ever since". Raw rows with their true timestamps are returned
	 *    instead.
	 * 2. **An explicit seed.** The state entering the window comes from outside
	 *    it, so a second query resolves the last transition *before* `startDate`
	 *    per pair and returns it as a synthetic point stamped at `startDate` with
	 *    `seed: true`. It looks back across the whole retention window, since a
	 *    scarce pair can hold one state for months.
	 */
	async queryAvailabilityHistory(
		options: AnalyticsQueryOptions,
		env: { ANALYTICS_ENGINE: AnalyticsEngineDataset; CF_ACCOUNT_ID?: string; CF_BEARER_TOKEN?: string },
	): Promise<AvailabilityDataPoint[]> {
		const { startDate, endDate, serverTypeId, locationId } = options;

		// For now, we need to use the SQL API directly as the binding doesn't support SQL queries yet
		// This requires CF_ACCOUNT_ID and CF_BEARER_TOKEN environment variables
		if (!env.CF_ACCOUNT_ID || !env.CF_BEARER_TOKEN) {
			console.warn('[AnalyticsQueryService] Analytics Engine SQL API requires CF_ACCOUNT_ID and CF_BEARER_TOKEN environment variables');
			console.warn('[AnalyticsQueryService] CF_ACCOUNT_ID:', env.CF_ACCOUNT_ID ? 'Set' : 'Missing');
			console.warn('[AnalyticsQueryService] CF_BEARER_TOKEN:', env.CF_BEARER_TOKEN ? 'Set' : 'Missing');
			// Return empty array for now until SQL API support is added to bindings
			return [];
		}

		const credentials = { accountId: env.CF_ACCOUNT_ID, bearerToken: env.CF_BEARER_TOKEN };

		// Independent queries — issue them together rather than paying two
		// sequential round trips on every chart render.
		const [seedRows, eventRows] = await Promise.all([
			this.runQuery<AnalyticsSeedRow>(this.buildSeedQuery(startDate, serverTypeId, locationId), credentials),
			this.runQuery<AnalyticsEventRow>(this.buildEventsQuery(startDate, endDate, serverTypeId, locationId), credentials),
		]);

		if (eventRows.length >= MAX_EVENT_ROWS) {
			console.warn(`[AnalyticsQueryService] Event query hit the ${MAX_EVENT_ROWS} row cap; history may be truncated`);
		}

		return [...this.transformSeedRows(seedRows, startDate), ...this.transformEventRows(eventRows)];
	}

	/** POST a statement to the AE SQL API and return its `data` rows. */
	private async runQuery<Row>(sql: string, credentials: { accountId: string; bearerToken: string }): Promise<Row[]> {
		console.log('[AnalyticsQueryService] Executing SQL query:', sql);

		try {
			// The API expects the SQL query as plain text in the body.
			const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/analytics_engine/sql`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${credentials.bearerToken}`,
				},
				body: sql,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Analytics Engine query failed: ${response.status} ${response.statusText} - ${errorText}`);
			}

			const responseText = await response.text();

			let result;
			try {
				result = JSON.parse(responseText);
			} catch (parseError) {
				console.error('[AnalyticsQueryService] Failed to parse response:', responseText);
				throw new Error(`Failed to parse Analytics Engine response: ${parseError}`, { cause: parseError });
			}

			// AE returns `{ meta, data, rows }`; `rows` is a count, so only `data`
			// (or a bare array) is a usable row set.
			const data = Array.isArray(result) ? result : result?.data;

			if (!Array.isArray(data)) {
				console.error('[AnalyticsQueryService] Unexpected response format:', result);
				return [];
			}

			return data as Row[];
		} catch (error) {
			console.error('[AnalyticsQueryService] Query failed:', error);
			throw error;
		}
	}

	/**
	 * Format an ISO date string for Cloudflare Analytics Engine's toDateTime().
	 * Strips milliseconds and trailing 'Z' since AE only accepts
	 * 'YYYY-MM-DD HH:MM:SS' or 'YYYY-MM-DDTHH:MM:SS'.
	 */
	private formatDateForAE(isoDate: string): string {
		return isoDate.replace(/\.\d{3}Z$/, '').replace(/Z$/, '');
	}

	/** Narrow to a server type and/or location; both are stored as string blobs. */
	private buildPairFilters(serverTypeId?: number, locationId?: number): string[] {
		const filters: string[] = [];

		if (serverTypeId !== undefined) {
			filters.push(`blob1 = '${serverTypeId}'`);
		}

		if (locationId !== undefined) {
			filters.push(`blob2 = '${locationId}'`);
		}

		return filters;
	}

	/**
	 * Every transition inside the window, oldest first, at full resolution.
	 * Ascending order matters: consumers replay these as a step function, and the
	 * row cap must truncate the *oldest* history rather than the newest.
	 */
	private buildEventsQuery(startDate: string, endDate: string, serverTypeId?: number, locationId?: number): string {
		const whereConditions = [
			`timestamp >= toDateTime('${this.formatDateForAE(startDate)}')`,
			`timestamp <= toDateTime('${this.formatDateForAE(endDate)}')`,
			...this.buildPairFilters(serverTypeId, locationId),
		];

		return `SELECT timestamp, blob1, blob2, blob4, blob5, double1 FROM cloud_availability_v2 WHERE ${whereConditions.join(
			' AND ',
		)} ORDER BY timestamp ASC LIMIT ${MAX_EVENT_ROWS}`;
	}

	/**
	 * The last transition before the window per (server type × location), which is
	 * the state the window opens in. `argMax(…, timestamp)` collapses each pair to
	 * its most recent row, so this returns one row per pair regardless of how
	 * heavily it flapped.
	 *
	 * A pair that has not changed state within `SEED_LOOKBACK_MS` yields no row;
	 * that is not a gap but the definition of a stable pair, and the caller's live
	 * snapshot already holds the answer.
	 */
	private buildSeedQuery(startDate: string, serverTypeId?: number, locationId?: number): string {
		const seedStart = new Date(new Date(startDate).getTime() - SEED_LOOKBACK_MS).toISOString();
		const whereConditions = [
			`timestamp >= toDateTime('${this.formatDateForAE(seedStart)}')`,
			`timestamp < toDateTime('${this.formatDateForAE(startDate)}')`,
			...this.buildPairFilters(serverTypeId, locationId),
		];

		return `SELECT blob1, blob2, argMax(blob4, timestamp) as serverTypeName, argMax(blob5, timestamp) as locationName, argMax(double1, timestamp) as availability FROM cloud_availability_v2 WHERE ${whereConditions.join(
			' AND ',
		)} GROUP BY blob1, blob2`;
	}

	private transformEventRows(rows: AnalyticsEventRow[]): AvailabilityDataPoint[] {
		return rows.map((row) => ({
			timestamp: row.timestamp,
			serverTypeId: parseInt(row.blob1),
			locationId: parseInt(row.blob2),
			serverTypeName: row.blob4 || `Server ${row.blob1}`,
			locationName: row.blob5 || `Location ${row.blob2}`,
			available: Number(row.double1) === 1,
			availabilityRate: Number(row.double1),
		}));
	}

	/**
	 * Restamp each seed to the window start — its real timestamp lies outside the
	 * window and would place the transition where nothing can render it.
	 */
	private transformSeedRows(rows: AnalyticsSeedRow[], startDate: string): AvailabilityDataPoint[] {
		return rows.map((row) => ({
			timestamp: startDate,
			serverTypeId: parseInt(row.blob1),
			locationId: parseInt(row.blob2),
			serverTypeName: row.serverTypeName || `Server ${row.blob1}`,
			locationName: row.locationName || `Location ${row.blob2}`,
			available: Number(row.availability) === 1,
			availabilityRate: Number(row.availability),
			seed: true,
		}));
	}

	/**
	 * Get availability summary for a specific period
	 */
	async getAvailabilitySummary(
		startDate: string,
		endDate: string,
		env: { ANALYTICS_ENGINE: AnalyticsEngineDataset; CF_ACCOUNT_ID?: string; CF_BEARER_TOKEN?: string },
	): Promise<
		{
			serverTypeId: number;
			locationId: number;
			availabilityPercentage: number;
			totalHours: number;
			availableHours: number;
		}[]
	> {
		// For now, we need to use the SQL API directly
		if (!env.CF_ACCOUNT_ID || !env.CF_BEARER_TOKEN) {
			console.warn('[AnalyticsQueryService] Analytics Engine SQL API requires CF_ACCOUNT_ID and CF_BEARER_TOKEN');
			return [];
		}

		const formattedStart = this.formatDateForAE(startDate);
		const formattedEnd = this.formatDateForAE(endDate);
		const sql = `
			SELECT
				blob1,
				blob2,
				COUNT(*) as totalDataPoints,
				SUM(double1) as availableDataPoints
			FROM cloud_availability_v2
			WHERE timestamp >= toDateTime('${formattedStart}')
				AND timestamp <= toDateTime('${formattedEnd}')
			GROUP BY blob1, blob2
		`;

		try {
			const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.CF_BEARER_TOKEN}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ query: sql }),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Analytics Engine query failed: ${response.status} - ${errorText}`);
			}

			// `response.json()` is `unknown`; state the envelope so `success`, `errors`
			// and `data` are real properties rather than accesses on `unknown`.
			const result = (await response.json()) as AnalyticsEngineResponse<AnalyticsSummaryRow>;

			if (!result.success) {
				throw new Error(`Analytics Engine query error: ${JSON.stringify(result.errors)}`);
			}

			return (result.data ?? []).map((row) => {
				const typedRow = row;
				return {
					serverTypeId: parseInt(typedRow.blob1),
					locationId: parseInt(typedRow.blob2),
					availabilityPercentage: (typedRow.availableDataPoints / typedRow.totalDataPoints) * 100,
					totalHours: typedRow.totalDataPoints,
					availableHours: typedRow.availableDataPoints,
				};
			});
		} catch (error) {
			console.error('[AnalyticsQueryService] Summary query failed:', error);
			throw error;
		}
	}
}
