/**
 * Tests for AlertService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertService } from '../alert-service';
import { AlertNotificationService } from '../notifications/alert-notification-service';
import {
	mockMatchingAlertsQueryResult,
	mockEmptyAlertsQueryResult,
	mockMultipleAlertsQueryResult,
	mockNotificationResults,
	mockFailedNotificationResults,
} from './fixtures/alert-data';

// Mock the notification service
vi.mock('../notifications/alert-notification-service');

describe('AlertService', () => {
	let service: AlertService;
	let mockNotificationService: AlertNotificationService;
	let mockDb: any;
	const testDoId = 'test-do-id';

	beforeEach(() => {
		// Create fresh mocks for each test
		const mockStatement = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: [] }),
			run: vi.fn().mockResolvedValue({ results: [], success: true }),
			first: vi.fn().mockResolvedValue(null),
		};

		mockDb = {
			prepare: vi.fn().mockReturnValue(mockStatement),
			batch: vi.fn().mockResolvedValue([{ results: [], success: true }]),
			exec: vi.fn().mockResolvedValue({ results: [], success: true }),
		};

		mockNotificationService = {
			sendNotification: vi.fn(),
			getChannels: vi.fn().mockReturnValue(['discord', 'email']),
		} as any;

		service = new AlertService({
			db: mockDb,
			notificationService: mockNotificationService,
			doId: testDoId,
		});

		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with correct configuration', () => {
			expect(service).toBeInstanceOf(AlertService);
		});
	});

	describe('processAlerts', () => {
		it('should return empty array when no alerts match', async () => {
			// Mock empty query result
			const mockStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockEmptyAlertsQueryResult }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};
			mockDb.prepare.mockReturnValue(mockStatement);

			const result = await service.processAlerts();

			expect(result).toEqual([]);
			expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
			expect(mockStatement.all).toHaveBeenCalledTimes(1);
		});

		it('should process single alert with multiple matched auctions', async () => {
			// Mock query result
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockMatchingAlertsQueryResult }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			const mockHistoryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			const mockMatchesStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			const mockDeleteStatement = {
				bind: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({ results: [], success: true }),
				}),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare
				.mockReturnValueOnce(mockQueryStatement) // Initial query
				.mockReturnValueOnce(mockHistoryStatement) // History insert
				.mockReturnValueOnce(mockMatchesStatement) // Matches insert
				.mockReturnValueOnce(mockDeleteStatement); // Delete alert

			// Mock successful notifications
			(mockNotificationService.sendNotification as any).mockResolvedValue(mockNotificationResults);

			mockDb.batch.mockResolvedValue([{ results: [], success: true }]);

			const result = await service.processAlerts();

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				alertId: 1,
				notifications: 2, // Discord + Email
				success: true,
			});

			// Verify notification was called with correct structure
			expect(mockNotificationService.sendNotification).toHaveBeenCalledWith({
				alert: expect.objectContaining({
					id: 1,
					name: 'Test Alert - Intel Server',
				}),
				triggerPrice: expect.any(Number),
				matchedAuctions: expect.arrayContaining([
					expect.objectContaining({ auction_id: 12345 }),
					expect.objectContaining({ auction_id: 12346 }),
				]),
				lowestAuctionPrice: 75.0,
			});

			// Verify database operations were called
			expect(mockDb.batch).toHaveBeenCalledTimes(2); // History + Matches
		});

		it('should calculate trigger price correctly with VAT and IPv4 cost', async () => {
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockMatchingAlertsQueryResult }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare.mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			});
			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);

			(mockNotificationService.sendNotification as any).mockResolvedValue(mockNotificationResults);
			mockDb.batch.mockResolvedValue([{ results: [], success: true }]);

			await service.processAlerts();

			// Expected calculation: (75.00 + 1.19) * 1.19 = 90.6861
			const expectedTriggerPrice = (75.0 + 1.19) * (1 + 19.0 / 100.0);

			expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					triggerPrice: expectedTriggerPrice,
				}),
			);
		});

		it('should handle multiple alerts correctly', async () => {
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockMultipleAlertsQueryResult }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare.mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			});
			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);

			(mockNotificationService.sendNotification as any).mockResolvedValue(mockNotificationResults);
			mockDb.batch.mockResolvedValue([{ results: [], success: true }]);

			const result = await service.processAlerts();

			expect(result).toHaveLength(2);
			expect(result[0].alertId).toBe(1);
			expect(result[1].alertId).toBe(2);
			expect(mockNotificationService.sendNotification).toHaveBeenCalledTimes(2);
		});

		it('should handle notification failures gracefully', async () => {
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockMatchingAlertsQueryResult }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare.mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			});
			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);

			// Mock failed notifications
			(mockNotificationService.sendNotification as any).mockResolvedValue(mockFailedNotificationResults);
			mockDb.batch.mockResolvedValue([{ results: [], success: true }]);

			const result = await service.processAlerts();

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				alertId: 1,
				notifications: 0, // All notifications failed
				success: true, // Alert processing succeeded even if notifications failed
			});
		});

		it('should handle database errors during alert processing', async () => {
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockMatchingAlertsQueryResult }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);
			(mockNotificationService.sendNotification as any).mockResolvedValue(mockNotificationResults);

			// Mock database error during batch operation
			mockDb.batch.mockRejectedValue(new Error('Database connection failed'));

			const result = await service.processAlerts();

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				alertId: 1,
				notifications: 0,
				success: false,
				error: 'Database connection failed',
			});
		});

		it('should handle notification service errors', async () => {
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockMatchingAlertsQueryResult }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);

			// Mock notification service error
			(mockNotificationService.sendNotification as any).mockRejectedValue(new Error('SMTP server unavailable'));

			const result = await service.processAlerts();

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				alertId: 1,
				notifications: 0,
				success: false,
				error: 'SMTP server unavailable',
			});
		});

		it('should handle SQL query errors', async () => {
			// Mock SQL query error
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockRejectedValue(new Error('SQL syntax error')),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);

			await expect(service.processAlerts()).rejects.toThrow('SQL syntax error');
		});

		it('should log appropriate messages during processing', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockMatchingAlertsQueryResult }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare.mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			});
			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);

			(mockNotificationService.sendNotification as any).mockResolvedValue(mockNotificationResults);
			mockDb.batch.mockResolvedValue([{ results: [], success: true }]);

			await service.processAlerts();

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[AlertService ${testDoId}] Starting alert processing`));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[AlertService ${testDoId}] Found 2 matching alerts`));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[AlertService ${testDoId}] Processing 1 unique alerts`));
		});
	});

	describe('SQL query construction', () => {
		it('should use correct IPv4 cost constant', async () => {
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);

			await service.processAlerts();

			// Verify the SQL contains the correct IPv4 cost (1.19)
			const sqlQuery = mockDb.prepare.mock.calls[0][0];
			expect(sqlQuery).toContain('1.19'); // €1.19 IPv4 cost
		});

		it('should include all required filter conditions in SQL', async () => {
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				run: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
			};

			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);

			await service.processAlerts();

			const sqlQuery = mockDb.prepare.mock.calls[0][0];

			// Verify key filter conditions are present
			expect(sqlQuery).toContain('locationGermany');
			expect(sqlQuery).toContain('locationFinland');
			expect(sqlQuery).toContain('cpuCount');
			expect(sqlQuery).toContain('cpuIntel');
			expect(sqlQuery).toContain('cpuAMD');
			expect(sqlQuery).toContain('ramInternalSize');
			expect(sqlQuery).toContain('ssdNvmeCount');
			expect(sqlQuery).toContain('selectedDatacenters');
			expect(sqlQuery).toContain('selectedCpuModels');
			expect(sqlQuery).toContain('extrasECC');
			expect(sqlQuery).toContain('extrasINIC');
			expect(sqlQuery).toContain('extrasHWR');
			expect(sqlQuery).toContain('extrasGPU');
			expect(sqlQuery).toContain('extrasRPS');
		});
	});
});
