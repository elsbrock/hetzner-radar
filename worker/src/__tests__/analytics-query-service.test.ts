/**
 * Tests for AnalyticsQueryService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsQueryService } from '../analytics-query-service';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const env = {
	ANALYTICS_ENGINE: {} as AnalyticsEngineDataset,
	CF_ACCOUNT_ID: 'test-account',
	CF_BEARER_TOKEN: 'test-token',
};

/** The SQL text of the nth call, in issue order (seed first, then events). */
function sqlOfCall(index: number): string {
	return mockFetch.mock.calls[index][1].body as string;
}

/** Both statements are issued concurrently; find each by its shape. */
function seedSql(): string {
	return [sqlOfCall(0), sqlOfCall(1)].find((s) => s.includes('argMax')) as string;
}

function eventsSql(): string {
	return [sqlOfCall(0), sqlOfCall(1)].find((s) => !s.includes('argMax')) as string;
}

/** Queue the seed and events responses in the order the service issues them. */
function respondWith(seedRows: unknown[], eventRows: unknown[]) {
	mockFetch.mockImplementation((_url: string, init: { body: string }) => {
		const rows = init.body.includes('argMax') ? seedRows : eventRows;
		return Promise.resolve({
			ok: true,
			status: 200,
			statusText: 'OK',
			text: () => Promise.resolve(JSON.stringify({ meta: [], data: rows, rows: rows.length })),
		});
	});
}

describe('AnalyticsQueryService', () => {
	let service: AnalyticsQueryService;

	beforeEach(() => {
		service = new AnalyticsQueryService();
		vi.clearAllMocks();
	});

	describe('queryAvailabilityHistory', () => {
		const options = {
			startDate: '2026-07-01T00:00:00.000Z',
			endDate: '2026-07-02T00:00:00.000Z',
			serverTypeId: 45,
			locationId: 3,
		};

		it('should return an empty array without SQL API credentials', async () => {
			const result = await service.queryAvailabilityHistory(options, {
				ANALYTICS_ENGINE: {} as AnalyticsEngineDataset,
			});

			expect(result).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('should query raw transitions without time bucketing', async () => {
			respondWith([], []);

			await service.queryAvailabilityHistory(options, env);

			const sql = eventsSql();
			// Bucketing edges with MAX() erased the "went unavailable" edge of any
			// pair that flipped twice within one bucket — see issue #286.
			expect(sql).not.toContain('toStartOfInterval');
			expect(sql).not.toContain('MAX(double1)');
			expect(sql).not.toContain('GROUP BY');
			expect(sql).toContain('SELECT timestamp, blob1, blob2, blob4, blob5, double1');
			// Ascending, so a row cap truncates the oldest history rather than the newest.
			expect(sql).toContain('ORDER BY timestamp ASC');
			expect(sql).toContain('LIMIT 10000');
		});

		it('should narrow both queries to the requested pair', async () => {
			respondWith([], []);

			await service.queryAvailabilityHistory(options, env);

			for (const sql of [seedSql(), eventsSql()]) {
				expect(sql).toContain("blob1 = '45'");
				expect(sql).toContain("blob2 = '3'");
			}
		});

		it('should resolve the seed from the last transition before the window', async () => {
			respondWith([], []);

			await service.queryAvailabilityHistory(options, env);

			const sql = seedSql();
			expect(sql).toContain('argMax(double1, timestamp) as availability');
			expect(sql).toContain('GROUP BY blob1, blob2');
			// Strictly before the window start, looking back 92 days (Analytics Engine's retention).
			expect(sql).toContain("timestamp < toDateTime('2026-07-01T00:00:00')");
			expect(sql).toContain("timestamp >= toDateTime('2026-03-31T00:00:00')");
		});

		it('should mark seed points and stamp them at the window start', async () => {
			respondWith([{ blob1: '45', blob2: '3', serverTypeName: 'cx23', locationName: 'hel1', availability: 1 }], []);

			const result = await service.queryAvailabilityHistory(options, env);

			expect(result).toEqual([
				{
					timestamp: options.startDate,
					serverTypeId: 45,
					locationId: 3,
					serverTypeName: 'cx23',
					locationName: 'hel1',
					available: true,
					availabilityRate: 1,
					seed: true,
				},
			]);
		});

		it('should preserve both edges of a sub-hour availability blip', async () => {
			// The exact shape that produced issue #286: stock appears and disappears
			// inside one hour. Under hourly MAX() the second edge vanished and the
			// chart painted "available" from then on.
			respondWith(
				[{ blob1: '45', blob2: '3', serverTypeName: 'cx23', locationName: 'hel1', availability: 0 }],
				[
					{ timestamp: '2026-07-01 05:05:00', blob1: '45', blob2: '3', blob4: 'cx23', blob5: 'hel1', double1: 1 },
					{ timestamp: '2026-07-01 05:40:00', blob1: '45', blob2: '3', blob4: 'cx23', blob5: 'hel1', double1: 0 },
				],
			);

			const result = await service.queryAvailabilityHistory(options, env);

			expect(result).toHaveLength(3);
			expect(result[0].seed).toBe(true);
			expect(result[0].available).toBe(false);
			// Distinct timestamps, both edges intact, in chronological order.
			expect(result[1]).toMatchObject({ timestamp: '2026-07-01 05:05:00', available: true });
			expect(result[2]).toMatchObject({ timestamp: '2026-07-01 05:40:00', available: false });
		});

		it('should fall back to blob-derived names when labels are absent', async () => {
			respondWith([], [{ timestamp: '2026-07-01 05:05:00', blob1: '45', blob2: '3', double1: 0 }]);

			const result = await service.queryAvailabilityHistory(options, env);

			expect(result[0]).toMatchObject({
				serverTypeName: 'Server 45',
				locationName: 'Location 3',
				available: false,
				availabilityRate: 0,
			});
		});

		it('should omit pair filters when querying every pair', async () => {
			respondWith([], []);

			await service.queryAvailabilityHistory({ startDate: options.startDate, endDate: options.endDate }, env);

			for (const sql of [seedSql(), eventsSql()]) {
				expect(sql).not.toContain('blob1 =');
				expect(sql).not.toContain('blob2 =');
			}
		});

		it('should throw when the SQL API rejects a query', async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				text: () => Promise.resolve('bad query'),
			});

			await expect(service.queryAvailabilityHistory(options, env)).rejects.toThrow('Analytics Engine query failed: 400');
		});

		it('should return an empty row set on an unexpected response shape', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: () => Promise.resolve(JSON.stringify({ meta: [], rows: 0 })),
			});

			await expect(service.queryAvailabilityHistory(options, env)).resolves.toEqual([]);
		});
	});
});
