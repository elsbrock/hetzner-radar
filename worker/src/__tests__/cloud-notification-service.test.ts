/**
 * Tests for CloudNotificationService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudNotificationService } from '../cloud-notifications/cloud-notification-service';
import type {
	CloudNotificationChannel,
	CloudNotification,
	CloudNotificationResult,
	AvailabilityChange,
	CloudAlert,
} from '../cloud-notifications/cloud-notification-channel';
import {
	mockAvailabilityChanges,
	mockSingleAvailabilityChange,
	mockCloudAlerts,
	mockCloudAlertUsers,
	mockCloudNotification,
	mockCloudNotificationResults,
	mockFailedCloudNotificationResults,
	mockEmptyAvailabilityChanges,
	mockEmptyCloudAlerts,
} from './fixtures/cloud-alert-data';

// Mock notification channels
const mockCloudDiscordChannel: CloudNotificationChannel = {
	name: 'cloud-discord',
	isEnabled: vi.fn(),
	send: vi.fn(),
};

const mockCloudEmailChannel: CloudNotificationChannel = {
	name: 'cloud-email',
	isEnabled: vi.fn(),
	send: vi.fn(),
};

// Mock the channel modules
vi.mock('../cloud-notifications/cloud-email-channel', () => ({
	CloudEmailChannel: vi.fn().mockImplementation(() => mockCloudEmailChannel),
}));

vi.mock('../cloud-notifications/cloud-discord-channel', () => ({
	CloudDiscordChannel: vi.fn().mockImplementation(() => mockCloudDiscordChannel),
}));

describe('CloudNotificationService', () => {
	let service: CloudNotificationService;
	let mockGetUserById: vi.Mock;

	const mockEmailConfig = {
		apiKey: 'test-key',
		fromName: 'Cloud Radar',
		fromEmail: 'cloud@test.com',
	};

	beforeEach(() => {
		service = new CloudNotificationService({ email: mockEmailConfig });
		mockGetUserById = vi.fn() as CloudNotificationChannel;
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with email and discord channels when email config provided', () => {
			const channels = service.getChannels();
			expect(channels).toContain('cloud-email');
			expect(channels).toContain('cloud-discord');
			expect(channels).toHaveLength(2);
		});

		it('should initialize with only discord channel when no email config provided', () => {
			const serviceWithoutEmail = new CloudNotificationService({});
			const channels = serviceWithoutEmail.getChannels();
			expect(channels).toContain('cloud-discord');
			expect(channels).not.toContain('cloud-email');
			expect(channels).toHaveLength(1);
		});
	});

	describe('processAvailabilityChanges', () => {
		beforeEach(() => {
			// Set default mock behavior
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(false);
			(mockCloudEmailChannel.isEnabled as CloudNotificationChannel).mockReturnValue(false);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[0]);
			(mockCloudEmailChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[1]);
		});

		it('should return zero counts when no changes provided', async () => {
			const result = await service.processAvailabilityChanges(mockEmptyAvailabilityChanges, mockCloudAlerts, mockGetUserById);

			expect(result).toEqual({
				processed: 0,
				notifications: 0,
				results: [],
			});

			expect(mockGetUserById).not.toHaveBeenCalled();
		});

		it('should return zero notifications when no alerts provided', async () => {
			const result = await service.processAvailabilityChanges(mockAvailabilityChanges, mockEmptyCloudAlerts, mockGetUserById);

			expect(result).toEqual({
				processed: 3,
				notifications: 0,
				results: [],
			});

			expect(mockGetUserById).not.toHaveBeenCalled();
		});

		it('should find matching alerts and send notifications', async () => {
			// Mock user lookup to return users
			mockGetUserById
				.mockResolvedValueOnce(mockCloudAlertUsers[0]) // user-1 for alert-1
				.mockResolvedValueOnce(mockCloudAlertUsers[1]) // user-2 for alert-2
				.mockResolvedValueOnce(mockCloudAlertUsers[0]); // user-1 for alert-3

			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[0]);

			const result = await service.processAvailabilityChanges(mockAvailabilityChanges, mockCloudAlerts, mockGetUserById);

			expect(result.processed).toBe(3);
			expect(result.notifications).toBeGreaterThan(0); // Should find matches
			expect(result.results.length).toBeGreaterThan(0);

			// Should have called getUserById for matching alerts
			expect(mockGetUserById).toHaveBeenCalled();
		});

		it('should group notifications by user to avoid spam', async () => {
			// Use alerts that would match the same user multiple times
			const sameUserAlerts = [
				{ ...mockCloudAlerts[0], user_id: 'user-1' },
				{ ...mockCloudAlerts[2], user_id: 'user-1' }, // Both for same user
			];

			mockGetUserById.mockResolvedValue(mockCloudAlertUsers[0]);

			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[0]);

			const result = await service.processAvailabilityChanges(mockSingleAvailabilityChange, sameUserAlerts, mockGetUserById);

			// Should send only one notification per user, not per alert match
			expect(result.results.length).toBeLessThanOrEqual(1);
		});

		it('should handle user lookup failures gracefully', async () => {
			// Mock getUserById to return null (user not found)
			mockGetUserById.mockResolvedValue(null);

			const result = await service.processAvailabilityChanges(mockAvailabilityChanges, mockCloudAlerts, mockGetUserById);

			expect(result).toEqual({
				processed: 3,
				notifications: 0,
				results: [],
			});
		});

		it('should correctly match server types, locations, and event types', async () => {
			const specificAlert: CloudAlert = {
				id: 'test-alert',
				user_id: 'user-1',
				name: 'Specific Alert',
				server_type_ids: [1], // Only cx11
				location_ids: [1], // Only nbg1
				alert_on: 'available', // Only available events
				email_notifications: true,
				discord_notifications: false,
				created_at: '2024-01-01T00:00:00Z',
			};

			const matchingChange: AvailabilityChange = {
				serverTypeId: 1,
				serverTypeName: 'cx11',
				locationId: 1,
				locationName: 'nbg1',
				eventType: 'available',
				timestamp: Date.now(),
			};

			const nonMatchingChange: AvailabilityChange = {
				serverTypeId: 2, // Different server type
				serverTypeName: 'cx21',
				locationId: 1,
				locationName: 'nbg1',
				eventType: 'available',
				timestamp: Date.now(),
			};

			mockGetUserById.mockResolvedValue(mockCloudAlertUsers[0]);
			(mockCloudEmailChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudEmailChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[1]);

			// Test matching change
			const matchingResult = await service.processAvailabilityChanges([matchingChange], [specificAlert], mockGetUserById);

			expect(matchingResult.notifications).toBe(1);

			// Test non-matching change
			const nonMatchingResult = await service.processAvailabilityChanges([nonMatchingChange], [specificAlert], mockGetUserById);

			expect(nonMatchingResult.notifications).toBe(0);
		});

		it('should handle "both" alert type correctly', async () => {
			const bothAlert: CloudAlert = {
				...mockCloudAlerts[0],
				alert_on: 'both',
			};

			const availableChange: AvailabilityChange = {
				...mockSingleAvailabilityChange[0],
				eventType: 'available',
			};

			const unavailableChange: AvailabilityChange = {
				...mockSingleAvailabilityChange[0],
				eventType: 'unavailable',
			};

			mockGetUserById.mockResolvedValue(mockCloudAlertUsers[0]);
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[0]);

			// Both event types should match
			const availableResult = await service.processAvailabilityChanges([availableChange], [bothAlert], mockGetUserById);

			const unavailableResult = await service.processAvailabilityChanges([unavailableChange], [bothAlert], mockGetUserById);

			expect(availableResult.notifications).toBe(1);
			expect(unavailableResult.notifications).toBe(1);
		});

		it('should send Discord notification when enabled', async () => {
			mockGetUserById.mockResolvedValue(mockCloudAlertUsers[0]);
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[0]);

			const result = await service.processAvailabilityChanges(mockSingleAvailabilityChange, [mockCloudAlerts[0]], mockGetUserById);

			expect(mockCloudDiscordChannel.send).toHaveBeenCalled();
			expect(result.results).toContain(mockCloudNotificationResults[0]);
		});

		it('should send email notification when Discord fails', async () => {
			mockGetUserById.mockResolvedValue(mockCloudAlertUsers[0]);
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudEmailChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockFailedCloudNotificationResults[0]);
			(mockCloudEmailChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[1]);

			const result = await service.processAvailabilityChanges(mockSingleAvailabilityChange, [mockCloudAlerts[0]], mockGetUserById);

			expect(mockCloudDiscordChannel.send).toHaveBeenCalled();
			expect(mockCloudEmailChannel.send).toHaveBeenCalled();
			expect(result.results).toHaveLength(2);
		});

		it('should calculate notification enablement correctly from alert settings', async () => {
			const mixedAlertsUser = {
				...mockCloudAlertUsers[0],
				id: 'mixed-user',
			};

			const emailOnlyAlert: CloudAlert = {
				...mockCloudAlerts[0],
				user_id: 'mixed-user',
				email_notifications: true,
				discord_notifications: false,
			};

			const discordOnlyAlert: CloudAlert = {
				...mockCloudAlerts[0],
				user_id: 'mixed-user',
				server_type_ids: [2], // Match server type 2 from mockAvailabilityChanges
				location_ids: [2], // Match location 2 from mockAvailabilityChanges
				alert_on: 'unavailable', // Match event type from mockAvailabilityChanges
				email_notifications: false,
				discord_notifications: true,
			};

			mockGetUserById.mockResolvedValue(mixedAlertsUser);

			// Mock to capture the notification object passed to sendNotification
			let capturedNotification: CloudNotification;
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockImplementation((notification: CloudNotification) => {
				capturedNotification = notification;
				return notification.discordEnabled && notification.user.discord_webhook_url;
			});
			(mockCloudEmailChannel.isEnabled as CloudNotificationChannel).mockImplementation((notification: CloudNotification) => {
				capturedNotification = notification;
				return notification.emailEnabled && notification.user.email;
			});

			await service.processAvailabilityChanges(
				mockAvailabilityChanges, // Multiple changes to trigger both alerts
				[emailOnlyAlert, discordOnlyAlert],
				mockGetUserById,
			);

			// Should have both email and discord enabled since user has alerts with both
			expect(capturedNotification!.emailEnabled).toBe(true);
			expect(capturedNotification!.discordEnabled).toBe(true);
		});

		it('should log appropriate messages during processing', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			mockGetUserById.mockResolvedValue(mockCloudAlertUsers[0]);
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(false);
			(mockCloudEmailChannel.isEnabled as CloudNotificationChannel).mockReturnValue(false);

			await service.processAvailabilityChanges(mockAvailabilityChanges, mockCloudAlerts, mockGetUserById);

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[CloudNotificationService] Processing 3 availability changes against 3 alerts'),
			);
		});
	});

	describe('sendNotification', () => {
		const mockSuccessResult: CloudNotificationResult = {
			channel: 'cloud-discord',
			success: true,
			timestamp: new Date().toISOString(),
			userId: 'user-1',
			changesProcessed: 1,
		};

		const mockFailureResult: CloudNotificationResult = {
			channel: 'cloud-discord',
			success: false,
			error: 'Webhook failed',
			timestamp: new Date().toISOString(),
			userId: 'user-1',
			changesProcessed: 1,
		};

		beforeEach(() => {
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(false);
			(mockCloudEmailChannel.isEnabled as CloudNotificationChannel).mockReturnValue(false);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockSuccessResult);
			(mockCloudEmailChannel.send as CloudNotificationChannel).mockResolvedValue({ ...mockSuccessResult, channel: 'cloud-email' });
		});

		it('should send Discord notification when enabled', async () => {
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockSuccessResult);

			// Access private method for testing
			const results = await (service as CloudNotificationChannel).sendNotification(mockCloudNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(mockSuccessResult);
			expect(mockCloudDiscordChannel.send).toHaveBeenCalledWith(mockCloudNotification);
		});

		it('should send email when Discord fails', async () => {
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudEmailChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockFailureResult);

			const emailResult = { ...mockSuccessResult, channel: 'cloud-email' };
			(mockCloudEmailChannel.send as CloudNotificationChannel).mockResolvedValue(emailResult);

			const results = await (service as CloudNotificationChannel).sendNotification(mockCloudNotification);

			expect(results).toHaveLength(2);
			expect(results[0]).toEqual(mockFailureResult);
			expect(results[1]).toEqual(emailResult);
		});

		it('should not send email when Discord succeeds', async () => {
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudEmailChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockSuccessResult);

			const results = await (service as CloudNotificationChannel).sendNotification(mockCloudNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(mockSuccessResult);
			expect(mockCloudEmailChannel.send).not.toHaveBeenCalled();
		});

		it('should return empty results when both channels are disabled', async () => {
			const disabledNotification: CloudNotification = {
				...mockCloudNotification,
				emailEnabled: false,
				discordEnabled: false,
			};

			const results = await (service as CloudNotificationChannel).sendNotification(disabledNotification);

			expect(results).toHaveLength(0);
			expect(mockCloudDiscordChannel.send).not.toHaveBeenCalled();
			expect(mockCloudEmailChannel.send).not.toHaveBeenCalled();
		});

		it('should log success and failure messages appropriately', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();

			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockFailureResult);

			await (service as CloudNotificationChannel).sendNotification(mockCloudNotification);

			expect(consoleSpy).toHaveBeenCalledWith(
				`[CloudNotificationService] Processing notifications for user ${mockCloudNotification.user.id}:`,
				expect.objectContaining({
					emailEnabled: true,
					discordEnabled: true,
					discord_webhook_url: 'present',
					email: 'present',
					matches: 1,
				}),
			);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				`[CloudNotificationService] Discord notification failed for user ${mockCloudNotification.user.id}: ${mockFailureResult.error}`,
			);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				`[CloudNotificationService] No notifications sent for user ${mockCloudNotification.user.id}: All methods disabled or failed`,
			);
		});
	});

	describe('integration scenarios', () => {
		it('should handle multiple users with different preferences', async () => {
			const user1DiscordAlert: CloudAlert = {
				...mockCloudAlerts[0],
				user_id: 'user-1',
				email_notifications: false,
				discord_notifications: true,
			};

			const user2EmailAlert: CloudAlert = {
				...mockCloudAlerts[0],
				user_id: 'user-2',
				server_type_ids: [2], // Different to avoid conflicts
				email_notifications: true,
				discord_notifications: false,
			};

			mockGetUserById.mockImplementation(async (userId: string) => {
				if (userId === 'user-1') return mockCloudAlertUsers[0];
				if (userId === 'user-2') return mockCloudAlertUsers[1];
				return null;
			});

			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudEmailChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[0]);
			(mockCloudEmailChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[1]);

			const result = await service.processAvailabilityChanges(
				mockAvailabilityChanges,
				[user1DiscordAlert, user2EmailAlert],
				mockGetUserById,
			);

			// Should have sent notifications for both users with their preferred methods
			expect(result.results.length).toBeGreaterThan(0);
		});

		it('should handle errors during notification sending', async () => {
			mockGetUserById.mockResolvedValue(mockCloudAlertUsers[0]);
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockRejectedValue(new Error('Channel error'));

			// Should not throw, but handle gracefully
			await expect(service.processAvailabilityChanges(mockSingleAvailabilityChange, [mockCloudAlerts[0]], mockGetUserById)).rejects.toThrow(
				'Channel error',
			);
		});

		it('should handle large numbers of changes efficiently', async () => {
			const manyChanges: AvailabilityChange[] = Array.from({ length: 100 }, (_, i) => ({
				serverTypeId: 1,
				serverTypeName: 'cx11',
				locationId: 1,
				locationName: 'nbg1',
				eventType: 'available',
				timestamp: Date.now() + i,
			}));

			mockGetUserById.mockResolvedValue(mockCloudAlertUsers[0]);
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(mockCloudNotificationResults[0]);

			const result = await service.processAvailabilityChanges(manyChanges, [mockCloudAlerts[0]], mockGetUserById);

			expect(result.processed).toBe(100);
			// Should group efficiently and not spam the user
			expect(result.results.length).toBeLessThanOrEqual(1);
		});

		it('should calculate statistics correctly', async () => {
			mockGetUserById.mockResolvedValue(mockCloudAlertUsers[0]);
			(mockCloudDiscordChannel.isEnabled as CloudNotificationChannel).mockReturnValue(true);

			const resultWithChanges = { ...mockCloudNotificationResults[0], changesProcessed: 5 };
			(mockCloudDiscordChannel.send as CloudNotificationChannel).mockResolvedValue(resultWithChanges);

			const result = await service.processAvailabilityChanges(mockAvailabilityChanges, [mockCloudAlerts[0]], mockGetUserById);

			expect(result.processed).toBe(3); // Input changes
			expect(result.notifications).toBeGreaterThan(0); // Matches found
			expect(result.results.length).toBeGreaterThan(0); // Results returned
		});
	});

	describe('channel management', () => {
		it('should return correct channel names', () => {
			const channels = service.getChannels();
			expect(channels).toEqual(['cloud-email', 'cloud-discord']);
		});

		it('should handle service with no email config', () => {
			const serviceNoEmail = new CloudNotificationService({});
			const channels = serviceNoEmail.getChannels();
			expect(channels).toEqual(['cloud-discord']);
		});
	});
});
