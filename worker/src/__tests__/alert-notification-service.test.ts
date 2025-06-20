/**
 * Tests for AlertNotificationService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertNotificationService, type NotificationServiceConfig } from '../notifications/alert-notification-service';
import type { NotificationChannel, AlertNotification, NotificationResult } from '../notifications/notification-channel';
import {
	mockAlertInfo,
	mockAlertInfoEmailOnly,
	mockAlertInfoDiscordOnly,
	mockAlertInfoNoNotifications,
	mockAlertNotification,
} from './fixtures/alert-data';

// Mock notification channels
const mockDiscordChannel: NotificationChannel = {
	name: 'discord',
	isEnabled: vi.fn(),
	send: vi.fn(),
};

const mockEmailChannel: NotificationChannel = {
	name: 'email',
	isEnabled: vi.fn(),
	send: vi.fn(),
};

// Mock the channel modules
vi.mock('../notifications/email-channel', () => ({
	EmailChannel: vi.fn().mockImplementation(() => mockEmailChannel),
}));

vi.mock('../notifications/discord-channel', () => ({
	DiscordChannel: vi.fn().mockImplementation(() => mockDiscordChannel),
}));

describe('AlertNotificationService', () => {
	let service: AlertNotificationService;
	const mockEmailConfig = {
		apiKey: 'test-key',
		fromName: 'Test Radar',
		fromEmail: 'alerts@test.com',
	};

	beforeEach(() => {
		service = new AlertNotificationService({ email: mockEmailConfig });
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with email and discord channels when email config provided', () => {
			const channels = service.getChannels();
			expect(channels).toContain('email');
			expect(channels).toContain('discord');
			expect(channels).toHaveLength(2);
		});

		it('should initialize with only discord channel when no email config provided', () => {
			const serviceWithoutEmail = new AlertNotificationService({});
			const channels = serviceWithoutEmail.getChannels();
			expect(channels).toContain('discord');
			expect(channels).not.toContain('email');
			expect(channels).toHaveLength(1);
		});
	});

	describe('sendNotification', () => {
		const mockSuccessResult: NotificationResult = {
			channel: 'discord',
			success: true,
			timestamp: new Date().toISOString(),
		};

		const mockFailureResult: NotificationResult = {
			channel: 'discord',
			success: false,
			error: 'Webhook failed',
			timestamp: new Date().toISOString(),
		};

		beforeEach(() => {
			// Set default mock behavior
			(mockDiscordChannel.isEnabled as any).mockReturnValue(false);
			(mockEmailChannel.isEnabled as any).mockReturnValue(false);
			(mockDiscordChannel.send as any).mockResolvedValue(mockSuccessResult);
			(mockEmailChannel.send as any).mockResolvedValue({ ...mockSuccessResult, channel: 'email' });
		});

		it('should send Discord notification when enabled and available', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(true);
			(mockDiscordChannel.send as any).mockResolvedValue(mockSuccessResult);

			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(mockSuccessResult);
			expect(mockDiscordChannel.send).toHaveBeenCalledWith(mockAlertNotification);
			expect(mockEmailChannel.send).not.toHaveBeenCalled();
		});

		it('should send email notification when Discord fails', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(true);
			(mockEmailChannel.isEnabled as any).mockReturnValue(true);
			(mockDiscordChannel.send as any).mockResolvedValue(mockFailureResult);

			const emailResult = { ...mockSuccessResult, channel: 'email' };
			(mockEmailChannel.send as any).mockResolvedValue(emailResult);

			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(2);
			expect(results[0]).toEqual(mockFailureResult);
			expect(results[1]).toEqual(emailResult);
			expect(mockDiscordChannel.send).toHaveBeenCalledWith(mockAlertNotification);
			expect(mockEmailChannel.send).toHaveBeenCalledWith(mockAlertNotification);
		});

		it('should send email notification when Discord is disabled', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(false);
			(mockEmailChannel.isEnabled as any).mockReturnValue(true);

			const emailResult = { ...mockSuccessResult, channel: 'email' };
			(mockEmailChannel.send as any).mockResolvedValue(emailResult);

			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(emailResult);
			expect(mockDiscordChannel.send).not.toHaveBeenCalled();
			expect(mockEmailChannel.send).toHaveBeenCalledWith(mockAlertNotification);
		});

		it('should not send email when Discord succeeds', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(true);
			(mockEmailChannel.isEnabled as any).mockReturnValue(true);
			(mockDiscordChannel.send as any).mockResolvedValue(mockSuccessResult);

			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(mockSuccessResult);
			expect(mockDiscordChannel.send).toHaveBeenCalledWith(mockAlertNotification);
			expect(mockEmailChannel.send).not.toHaveBeenCalled();
		});

		it('should return empty results when both channels are disabled', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(false);
			(mockEmailChannel.isEnabled as any).mockReturnValue(false);

			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(0);
			expect(mockDiscordChannel.send).not.toHaveBeenCalled();
			expect(mockEmailChannel.send).not.toHaveBeenCalled();
		});

		it('should handle email-only notifications correctly', async () => {
			const emailOnlyNotification: AlertNotification = {
				...mockAlertNotification,
				alert: mockAlertInfoEmailOnly,
			};

			(mockDiscordChannel.isEnabled as any).mockReturnValue(false);
			(mockEmailChannel.isEnabled as any).mockReturnValue(true);

			const emailResult = { ...mockSuccessResult, channel: 'email' };
			(mockEmailChannel.send as any).mockResolvedValue(emailResult);

			const results = await service.sendNotification(emailOnlyNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(emailResult);
			expect(mockEmailChannel.send).toHaveBeenCalledWith(emailOnlyNotification);
		});

		it('should handle discord-only notifications correctly', async () => {
			const discordOnlyNotification: AlertNotification = {
				...mockAlertNotification,
				alert: mockAlertInfoDiscordOnly,
			};

			(mockDiscordChannel.isEnabled as any).mockReturnValue(true);
			(mockEmailChannel.isEnabled as any).mockReturnValue(false);
			(mockDiscordChannel.send as any).mockResolvedValue(mockSuccessResult);

			const results = await service.sendNotification(discordOnlyNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(mockSuccessResult);
			expect(mockDiscordChannel.send).toHaveBeenCalledWith(discordOnlyNotification);
		});

		it('should return both failed results when both channels fail', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(true);
			(mockEmailChannel.isEnabled as any).mockReturnValue(true);

			const discordFailure = { ...mockFailureResult, channel: 'discord', error: 'Discord failed' };
			const emailFailure = { ...mockFailureResult, channel: 'email', error: 'Email failed' };

			(mockDiscordChannel.send as any).mockResolvedValue(discordFailure);
			(mockEmailChannel.send as any).mockResolvedValue(emailFailure);

			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(2);
			expect(results[0]).toEqual(discordFailure);
			expect(results[1]).toEqual(emailFailure);
		});

		it('should log appropriate messages during processing', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();

			(mockDiscordChannel.isEnabled as any).mockReturnValue(false);
			(mockEmailChannel.isEnabled as any).mockReturnValue(false);

			await service.sendNotification(mockAlertNotification);

			// Should log processing start
			expect(consoleSpy).toHaveBeenCalledWith(
				`[AlertNotificationService] Processing notifications for alert ${mockAlertInfo.id}:`,
				expect.objectContaining({
					discord_notifications: mockAlertInfo.discord_notifications,
					email_notifications: mockAlertInfo.email_notifications,
					discord_webhook_url: 'present',
					email: 'present',
				}),
			);

			// Should log Discord skip
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(`[AlertNotificationService] Discord notification skipped for alert ${mockAlertInfo.id}`),
			);

			// Should warn about no notifications sent
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				`[AlertNotificationService] No notifications sent for alert ${mockAlertInfo.id}: All methods disabled or failed`,
			);
		});

		it('should log success messages correctly', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			(mockDiscordChannel.isEnabled as any).mockReturnValue(true);
			(mockDiscordChannel.send as any).mockResolvedValue(mockSuccessResult);

			await service.sendNotification(mockAlertNotification);

			expect(consoleSpy).toHaveBeenCalledWith(
				`[AlertNotificationService] Discord notification sent successfully for alert ${mockAlertInfo.id}`,
			);
		});

		it('should log error messages correctly', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

			(mockDiscordChannel.isEnabled as any).mockReturnValue(true);
			(mockDiscordChannel.send as any).mockResolvedValue(mockFailureResult);

			await service.sendNotification(mockAlertNotification);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				`[AlertNotificationService] Discord notification failed for alert ${mockAlertInfo.id}: ${mockFailureResult.error}`,
			);
		});

		it('should handle missing webhook URL correctly in logs', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			const noWebhookNotification: AlertNotification = {
				...mockAlertNotification,
				alert: { ...mockAlertInfo, discord_webhook_url: null },
			};

			(mockDiscordChannel.isEnabled as any).mockReturnValue(false);

			await service.sendNotification(noWebhookNotification);

			expect(consoleSpy).toHaveBeenCalledWith(
				`[AlertNotificationService] Processing notifications for alert ${mockAlertInfo.id}:`,
				expect.objectContaining({
					discord_webhook_url: 'missing',
				}),
			);

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('no webhook URL'));
		});

		it('should handle missing email correctly in logs', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			const noEmailNotification: AlertNotification = {
				...mockAlertNotification,
				alert: { ...mockAlertInfo, email: null },
			};

			await service.sendNotification(noEmailNotification);

			expect(consoleSpy).toHaveBeenCalledWith(
				`[AlertNotificationService] Processing notifications for alert ${mockAlertInfo.id}:`,
				expect.objectContaining({
					email: 'missing',
				}),
			);
		});
	});

	describe('fallback logic edge cases', () => {
		it('should send email when Discord channel is not available', async () => {
			// Create service without any channels, then manually test the scenario
			const serviceWithoutDiscord = new AlertNotificationService({ email: mockEmailConfig });

			// Mock the channels array to not include discord
			const emailOnlyChannels = [mockEmailChannel];
			(serviceWithoutDiscord as any).channels = emailOnlyChannels;

			(mockEmailChannel.isEnabled as any).mockReturnValue(true);
			const emailResult = { channel: 'email', success: true, timestamp: new Date().toISOString() };
			(mockEmailChannel.send as any).mockResolvedValue(emailResult);

			const results = await serviceWithoutDiscord.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(emailResult);
		});

		it('should handle channel send method throwing errors', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(true);
			(mockEmailChannel.isEnabled as any).mockReturnValue(true);
			(mockDiscordChannel.send as any).mockRejectedValue(new Error('Discord channel crashed'));

			const emailResult = { channel: 'email', success: true, timestamp: new Date().toISOString() };
			(mockEmailChannel.send as any).mockResolvedValue(emailResult);

			// Should not throw and should still try email
			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(2);
			expect(results[0]).toEqual({
				channel: 'discord',
				success: false,
				error: 'Discord channel crashed',
				timestamp: expect.any(String),
			});
			expect(results[1]).toEqual(emailResult);
		});

		it('should handle email channel send method throwing errors', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(false);
			(mockEmailChannel.isEnabled as any).mockReturnValue(true);
			(mockEmailChannel.send as any).mockRejectedValue(new Error('Email channel crashed'));

			// Should not throw and should return error result
			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				channel: 'email',
				success: false,
				error: 'Email channel crashed',
				timestamp: expect.any(String),
			});
		});
	});

	describe('channel management', () => {
		it('should return correct channel names', () => {
			const channels = service.getChannels();
			expect(channels).toEqual(['email', 'discord']);
		});

		it('should handle service with no email config', () => {
			const serviceNoEmail = new AlertNotificationService({});
			const channels = serviceNoEmail.getChannels();
			expect(channels).toEqual(['discord']);
		});
	});

	describe('real-world scenarios', () => {
		it('should handle Discord webhook URL rate limiting scenario', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(true);
			(mockEmailChannel.isEnabled as any).mockReturnValue(true);

			const rateLimitResult: NotificationResult = {
				channel: 'discord',
				success: false,
				error: 'Rate limited',
				timestamp: new Date().toISOString(),
			};

			(mockDiscordChannel.send as any).mockResolvedValue(rateLimitResult);
			const emailResult = { channel: 'email', success: true, timestamp: new Date().toISOString() };
			(mockEmailChannel.send as any).mockResolvedValue(emailResult);

			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(2);
			expect(results[0]).toEqual(rateLimitResult);
			expect(results[1]).toEqual(emailResult);
		});

		it('should handle email API service outage scenario', async () => {
			(mockDiscordChannel.isEnabled as any).mockReturnValue(false);
			(mockEmailChannel.isEnabled as any).mockReturnValue(true);

			const emailFailure: NotificationResult = {
				channel: 'email',
				success: false,
				error: 'Service unavailable',
				timestamp: new Date().toISOString(),
			};

			(mockEmailChannel.send as any).mockResolvedValue(emailFailure);

			const results = await service.sendNotification(mockAlertNotification);

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(emailFailure);
		});

		it('should handle user with incomplete notification settings', async () => {
			const incompleteAlert = {
				...mockAlertInfo,
				discord_notifications: true,
				discord_webhook_url: null,
				email_notifications: false,
				email: 'user@example.com',
			};

			const incompleteNotification: AlertNotification = {
				...mockAlertNotification,
				alert: incompleteAlert,
			};

			(mockDiscordChannel.isEnabled as any).mockReturnValue(false);
			(mockEmailChannel.isEnabled as any).mockReturnValue(false);

			const results = await service.sendNotification(incompleteNotification);

			expect(results).toHaveLength(0);
		});
	});
});
