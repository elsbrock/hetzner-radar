/**
 * Tests for AuctionService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuctionService } from '../auction-service';
import { HetznerAuctionClient } from '../hetzner-auction-client';
import { AuctionDataTransformer } from '../auction-data-transformer';
import { AuctionDatabaseService } from '../auction-db-service';
import {
	createMockD1Database,
	createMockDurableObjectStorage,
	type MockD1Database,
	type MockDurableObjectStorage,
} from './fixtures/database-mocks';
import { mockHetznerAuctionServer, mockHetznerAuctionServerMinimal, mockRawServerData } from './fixtures/auction-data';

// Mock the imported modules
vi.mock('../hetzner-auction-client');
vi.mock('../auction-data-transformer');
vi.mock('../auction-db-service');

describe('AuctionService', () => {
	let service: AuctionService;
	let mockDb: MockD1Database;
	let mockStorage: MockDurableObjectStorage;
	let mockAuctionClient: HetznerAuctionClient;
	let mockDbService: AuctionDatabaseService;

	const testApiUrl = 'https://api.example.com/auction-data';
	const testDoId = 'test-do-id';

	beforeEach(() => {
		mockDb = createMockD1Database();
		mockStorage = createMockDurableObjectStorage();
		service = new AuctionService(testApiUrl, mockDb as any, mockStorage as any, testDoId);

		// Reset all mocks
		vi.clearAllMocks();

		// Setup mock instances
		mockAuctionClient = {
			fetchAuctionData: vi.fn(),
		} as any;

		mockDbService = {
			storeAuctionData: vi.fn(),
		} as any;

		// Mock constructors
		(HetznerAuctionClient as any).mockImplementation(() => mockAuctionClient);
		(AuctionDatabaseService as any).mockImplementation(() => mockDbService);
	});

	describe('fetchAndImportAuctions', () => {
		it('should successfully fetch and import auction data', async () => {
			const mockServers = [mockHetznerAuctionServer, mockHetznerAuctionServerMinimal];
			const mockTransformed = [mockRawServerData, { ...mockRawServerData, id: 67890 }];
			const mockStats = {
				processed: 2,
				newAuctions: 1,
				priceChanges: 1,
				errors: 0,
			};

			// Setup mocks
			(mockAuctionClient.fetchAuctionData as any).mockResolvedValue(mockServers);
			vi.spyOn(AuctionDataTransformer, 'transformServers').mockReturnValue(mockTransformed);
			vi.spyOn(AuctionDataTransformer, 'validateTransformedData').mockReturnValue({
				valid: mockTransformed,
				invalid: 0,
			});
			(mockDbService.storeAuctionData as any).mockResolvedValue(mockStats);

			// Spy on storage.put
			const storagePutSpy = vi.spyOn(mockStorage, 'put');

			const result = await service.fetchAndImportAuctions();

			expect(mockAuctionClient.fetchAuctionData).toHaveBeenCalledTimes(1);
			expect(AuctionDataTransformer.transformServers).toHaveBeenCalledWith(mockServers);
			expect(AuctionDataTransformer.validateTransformedData).toHaveBeenCalledWith(mockTransformed);
			expect(mockDbService.storeAuctionData).toHaveBeenCalledWith(mockTransformed);
			expect(storagePutSpy).toHaveBeenCalledWith('lastAuctionImport', expect.any(String));

			expect(result).toEqual(
				expect.objectContaining({
					...mockStats,
					fetched: 2,
					transformed: 2,
					valid: 2,
					invalid: 0,
					duration: expect.any(Number),
				}),
			);
		});

		it('should throw error when D1 database is not configured', async () => {
			const serviceWithoutDb = new AuctionService(testApiUrl, null as any, mockStorage as any, testDoId);

			await expect(serviceWithoutDb.fetchAndImportAuctions()).rejects.toThrow('D1 database is not configured.');
		});

		it('should handle API fetch errors', async () => {
			(mockAuctionClient.fetchAuctionData as any).mockRejectedValue(new Error('API Error'));

			await expect(service.fetchAndImportAuctions()).rejects.toEqual({
				error: new Error('API Error'),
				duration: expect.any(Number),
			});
		});

		it('should handle transformation errors', async () => {
			const mockServers = [mockHetznerAuctionServer];
			(mockAuctionClient.fetchAuctionData as any).mockResolvedValue(mockServers);
			vi.spyOn(AuctionDataTransformer, 'transformServers').mockImplementation(() => {
				throw new Error('Transformation failed');
			});

			await expect(service.fetchAndImportAuctions()).rejects.toEqual({
				error: new Error('Transformation failed'),
				duration: expect.any(Number),
			});
		});

		it('should handle database storage errors', async () => {
			const mockServers = [mockHetznerAuctionServer];
			const mockTransformed = [mockRawServerData];

			(mockAuctionClient.fetchAuctionData as any).mockResolvedValue(mockServers);
			vi.spyOn(AuctionDataTransformer, 'transformServers').mockReturnValue(mockTransformed);
			vi.spyOn(AuctionDataTransformer, 'validateTransformedData').mockReturnValue({
				valid: mockTransformed,
				invalid: 0,
			});
			(mockDbService.storeAuctionData as any).mockRejectedValue(new Error('Database error'));

			await expect(service.fetchAndImportAuctions()).rejects.toEqual({
				error: new Error('Database error'),
				duration: expect.any(Number),
			});
		});

		it('should handle empty API response', async () => {
			(mockAuctionClient.fetchAuctionData as any).mockResolvedValue([]);
			vi.spyOn(AuctionDataTransformer, 'transformServers').mockReturnValue([]);
			vi.spyOn(AuctionDataTransformer, 'validateTransformedData').mockReturnValue({
				valid: [],
				invalid: 0,
			});

			const result = await service.fetchAndImportAuctions();

			expect(result).toEqual({
				processed: 0,
				newAuctions: 0,
				priceChanges: 0,
				errors: 0,
			});

			expect(mockDbService.storeAuctionData).not.toHaveBeenCalled();
		});

		it('should handle invalid data filtering', async () => {
			const mockServers = [mockHetznerAuctionServer, mockHetznerAuctionServerMinimal];
			const mockTransformed = [mockRawServerData, { ...mockRawServerData, id: 67890 }];
			const mockValidated = [mockRawServerData]; // Only one valid

			(mockAuctionClient.fetchAuctionData as any).mockResolvedValue(mockServers);
			vi.spyOn(AuctionDataTransformer, 'transformServers').mockReturnValue(mockTransformed);
			vi.spyOn(AuctionDataTransformer, 'validateTransformedData').mockReturnValue({
				valid: mockValidated,
				invalid: 1,
			});
			(mockDbService.storeAuctionData as any).mockResolvedValue({
				processed: 1,
				newAuctions: 1,
				priceChanges: 0,
				errors: 0,
			});

			const result = await service.fetchAndImportAuctions();

			expect(mockDbService.storeAuctionData).toHaveBeenCalledWith(mockValidated);
			expect(result).toEqual(
				expect.objectContaining({
					fetched: 2,
					transformed: 2,
					valid: 1,
					invalid: 1,
				}),
			);
		});

		it('should handle no valid data after validation', async () => {
			const mockServers = [mockHetznerAuctionServer];
			const mockTransformed = [mockRawServerData];

			(mockAuctionClient.fetchAuctionData as any).mockResolvedValue(mockServers);
			vi.spyOn(AuctionDataTransformer, 'transformServers').mockReturnValue(mockTransformed);
			vi.spyOn(AuctionDataTransformer, 'validateTransformedData').mockReturnValue({
				valid: [],
				invalid: 1,
			});

			const result = await service.fetchAndImportAuctions();

			expect(result).toEqual({
				processed: 0,
				newAuctions: 0,
				priceChanges: 0,
				errors: 0,
			});

			expect(mockDbService.storeAuctionData).not.toHaveBeenCalled();
		});

		it('should update last import timestamp on success', async () => {
			const mockServers = [mockHetznerAuctionServer];
			const mockTransformed = [mockRawServerData];
			const mockStats = {
				processed: 1,
				newAuctions: 1,
				priceChanges: 0,
				errors: 0,
			};

			(mockAuctionClient.fetchAuctionData as any).mockResolvedValue(mockServers);
			vi.spyOn(AuctionDataTransformer, 'transformServers').mockReturnValue(mockTransformed);
			vi.spyOn(AuctionDataTransformer, 'validateTransformedData').mockReturnValue({
				valid: mockTransformed,
				invalid: 0,
			});
			(mockDbService.storeAuctionData as any).mockResolvedValue(mockStats);

			// Spy on storage.put
			const storagePutSpy = vi.spyOn(mockStorage, 'put');

			await service.fetchAndImportAuctions();

			expect(storagePutSpy).toHaveBeenCalledWith('lastAuctionImport', expect.any(String));
		});

		it('should measure and return execution duration', async () => {
			const startTime = Date.now();

			const mockServers = [mockHetznerAuctionServer];
			const mockTransformed = [mockRawServerData];
			const mockStats = {
				processed: 1,
				newAuctions: 1,
				priceChanges: 0,
				errors: 0,
			};

			(mockAuctionClient.fetchAuctionData as any).mockResolvedValue(mockServers);
			vi.spyOn(AuctionDataTransformer, 'transformServers').mockReturnValue(mockTransformed);
			vi.spyOn(AuctionDataTransformer, 'validateTransformedData').mockReturnValue({
				valid: mockTransformed,
				invalid: 0,
			});
			(mockDbService.storeAuctionData as any).mockResolvedValue(mockStats);

			const result = await service.fetchAndImportAuctions();

			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(typeof result.duration).toBe('number');
		});

		it('should log appropriate messages during processing', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			const mockServers = [mockHetznerAuctionServer];
			const mockTransformed = [mockRawServerData];
			const mockStats = {
				processed: 1,
				newAuctions: 1,
				priceChanges: 0,
				errors: 0,
			};

			(mockAuctionClient.fetchAuctionData as any).mockResolvedValue(mockServers);
			vi.spyOn(AuctionDataTransformer, 'transformServers').mockReturnValue(mockTransformed);
			vi.spyOn(AuctionDataTransformer, 'validateTransformedData').mockReturnValue({
				valid: mockTransformed,
				invalid: 0,
			});
			(mockDbService.storeAuctionData as any).mockResolvedValue(mockStats);

			await service.fetchAndImportAuctions();

			// Check that all expected log messages were called at some point
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[AuctionService ${testDoId}] fetchAndImportAuctions called`));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[AuctionService ${testDoId}] Fetched 1 auction records`));
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(`[AuctionService ${testDoId}] Auction import completed successfully`),
				expect.any(Object),
			);
		});
	});
});
