/**
 * Analytics Query Service
 *
 * Handles querying Cloudflare Analytics Engine for historical cloud availability data
 */

interface AnalyticsQueryOptions {
	startDate: string; // ISO date string
	endDate: string; // ISO date string
	serverTypeId?: number;
	locationId?: number;
	granularity?: 'hour' | 'day' | 'week';
}

interface AvailabilityDataPoint {
	timestamp: string;
	serverTypeId: number;
	locationId: number;
	serverTypeName: string;
	locationName: string;
	available: boolean;
	availabilityRate?: number; // For aggregated data
}

export class AnalyticsQueryService {
	constructor() {
		// Analytics Engine access is provided via worker bindings
		// No authentication needed when using bindings
	}

	async queryAvailabilityHistory(
		options: AnalyticsQueryOptions,
		env: { ANALYTICS_ENGINE: AnalyticsEngineDataset; CF_ACCOUNT_ID?: string; CF_BEARER_TOKEN?: string },
	): Promise<AvailabilityDataPoint[]> {
		const { startDate, endDate, serverTypeId, locationId, granularity = 'hour' } = options;

		// For now, we need to use the SQL API directly as the binding doesn't support SQL queries yet
		// This requires CF_ACCOUNT_ID and CF_BEARER_TOKEN environment variables
		if (!env.CF_ACCOUNT_ID || !env.CF_BEARER_TOKEN) {
			console.warn('[AnalyticsQueryService] Analytics Engine SQL API requires CF_ACCOUNT_ID and CF_BEARER_TOKEN environment variables');
			console.warn('[AnalyticsQueryService] CF_ACCOUNT_ID:', env.CF_ACCOUNT_ID ? 'Set' : 'Missing');
			console.warn('[AnalyticsQueryService] CF_BEARER_TOKEN:', env.CF_BEARER_TOKEN ? 'Set' : 'Missing');
			// Return empty array for now until SQL API support is added to bindings
			return [];
		}

		// Build SQL query based on options
		const sql = this.buildQuery(startDate, endDate, serverTypeId, locationId, granularity, env);

		console.log('[AnalyticsQueryService] Executing SQL query:', sql);

		try {
			// Execute query via Analytics Engine SQL API
			// The API expects the SQL query as plain text in the body
			console.log('[AnalyticsQueryService] Sending SQL query as plain text to API');

			const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.CF_BEARER_TOKEN}`,
				},
				body: sql,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Analytics Engine query failed: ${response.status} ${response.statusText} - ${errorText}`);
			}

			const responseText = await response.text();
			console.log('[AnalyticsQueryService] Response received, parsing results');

			// Parse the response - Analytics Engine SQL API returns JSON
			let result;
			try {
				result = JSON.parse(responseText);
			} catch (parseError) {
				console.error('[AnalyticsQueryService] Failed to parse response:', responseText);
				throw new Error(`Failed to parse Analytics Engine response: ${parseError}`);
			}

			// The response format may vary, let's handle different cases
			const data = result.data || result.rows || result;

			if (!Array.isArray(data)) {
				console.error('[AnalyticsQueryService] Unexpected response format:', result);
				return [];
			}

			// Transform the raw results into our data structure
			return this.transformResults(data);
		} catch (error) {
			console.error('[AnalyticsQueryService] Query failed:', error);
			throw error;
		}
	}

	private buildQuery(
		startDate: string,
		endDate: string,
		serverTypeId?: number,
		locationId?: number,
		granularity: 'hour' | 'day' | 'week' = 'hour',
		env?: { CF_ACCOUNT_ID?: string },
	): string {
		// Base query components
		const timeFormat = this.getTimeFormat(granularity);
		const whereConditions: string[] = [
			`timestamp >= toDateTime('${startDate}')`,
			`timestamp <= toDateTime('${endDate}')`,
			`blob3 = 'available'`, // eventType = 'available'
		];

		if (serverTypeId !== undefined) {
			whereConditions.push(`blob1 = '${serverTypeId}'`);
		}

		if (locationId !== undefined) {
			whereConditions.push(`blob2 = '${locationId}'`);
		}

		// Build the SQL query
		// Use the dataset name as configured in wrangler.jsonc
		const sql = `SELECT ${timeFormat} as time_bucket, blob1 as serverTypeId, blob2 as locationId, blob4 as serverTypeName, blob5 as locationName, MAX(double1) as availability FROM cloud_availability_v2 WHERE ${whereConditions.join(' AND ')} GROUP BY time_bucket, blob1, blob2, blob4, blob5 ORDER BY time_bucket DESC, blob1, blob2`;

		return sql.trim();
	}

	private getTimeFormat(granularity: 'hour' | 'day' | 'week'): string {
		// Use Analytics Engine's toStartOfInterval function
		switch (granularity) {
			case 'hour':
				return "toStartOfInterval(timestamp, INTERVAL '1' HOUR)";
			case 'day':
				return "toStartOfInterval(timestamp, INTERVAL '1' DAY)";
			case 'week':
				return "toStartOfInterval(timestamp, INTERVAL '1' WEEK)";
			default:
				return "toStartOfInterval(timestamp, INTERVAL '1' HOUR)";
		}
	}

	private transformResults(rawData: any[]): AvailabilityDataPoint[] {
		return rawData.map((row) => ({
			timestamp: row.time_bucket,
			serverTypeId: parseInt(row.serverTypeId),
			locationId: parseInt(row.locationId),
			serverTypeName: row.serverTypeName || `Server ${row.serverTypeId}`,
			locationName: row.locationName || `Location ${row.locationId}`,
			available: row.availability === 1,
			availabilityRate: row.availability,
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

		const sql = `
			SELECT 
				blob1 as serverTypeId,
				blob2 as locationId,
				COUNT(*) as totalDataPoints,
				SUM(double1) as availableDataPoints
			FROM cloud_availability_v2
			WHERE timestamp >= toDateTime('${startDate}')
				AND timestamp <= toDateTime('${endDate}')
				AND blob3 = 'available'
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

			const result = await response.json();

			if (!result.success) {
				throw new Error(`Analytics Engine query error: ${JSON.stringify(result.errors)}`);
			}

			return result.data.map((row: any) => ({
				serverTypeId: parseInt(row.serverTypeId),
				locationId: parseInt(row.locationId),
				availabilityPercentage: (row.availableDataPoints / row.totalDataPoints) * 100,
				totalHours: row.totalDataPoints,
				availableHours: row.availableDataPoints,
			}));
		} catch (error) {
			console.error('[AnalyticsQueryService] Summary query failed:', error);
			throw error;
		}
	}
}
