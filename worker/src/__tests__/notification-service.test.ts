/**
 * Tests for NotificationService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../notification-service';
import { createMockDurableObjectStorage, type MockDurableObjectStorage } from './fixtures/database-mocks';
import { mockServerTypes } from './fixtures/cloud-data';
import type { AvailabilityChange } from '../cloud-status-service';

interface MockAnalyticsEngineDataset {
	writeDataPoint: (data: unknown) => void;
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

		service = new NotificationService(mockStorage as DurableObjectStorage, testDoId, mockAnalyticsEngine as AnalyticsEngineDataset);

		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with required parameters', () => {
			expect(service).toBeInstanceOf(NotificationService);
		});

		it('should work without analytics engine', () => {
			const serviceWithoutAnalytics = new NotificationService(mockStorage as DurableObjectStorage, testDoId);
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
			const serviceWithoutAnalytics = new NotificationService(mockStorage as DurableObjectStorage, testDoId);

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
});
