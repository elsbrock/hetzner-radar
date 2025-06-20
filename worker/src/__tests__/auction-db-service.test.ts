/**
 * Tests for AuctionDatabaseService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuctionDatabaseService } from '../auction-db-service';
import { createMockD1Database, mockCurrentAuctionStates, type MockD1Database } from './fixtures/database-mocks';
import { mockRawServerData } from './fixtures/auction-data';

describe('AuctionDatabaseService', () => {
	let service: AuctionDatabaseService;
	let mockDb: MockD1Database;

	beforeEach(() => {
		mockDb = createMockD1Database();
		service = new AuctionDatabaseService(mockDb as any);
		vi.clearAllMocks();
	});

	describe('storeAuctionData', () => {
		it('should handle empty config array', async () => {
			const result = await service.storeAuctionData([]);

			expect(result).toEqual({
				processed: 0,
				newAuctions: 0,
				priceChanges: 0,
				errors: 0,
			});
		});

		it('should process new auction correctly', async () => {
			// Mock that no current state exists (new auction)
			mockDb.prepare = vi.fn().mockImplementation((query: string) => {
				const mockStmt = {
					bind: vi.fn().mockReturnThis(),
					all: vi.fn().mockResolvedValue({ results: [] }), // Empty results = new auction
					run: vi.fn().mockResolvedValue({
						success: true,
						meta: { changes: 1 },
					}),
				};
				return mockStmt;
			});

			mockDb.batch = vi.fn().mockResolvedValue([{ success: true, meta: { changes: 1 } }]);

			const configs = [mockRawServerData];
			const result = await service.storeAuctionData(configs);

			expect(result.processed).toBe(1);
			expect(result.newAuctions).toBe(1);
			expect(result.priceChanges).toBe(0);
			expect(result.errors).toBe(0);
		});

		it('should detect price changes correctly', async () => {
			// Mock existing auction with different price
			mockDb.prepare = vi.fn().mockImplementation((query: string) => {
				if (query.includes('SELECT id, price, last_changed')) {
					return {
						bind: vi.fn().mockReturnThis(),
						all: vi.fn().mockResolvedValue({
							results: [{ id: mockRawServerData.id, price: 85.0, last_changed: '2023-11-01T10:00:00.000Z' }],
						}),
					};
				}
				return {
					bind: vi.fn().mockReturnThis(),
					run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
				};
			});

			mockDb.batch = vi.fn().mockResolvedValue([{ success: true, meta: { changes: 1 } }]);

			const configs = [{ ...mockRawServerData, price: 89.0 }]; // Different price
			const result = await service.storeAuctionData(configs);

			expect(result.processed).toBe(1);
			expect(result.newAuctions).toBe(0);
			expect(result.priceChanges).toBe(1);
			expect(result.errors).toBe(0);
		});

		it('should handle existing auction with same price', async () => {
			// Mock existing auction with same price
			mockDb.prepare = vi.fn().mockImplementation((query: string) => {
				if (query.includes('SELECT id, price, last_changed')) {
					return {
						bind: vi.fn().mockReturnThis(),
						all: vi.fn().mockResolvedValue({
							results: [{ id: mockRawServerData.id, price: mockRawServerData.price, last_changed: '2023-11-01T10:00:00.000Z' }],
						}),
					};
				}
				return {
					bind: vi.fn().mockReturnThis(),
					run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
				};
			});

			mockDb.batch = vi.fn().mockResolvedValue([{ success: true, meta: { changes: 1 } }]);

			const configs = [mockRawServerData];
			const result = await service.storeAuctionData(configs);

			expect(result.processed).toBe(1);
			expect(result.newAuctions).toBe(0);
			expect(result.priceChanges).toBe(0);
			expect(result.errors).toBe(0);
		});

		it('should handle database errors correctly', async () => {
			mockDb.prepare = vi.fn().mockImplementation(() => {
				throw new Error('Database connection failed');
			});

			const configs = [mockRawServerData];

			await expect(service.storeAuctionData(configs)).rejects.toThrow('Database connection failed');
		});

		it('should handle batch operations correctly', async () => {
			const batchSpy = vi.spyOn(mockDb, 'batch').mockResolvedValue([
				{ success: true, meta: { changes: 1 } },
				{ success: true, meta: { changes: 1 } },
			]);

			// Mock no existing state (new auctions)
			mockDb.prepare = vi.fn().mockImplementation((query: string) => {
				if (query.includes('SELECT id, price, last_changed')) {
					return {
						bind: vi.fn().mockReturnThis(),
						all: vi.fn().mockResolvedValue({ results: [] }),
					};
				}
				return {
					bind: vi.fn().mockReturnThis(),
					run: vi.fn().mockResolvedValue({ success: true }),
				};
			});

			const configs = [mockRawServerData, { ...mockRawServerData, id: 999 }];
			const result = await service.storeAuctionData(configs);

			expect(batchSpy).toHaveBeenCalledTimes(1);
			expect(result.processed).toBe(2);
			expect(result.newAuctions).toBe(2);
		});

		it('should chunk large queries correctly', async () => {
			// Create 150 configs to test chunking (chunk size is 100)
			const configs = Array.from({ length: 150 }, (_, i) => ({
				...mockRawServerData,
				id: i + 1,
			}));

			const allSpy = vi.fn().mockResolvedValue({ results: [] });
			mockDb.prepare = vi.fn().mockImplementation((query: string) => {
				if (query.includes('SELECT id, price, last_changed')) {
					return {
						bind: vi.fn().mockReturnThis(),
						all: allSpy,
					};
				}
				return {
					bind: vi.fn().mockReturnThis(),
					run: vi.fn().mockResolvedValue({ success: true }),
				};
			});

			mockDb.batch = vi.fn().mockResolvedValue([]);

			await service.storeAuctionData(configs);

			// Should be called twice: once for first 100, once for remaining 50
			expect(allSpy).toHaveBeenCalledTimes(2);
		});

		it('should update latest batch timestamp', async () => {
			const updateBatchSpy = vi.fn().mockResolvedValue({ success: true });

			mockDb.prepare = vi.fn().mockImplementation((query: string) => {
				if (query.includes('UPDATE latest_batch')) {
					return {
						bind: vi.fn().mockReturnThis(),
						run: updateBatchSpy,
					};
				}
				if (query.includes('SELECT id, price, last_changed')) {
					return {
						bind: vi.fn().mockReturnThis(),
						all: vi.fn().mockResolvedValue({ results: [] }),
					};
				}
				return {
					bind: vi.fn().mockReturnThis(),
					run: vi.fn().mockResolvedValue({ success: true }),
				};
			});

			mockDb.batch = vi.fn().mockResolvedValue([]);

			const configs = [mockRawServerData];
			await service.storeAuctionData(configs);

			expect(updateBatchSpy).toHaveBeenCalledTimes(1);
		});

		it('should handle null/undefined values in server data', async () => {
			const configWithNulls = {
				...mockRawServerData,
				ram_size: null as any,
				nvme_count: undefined as any,
				bandwidth: null as any,
			};

			mockDb.prepare = vi.fn().mockImplementation((query: string) => {
				if (query.includes('SELECT id, price, last_changed')) {
					return {
						bind: vi.fn().mockReturnThis(),
						all: vi.fn().mockResolvedValue({ results: [] }),
					};
				}
				return {
					bind: vi.fn().mockReturnThis(),
					run: vi.fn().mockResolvedValue({ success: true }),
				};
			});

			mockDb.batch = vi.fn().mockResolvedValue([]);

			const configs = [configWithNulls];
			const result = await service.storeAuctionData(configs);

			expect(result.processed).toBe(1);
			expect(result.errors).toBe(0);
		});
	});
});
