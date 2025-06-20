/**
 * Tests for Notification Channels (Email and Discord)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailChannel, type EmailChannelConfig } from '../notifications/email-channel';
import { DiscordChannel } from '../notifications/discord-channel';
import { mockAlertInfo, mockAlertInfoEmailOnly, mockAlertInfoNoNotifications, mockAlertNotification } from './fixtures/alert-data';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EmailChannel', () => {
	let emailChannel: EmailChannel;
	const mockConfig: EmailChannelConfig = {
		apiKey: 'test-api-key',
		fromName: 'Server Radar',
		fromEmail: 'alerts@radar.iodev.org',
		apiUrl: 'https://api.forwardemail.net/v1/emails',
	};

	beforeEach(() => {
		emailChannel = new EmailChannel(mockConfig);
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with default API URL when not provided', () => {
			const configWithoutUrl = { ...mockConfig };
			delete (configWithoutUrl as any).apiUrl;

			const channel = new EmailChannel(configWithoutUrl);
			expect(channel).toBeInstanceOf(EmailChannel);
			expect(channel.name).toBe('email');
		});

		it('should use custom API URL when provided', () => {
			const customConfig = { ...mockConfig, apiUrl: 'https://custom.api.com' };
			const channel = new EmailChannel(customConfig);
			expect(channel).toBeInstanceOf(EmailChannel);
		});
	});

	describe('isEnabled', () => {
		it('should return true when email notifications are enabled and email is present', () => {
			expect(emailChannel.isEnabled(mockAlertInfo)).toBe(true);
		});

		it('should return false when email notifications are disabled', () => {
			const alertWithoutEmail = { ...mockAlertInfo, email_notifications: false };
			expect(emailChannel.isEnabled(alertWithoutEmail)).toBe(false);
		});

		it('should return false when email address is missing', () => {
			const alertWithoutEmail = { ...mockAlertInfo, email: null };
			expect(emailChannel.isEnabled(alertWithoutEmail)).toBe(false);
		});

		it('should return false when email address is empty string', () => {
			const alertWithoutEmail = { ...mockAlertInfo, email: '' };
			expect(emailChannel.isEnabled(alertWithoutEmail)).toBe(false);
		});

		it('should default to true when email_notifications is null/undefined', () => {
			const alertWithNullNotifications = { ...mockAlertInfo, email_notifications: null };
			expect(emailChannel.isEnabled(alertWithNullNotifications as any)).toBe(true);
		});
	});

	describe('send', () => {
		it('should send email successfully with correct format', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			const result = await emailChannel.send(mockAlertNotification);

			expect(result).toEqual({
				channel: 'email',
				success: true,
				timestamp: expect.any(String),
			});

			// Verify fetch was called with correct parameters
			expect(mockFetch).toHaveBeenCalledWith(
				mockConfig.apiUrl,
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						Authorization: expect.stringContaining('Basic'),
						'Content-Type': 'application/x-www-form-urlencoded',
					}),
					body: expect.any(URLSearchParams),
				}),
			);

			// Verify Authorization header contains base64 encoded API key
			const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
			expect(authHeader).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
		});

		it('should format email body correctly', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			await emailChannel.send(mockAlertNotification);

			const requestBody = mockFetch.mock.calls[0][1].body as URLSearchParams;

			expect(requestBody.get('from')).toBe('"Server Radar" <alerts@radar.iodev.org>');
			expect(requestBody.get('to')).toBe(mockAlertInfo.email);
			expect(requestBody.get('subject')).toBe('Price Alert: Target Price Reached');

			const emailText = requestBody.get('text');
			expect(emailText).toContain(mockAlertInfo.name);
			expect(emailText).toContain(mockAlertInfo.price.toFixed(2));
			expect(emailText).toContain(mockAlertNotification.triggerPrice.toFixed(2));
			expect(emailText).toContain(`${mockAlertInfo.vat_rate}% VAT`);
			expect(emailText).toContain('https://radar.iodev.org/alerts?view=1');
		});

		it('should include IPv4 cost in email when applicable', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			const notificationWithIpv4 = {
				...mockAlertNotification,
				alert: { ...mockAlertInfo, includes_ipv4_cost: true },
			};

			await emailChannel.send(notificationWithIpv4);

			const requestBody = mockFetch.mock.calls[0][1].body as URLSearchParams;
			const emailText = requestBody.get('text');
			expect(emailText).toContain('and IPv4 cost');
		});

		it('should handle email API errors gracefully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: async () => 'Invalid email address',
			});

			const result = await emailChannel.send(mockAlertNotification);

			expect(result).toEqual({
				channel: 'email',
				success: false,
				error: 'Email API error: 400 - Invalid email address',
				timestamp: expect.any(String),
			});
		});

		it('should handle network errors gracefully', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await emailChannel.send(mockAlertNotification);

			expect(result).toEqual({
				channel: 'email',
				success: false,
				error: 'Network error',
				timestamp: expect.any(String),
			});
		});

		it('should return error when email is disabled', async () => {
			const disabledNotification = {
				...mockAlertNotification,
				alert: mockAlertInfoNoNotifications,
			};

			const result = await emailChannel.send(disabledNotification);

			expect(result).toEqual({
				channel: 'email',
				success: false,
				error: 'Email notifications disabled or no email address',
				timestamp: expect.any(String),
			});

			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('should format from field correctly with name', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			await emailChannel.send(mockAlertNotification);

			const requestBody = mockFetch.mock.calls[0][1].body as URLSearchParams;
			expect(requestBody.get('from')).toBe('"Server Radar" <alerts@radar.iodev.org>');
		});

		it('should format from field correctly without name', async () => {
			const configWithoutName = { ...mockConfig };
			delete (configWithoutName as any).fromName;

			const channelWithoutName = new EmailChannel(configWithoutName);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			await channelWithoutName.send(mockAlertNotification);

			const requestBody = mockFetch.mock.calls[0][1].body as URLSearchParams;
			expect(requestBody.get('from')).toBe('alerts@radar.iodev.org');
		});

		it('should log errors appropriately', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

			mockFetch.mockRejectedValueOnce(new Error('API timeout'));

			await emailChannel.send(mockAlertNotification);

			expect(consoleSpy).toHaveBeenCalledWith(
				`[EmailChannel] Failed to send notification for alert ${mockAlertInfo.id}:`,
				expect.any(Error),
			);
		});
	});
});

describe('DiscordChannel', () => {
	let discordChannel: DiscordChannel;

	beforeEach(() => {
		discordChannel = new DiscordChannel();
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize correctly', () => {
			expect(discordChannel).toBeInstanceOf(DiscordChannel);
			expect(discordChannel.name).toBe('discord');
		});
	});

	describe('isEnabled', () => {
		it('should return true when Discord notifications are enabled and webhook URL is present', () => {
			expect(discordChannel.isEnabled(mockAlertInfo)).toBe(true);
		});

		it('should return false when Discord notifications are disabled', () => {
			const alertWithoutDiscord = { ...mockAlertInfo, discord_notifications: false };
			expect(discordChannel.isEnabled(alertWithoutDiscord)).toBe(false);
		});

		it('should return false when webhook URL is missing', () => {
			const alertWithoutWebhook = { ...mockAlertInfo, discord_webhook_url: null };
			expect(discordChannel.isEnabled(alertWithoutWebhook)).toBe(false);
		});

		it('should return false when webhook URL is empty string', () => {
			const alertWithoutWebhook = { ...mockAlertInfo, discord_webhook_url: '' };
			expect(discordChannel.isEnabled(alertWithoutWebhook)).toBe(false);
		});

		it('should default to false when discord_notifications is null/undefined', () => {
			const alertWithNullNotifications = { ...mockAlertInfo, discord_notifications: null };
			expect(discordChannel.isEnabled(alertWithNullNotifications as any)).toBe(false);
		});
	});

	describe('send', () => {
		it('should send Discord webhook successfully with correct embed format', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			const result = await discordChannel.send(mockAlertNotification);

			expect(result).toEqual({
				channel: 'discord',
				success: true,
				timestamp: expect.any(String),
			});

			// Verify fetch was called with correct parameters
			expect(mockFetch).toHaveBeenCalledWith(
				mockAlertInfo.discord_webhook_url,
				expect.objectContaining({
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: expect.any(String),
				}),
			);

			// Verify embed structure
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.embeds).toHaveLength(1);

			const embed = requestBody.embeds[0];
			expect(embed.title).toContain(mockAlertInfo.name);
			expect(embed.description).toContain('target price has been reached');
			expect(embed.color).toBe(0x00ff00); // Green
			expect(embed.fields).toHaveLength(4);
			expect(embed.footer.text).toBe('Server Radar • Price Alert');
			expect(embed.url).toContain(`alerts?view=${mockAlertInfo.id}`);
		});

		it('should format embed fields correctly', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			await discordChannel.send(mockAlertNotification);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			const fields = requestBody.embeds[0].fields;

			// Target Price field
			expect(fields[0].name).toBe('🎯 Target Price');
			expect(fields[0].value).toBe(`€${mockAlertInfo.price.toFixed(2)} (incl. ${mockAlertInfo.vat_rate}% VAT)`);
			expect(fields[0].inline).toBe(true);

			// Trigger Price field
			expect(fields[1].name).toBe('💰 Trigger Price');
			expect(fields[1].value).toBe(`€${mockAlertNotification.triggerPrice.toFixed(2)} (incl. ${mockAlertInfo.vat_rate}% VAT)`);
			expect(fields[1].inline).toBe(true);

			// Savings field
			expect(fields[2].name).toBe('💾 Savings');
			const expectedSavings = mockAlertInfo.price - mockAlertNotification.triggerPrice;
			expect(fields[2].value).toBe(`€${expectedSavings.toFixed(2)}`);
			expect(fields[2].inline).toBe(true);

			// View Auction field
			expect(fields[3].name).toBe('🔗 View Auction');
			expect(fields[3].value).toContain(`https://radar.iodev.org/alerts?view=${mockAlertInfo.id}`);
			expect(fields[3].inline).toBe(false);
		});

		it('should handle webhook errors gracefully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				text: async () => 'Invalid webhook URL',
			});

			const result = await discordChannel.send(mockAlertNotification);

			expect(result).toEqual({
				channel: 'discord',
				success: false,
				error: 'Webhook request failed',
				timestamp: expect.any(String),
			});
		});

		it('should handle network errors gracefully', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

			const result = await discordChannel.send(mockAlertNotification);

			// Discord channel catches network errors in sendWebhook and returns generic message
			expect(result).toEqual({
				channel: 'discord',
				success: false,
				error: 'Webhook request failed',
				timestamp: expect.any(String),
			});
		});

		it('should return error when Discord is disabled', async () => {
			const disabledNotification = {
				...mockAlertNotification,
				alert: mockAlertInfoEmailOnly,
			};

			const result = await discordChannel.send(disabledNotification);

			expect(result).toEqual({
				channel: 'discord',
				success: false,
				error: 'Discord notifications disabled or no webhook URL',
				timestamp: expect.any(String),
			});

			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('should log webhook attempts and errors appropriately', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				text: async () => 'Webhook not found',
			});

			await discordChannel.send(mockAlertNotification);

			// Should log webhook attempt
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DiscordChannel] Sending webhook to:'));

			// Should log error details
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[DiscordChannel] Webhook returned status 404'));
		});

		it('should handle webhook response body reading errors', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				text: async () => {
					throw new Error('Cannot read response');
				},
			});

			await discordChannel.send(mockAlertNotification);

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[DiscordChannel] Could not read error response body'));
		});

		it('should mask webhook URL in logs for security', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

			// Use a longer webhook URL to test masking
			const longWebhookNotification = {
				...mockAlertNotification,
				alert: {
					...mockAlertInfo,
					discord_webhook_url: 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz',
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			await discordChannel.send(longWebhookNotification);

			// Should only log first 50 characters of webhook URL
			const logCall = consoleSpy.mock.calls[0][0];
			expect(logCall).toContain('...');
			expect(logCall).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz');
		});

		it('should include correct timestamp in embed', async () => {
			const beforeTime = Date.now();

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			await discordChannel.send(mockAlertNotification);

			const afterTime = Date.now();
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			const embedTimestamp = requestBody.embeds[0].timestamp;
			const embedTime = new Date(embedTimestamp).getTime();

			expect(embedTime).toBeGreaterThanOrEqual(beforeTime);
			expect(embedTime).toBeLessThanOrEqual(afterTime);
		});
	});
});
