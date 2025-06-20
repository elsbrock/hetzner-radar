/**
 * Tests for NotificationService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../notification-service';
import { createMockDurableObjectStorage, type MockDurableObjectStorage } from './fixtures/database-mocks';
import { mockServerTypes } from './fixtures/cloud-data';
import type { AvailabilityChange } from '../cloud-status-service';

interface MockAnalyticsEngineDataset {
	writeDataPoint: (data: any) => void;
}

describe('NotificationService', () => {
	let service: NotificationService;
	let mockStorage: MockDurableObjectStorage;
	let mockAnalyticsEngine: MockAnalyticsEngineDataset;
	const testDoId = 'test-do-id';

	const mockAvailabilityChanges: AvailabilityChange[] = [
		{
			serverTypeId: 1,
			serverTypeName: 'cx11',
			locationId: 1,
			locationName: 'nbg1',
			eventType: 'available',
			timestamp: Date.now(),
		},
		{
			serverTypeId: 2,
			serverTypeName: 'cx21',
			locationId: 2,
			locationName: 'fsn1',
			eventType: 'unavailable',
			timestamp: Date.now(),
		},
	];

	beforeEach(() => {
		mockStorage = createMockDurableObjectStorage({
			serverTypes: mockServerTypes,
		});

		mockAnalyticsEngine = {
			writeDataPoint: vi.fn(),
		};

		service = new NotificationService(mockStorage as any, testDoId, mockAnalyticsEngine as any);

		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with required parameters', () => {
			expect(service).toBeInstanceOf(NotificationService);
		});

		it('should work without analytics engine', () => {
			const serviceWithoutAnalytics = new NotificationService(mockStorage as any, testDoId);
			expect(serviceWithoutAnalytics).toBeInstanceOf(NotificationService);
		});
	});

	describe('handleAvailabilityChanges', () => {
		it('should handle empty changes array', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			await service.handleAvailabilityChanges([]);

			expect(mockAnalyticsEngine.writeDataPoint).not.toHaveBeenCalled();
			expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Handling'));
		});

		it('should process availability changes and write to analytics', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			await service.handleAvailabilityChanges(mockAvailabilityChanges);

			expect(consoleSpy).toHaveBeenCalledWith(
				`[NotificationService ${testDoId}] Handling ${mockAvailabilityChanges.length} availability changes...`,
			);
			expect(consoleSpy).toHaveBeenCalledWith(`[NotificationService ${testDoId}] Writing to Analytics Engine...`);
			expect(consoleSpy).toHaveBeenCalledWith(
				`[NotificationService ${testDoId}] Wrote ${mockAvailabilityChanges.length} data points to Analytics Engine`,
			);

			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledTimes(2);
		});

		it('should write correct data points to analytics engine', async () => {
			await service.handleAvailabilityChanges(mockAvailabilityChanges);

			// Check first change (available)
			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['1', '1', 'available', 'cx11', 'nbg1'],
				doubles: [1, 1, 1073741824], // 1 (available), cores, memory
				indexes: ['cx11'],
			});

			// Check second change (unavailable)
			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['2', '2', 'unavailable', 'cx21', 'fsn1'],
				doubles: [0, 2, 4294967296], // 0 (unavailable), cores, memory
				indexes: ['cx21'],
			});
		});

		it('should handle missing server type data gracefully', async () => {
			const changeWithUnknownServerType: AvailabilityChange = {
				serverTypeId: 999,
				serverTypeName: 'unknown',
				locationId: 1,
				locationName: 'nbg1',
				eventType: 'available',
				timestamp: Date.now(),
			};

			await service.handleAvailabilityChanges([changeWithUnknownServerType]);

			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['999', '1', 'available', 'unknown', 'nbg1'],
				doubles: [1, 0, 0], // 1 (available), 0 cores, 0 memory (defaults)
				indexes: ['unknown'],
			});
		});

		it('should handle analytics engine errors gracefully', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
			mockAnalyticsEngine.writeDataPoint = vi.fn().mockImplementation(() => {
				throw new Error('Analytics error');
			});

			await service.handleAvailabilityChanges(mockAvailabilityChanges);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				`[NotificationService ${testDoId}] Failed to write to Analytics Engine:`,
				expect.any(Error),
			);
		});

		it('should work without analytics engine', async () => {
			const serviceWithoutAnalytics = new NotificationService(mockStorage as any, testDoId);

			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			await serviceWithoutAnalytics.handleAvailabilityChanges(mockAvailabilityChanges);

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Handling'));
			expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Writing to Analytics Engine'));
		});

		it('should log about cloud alert service handling', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			await service.handleAvailabilityChanges(mockAvailabilityChanges);

			expect(consoleSpy).toHaveBeenCalledWith(
				`[NotificationService ${testDoId}] Cloud alert processing handled by CloudAlertService, not calling legacy endpoint`,
			);
		});
	});

	describe('writeImportAnalytics', () => {
		const mockStats = {
			processed: 10,
			newAuctions: 5,
			priceChanges: 3,
			errors: 0,
		};

		it('should write success analytics correctly', async () => {
			await service.writeImportAnalytics(true, mockStats, 1500);

			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['auction_import', 'success'],
				doubles: [10, 5, 3, 1500], // processed, newAuctions, priceChanges, duration
				indexes: ['auction_import_success'],
			});
		});

		it('should write error analytics correctly', async () => {
			await service.writeImportAnalytics(false, undefined, 2000, 'Database connection failed');

			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['auction_import', 'error', 'Database connection failed'],
				doubles: [2000], // duration
				indexes: ['auction_import_error'],
			});
		});

		it('should handle missing optional parameters', async () => {
			await service.writeImportAnalytics(true, mockStats);

			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['auction_import', 'success'],
				doubles: [10, 5, 3, 0], // duration defaults to 0
				indexes: ['auction_import_success'],
			});
		});

		it('should handle missing stats', async () => {
			await service.writeImportAnalytics(true, undefined, 1000);

			// When stats is undefined, it goes to the error branch
			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['auction_import', 'error', 'unknown'],
				doubles: [1000], // duration
				indexes: ['auction_import_error'],
			});
		});

		it('should handle partial stats', async () => {
			const partialStats = {
				processed: 5,
				newAuctions: 2,
				// missing priceChanges and errors
			};

			await service.writeImportAnalytics(true, partialStats, 800);

			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['auction_import', 'success'],
				doubles: [5, 2, 0, 800], // missing fields default to 0
				indexes: ['auction_import_success'],
			});
		});

		it('should handle analytics engine errors gracefully', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
			mockAnalyticsEngine.writeDataPoint = vi.fn().mockImplementation(() => {
				throw new Error('Analytics write failed');
			});

			await service.writeImportAnalytics(true, mockStats, 1500);

			expect(consoleErrorSpy).toHaveBeenCalledWith(`[NotificationService ${testDoId}] Failed to write analytics:`, expect.any(Error));
		});

		it('should work without analytics engine', async () => {
			const serviceWithoutAnalytics = new NotificationService(mockStorage as any, testDoId);

			// Should not throw error
			await expect(serviceWithoutAnalytics.writeImportAnalytics(true, mockStats, 1500)).resolves.toBeUndefined();
		});

		it('should default error message when not provided', async () => {
			await service.writeImportAnalytics(false, undefined, 2000);

			expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith({
				blobs: ['auction_import', 'error', 'unknown'],
				doubles: [2000],
				indexes: ['auction_import_error'],
			});
		});
	});
});
