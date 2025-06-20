/**
 * Tests for CloudAlertService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudAlertService } from '../cloud-alert-service';
import { CloudNotificationService } from '../cloud-notifications/cloud-notification-service';
import {
	mockAvailabilityChanges,
	mockSingleAvailabilityChange,
	_mockCloudAlerts,
	_mockSingleCloudAlert,
	_mockCloudAlertUsers,
	mockRawCloudAlertRecords,
	mockRawUserRecords,
	mockEmptyAvailabilityChanges,
	_mockEmptyCloudAlerts,
	mockEmptyRawAlertRecords,
	mockCloudNotificationServiceResult,
	mockFailedCloudNotificationResults,
} from './fixtures/cloud-alert-data';

// Mock the CloudNotificationService
vi.mock('../cloud-notifications/cloud-notification-service');

describe('CloudAlertService', () => {
	let service: CloudAlertService;
	let mockNotificationService: CloudNotificationService;
	let mockDb: unknown;
	const testDoId = 'test-do-id';

	beforeEach(() => {
		// Create fresh mocks for each test
		const mockStatement = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue({ results: [] }),
			first: vi.fn().mockResolvedValue(null),
			run: vi.fn().mockResolvedValue({ results: [], success: true }),
		};

		mockDb = {
			prepare: vi.fn().mockReturnValue(mockStatement),
			batch: vi.fn().mockResolvedValue([{ results: [], success: true }]),
			exec: vi.fn().mockResolvedValue({ results: [], success: true }),
		};

		mockNotificationService = {
			processAvailabilityChanges: vi.fn(),
		} as any;

		service = new CloudAlertService({
			db: mockDb,
			notificationService: mockNotificationService,
			doId: testDoId,
		});

		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with correct configuration', () => {
			expect(service).toBeInstanceOf(CloudAlertService);
		});
	});

	describe('processAvailabilityChanges', () => {
		it('should return success with zero counts when no changes provided', async () => {
			const result = await service.processAvailabilityChanges(mockEmptyAvailabilityChanges);

			expect(result).toEqual({
				changesProcessed: 0,
				alertsMatched: 0,
				notificationsSent: 0,
				success: true,
			});

			expect(mockDb.prepare).not.toHaveBeenCalled();
			expect(mockNotificationService.processAvailabilityChanges).not.toHaveBeenCalled();
		});

		it('should process changes successfully when no alerts exist', async () => {
			const mockQueryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockEmptyRawAlertRecords }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockQueryStatement);

			const result = await service.processAvailabilityChanges(mockAvailabilityChanges);

			expect(result).toEqual({
				changesProcessed: 3,
				alertsMatched: 0,
				notificationsSent: 0,
				success: true,
			});

			expect(mockQueryStatement.all).toHaveBeenCalledTimes(1);
			expect(mockNotificationService.processAvailabilityChanges).not.toHaveBeenCalled();
		});

		it('should process changes and send notifications successfully', async () => {
			// Mock getting alerts
			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockRawCloudAlertRecords }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			// Mock getting users
			const mockUserStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValueOnce(mockRawUserRecords[0]).mockResolvedValueOnce(mockRawUserRecords[1]),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			// Mock history statements
			const mockHistoryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare
				.mockReturnValueOnce(mockAlertsStatement) // Get alerts
				.mockReturnValue(mockUserStatement) // Get users (will be called multiple times)
				.mockReturnValueOnce(mockHistoryStatement); // Insert history

			// Mock notification service
			(mockNotificationService.processAvailabilityChanges as any).mockResolvedValue(mockCloudNotificationServiceResult);

			mockDb.batch.mockResolvedValue([{ results: [], success: true }]);

			const result = await service.processAvailabilityChanges(mockAvailabilityChanges);

			expect(result).toEqual({
				changesProcessed: 3,
				alertsMatched: 2,
				notificationsSent: 2,
				success: true,
			});

			// Verify alert query was called
			expect(mockAlertsStatement.all).toHaveBeenCalledTimes(1);

			// Verify notification service was called with correct parameters
			expect(mockNotificationService.processAvailabilityChanges).toHaveBeenCalledWith(
				mockAvailabilityChanges,
				expect.arrayContaining([
					expect.objectContaining({ id: 'alert-1' }),
					expect.objectContaining({ id: 'alert-2' }),
					expect.objectContaining({ id: 'alert-3' }),
				]),
				expect.any(Function),
			);

			// Verify history recording was attempted
			expect(mockDb.batch).toHaveBeenCalledTimes(1);
		});

		it('should handle notification service failures gracefully', async () => {
			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockRawCloudAlertRecords }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement);

			// Mock notification service failure
			(mockNotificationService.processAvailabilityChanges as any).mockRejectedValue(new Error('Notification service failed'));

			const result = await service.processAvailabilityChanges(mockAvailabilityChanges);

			expect(result).toEqual({
				changesProcessed: 0,
				alertsMatched: 0,
				notificationsSent: 0,
				success: false,
				error: 'Notification service failed',
			});
		});

		it('should handle database errors gracefully', async () => {
			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockRejectedValue(new Error('Database connection failed')),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement);

			const result = await service.processAvailabilityChanges(mockAvailabilityChanges);

			expect(result).toEqual({
				changesProcessed: 0,
				alertsMatched: 0,
				notificationsSent: 0,
				success: false,
				error: 'Database connection failed',
			});
		});

		it('should parse cloud alerts correctly from database records', async () => {
			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [mockRawCloudAlertRecords[0]] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement);

			(mockNotificationService.processAvailabilityChanges as any).mockResolvedValue({
				processed: 1,
				notifications: 0,
				results: [],
			});

			await service.processAvailabilityChanges(mockSingleAvailabilityChange);

			// Check that alerts were parsed correctly
			expect(mockNotificationService.processAvailabilityChanges).toHaveBeenCalledWith(
				mockSingleAvailabilityChange,
				[
					{
						id: 'alert-1',
						user_id: 'user-1',
						name: 'cx11 in NBG1',
						server_type_ids: [1],
						location_ids: [1],
						alert_on: 'available',
						email_notifications: true,
						discord_notifications: true,
						created_at: '2024-01-01T00:00:00Z',
					},
				],
				expect.any(Function),
			);
		});

		it('should handle partial notification failures correctly', async () => {
			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockRawCloudAlertRecords }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			const mockUserStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(mockRawUserRecords[0]),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement).mockReturnValue(mockUserStatement);

			// Mock partial failures - one success, one failure
			const partialFailureResult = {
				processed: 2,
				notifications: 2,
				results: [
					mockFailedCloudNotificationResults[0], // Discord failure
					{
						// Email success
						channel: 'email',
						success: true,
						timestamp: new Date().toISOString(),
						userId: 'user-1',
						changesProcessed: 1,
					},
				],
			};

			(mockNotificationService.processAvailabilityChanges as any).mockResolvedValue(partialFailureResult);

			const result = await service.processAvailabilityChanges(mockAvailabilityChanges);

			expect(result).toEqual({
				changesProcessed: 2,
				alertsMatched: 2,
				notificationsSent: 1, // Only one successful notification
				success: true,
			});
		});

		it('should log appropriate messages during processing', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockRawCloudAlertRecords }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement);

			(mockNotificationService.processAvailabilityChanges as any).mockResolvedValue(mockCloudNotificationServiceResult);

			await service.processAvailabilityChanges(mockAvailabilityChanges);

			expect(consoleSpy).toHaveBeenCalledWith(`[CloudAlertService ${testDoId}] Processing 3 availability changes`);
			expect(consoleSpy).toHaveBeenCalledWith(`[CloudAlertService ${testDoId}] Found 3 active cloud alerts`);
			expect(consoleSpy).toHaveBeenCalledWith(
				`[CloudAlertService ${testDoId}] Cloud alert processing completed:`,
				expect.objectContaining({
					changesProcessed: 3,
					alertsMatched: 2,
					notificationsSent: 2,
				}),
			);
		});
	});

	describe('user lookup functionality', () => {
		it('should return user data when user exists', async () => {
			const mockUserStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(mockRawUserRecords[0]),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValue(mockUserStatement);

			// Test the user lookup function through the notification service call
			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [mockRawCloudAlertRecords[0]] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement);

			let userLookupFunction: (userId: string) => Promise<any>;
			(mockNotificationService.processAvailabilityChanges as any).mockImplementation(
				async (changes: unknown, alerts: unknown, getUserFn: unknown) => {
					userLookupFunction = getUserFn;
					return { processed: 0, notifications: 0, results: [] };
				},
			);

			await service.processAvailabilityChanges(mockSingleAvailabilityChange);

			// Test the user lookup function
			const user = await userLookupFunction!('user-1');
			expect(user).toEqual({
				id: 'user-1',
				email: 'user1@example.com',
				discord_webhook_url: 'https://discord.com/api/webhooks/user1',
			});

			expect(mockUserStatement.bind).toHaveBeenCalledWith('user-1');
		});

		it('should return null when user does not exist', async () => {
			const mockUserStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValue(mockUserStatement);

			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [mockRawCloudAlertRecords[0]] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement);

			let userLookupFunction: (userId: string) => Promise<any>;
			(mockNotificationService.processAvailabilityChanges as any).mockImplementation(
				async (changes: unknown, alerts: unknown, getUserFn: unknown) => {
					userLookupFunction = getUserFn;
					return { processed: 0, notifications: 0, results: [] };
				},
			);

			await service.processAvailabilityChanges(mockSingleAvailabilityChange);

			const user = await userLookupFunction!('nonexistent-user');
			expect(user).toBeNull();
		});
	});

	describe('alert history recording', () => {
		it('should record matching alert triggers in history', async () => {
			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockRawCloudAlertRecords }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			const mockHistoryStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement).mockReturnValue(mockHistoryStatement);

			(mockNotificationService.processAvailabilityChanges as any).mockResolvedValue(mockCloudNotificationServiceResult);

			mockDb.batch.mockResolvedValue([{ results: [], success: true }]);

			await service.processAvailabilityChanges(mockAvailabilityChanges);

			// Verify that batch was called with history inserts
			expect(mockDb.batch).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.anything(), // At least one prepared statement
				]),
			);

			// Check that bind was called with correct parameters for history records
			expect(mockHistoryStatement.bind).toHaveBeenCalledWith(
				expect.any(String), // UUID
				expect.any(String), // alert_id
				expect.any(String), // user_id
				expect.any(Number), // server_type_id
				expect.any(String), // server_type_name
				expect.any(Number), // location_id
				expect.any(String), // location_name
				expect.any(String), // event_type
			);
		});

		it('should not record history when no alerts match', async () => {
			// Mock alert that doesn't match any changes
			const nonMatchingAlert = {
				...mockRawCloudAlertRecords[0],
				server_type_ids: JSON.stringify([999]), // Non-existent server type
				location_ids: JSON.stringify([999]), // Non-existent location
			};

			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [nonMatchingAlert] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement);

			(mockNotificationService.processAvailabilityChanges as any).mockResolvedValue({
				processed: 1,
				notifications: 0,
				results: [],
			});

			await service.processAvailabilityChanges(mockSingleAvailabilityChange);

			// Verify batch was not called since no matches
			expect(mockDb.batch).not.toHaveBeenCalled();
		});

		it('should handle database batch errors in history recording', async () => {
			const _consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockRawCloudAlertRecords }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement);

			(mockNotificationService.processAvailabilityChanges as any).mockResolvedValue(mockCloudNotificationServiceResult);

			// Mock batch failure
			mockDb.batch.mockRejectedValue(new Error('History insert failed'));

			// Should still complete processing despite history error
			const result = await service.processAvailabilityChanges(mockAvailabilityChanges);

			expect(result.success).toBe(false);
			expect(result.error).toBe('History insert failed');
		});
	});

	describe('SQL query construction', () => {
		it('should use correct SQL for getting active alerts', async () => {
			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement);

			await service.processAvailabilityChanges(mockSingleAvailabilityChange);

			expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM cloud_availability_alert ORDER BY created_at'));
		});

		it('should use correct SQL for getting users', async () => {
			const mockAlertsStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [mockRawCloudAlertRecords[0]] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			const mockUserStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(mockRawUserRecords[0]),
				run: vi.fn().mockResolvedValue({ results: [] }),
			};

			mockDb.prepare.mockReturnValueOnce(mockAlertsStatement).mockReturnValue(mockUserStatement);

			let userLookupFunction: (userId: string) => Promise<any>;
			(mockNotificationService.processAvailabilityChanges as any).mockImplementation(
				async (changes: unknown, alerts: unknown, getUserFn: unknown) => {
					userLookupFunction = getUserFn;
					return { processed: 0, notifications: 0, results: [] };
				},
			);

			await service.processAvailabilityChanges(mockSingleAvailabilityChange);
			await userLookupFunction!('user-1');

			expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT id, email, discord_webhook_url FROM user WHERE id = ?'));
		});
	});
});
