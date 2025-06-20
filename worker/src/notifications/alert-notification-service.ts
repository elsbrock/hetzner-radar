/**
 * Alert Notification Service
 *
 * Orchestrates notification delivery across multiple channels
 * Handles fallback logic and ensures at least one notification is sent
 */

import type { NotificationChannel, AlertNotification, NotificationResult } from './notification-channel';
import { EmailChannel, type EmailChannelConfig } from './email-channel';
import { DiscordChannel } from './discord-channel';

export interface NotificationServiceConfig {
	email?: EmailChannelConfig;
}

export class AlertNotificationService {
	private channels: NotificationChannel[];

	constructor(config: NotificationServiceConfig) {
		this.channels = [];

		// Initialize email channel if configured
		if (config.email) {
			this.channels.push(new EmailChannel(config.email));
		}

		// Discord channel doesn't need config - uses webhook URL from alert
		this.channels.push(new DiscordChannel());
	}

	/**
	 * Send alert notification through all enabled channels
	 * Implements fallback logic: if Discord fails or is disabled, send email
	 */
	async sendNotification(notification: AlertNotification): Promise<NotificationResult[]> {
		const results: NotificationResult[] = [];
		const alert = notification.alert;

		// Log notification attempt
		console.log(`[AlertNotificationService] Processing notifications for alert ${alert.id}:`, {
			discord_notifications: alert.discord_notifications,
			email_notifications: alert.email_notifications,
			discord_webhook_url: alert.discord_webhook_url ? 'present' : 'missing',
			email: alert.email ? 'present' : 'missing',
		});

		// Determine which channels should be used
		const discordChannel = this.channels.find((c) => c.name === 'discord');
		const emailChannel = this.channels.find((c) => c.name === 'email');

		// Try Discord first if enabled
		let discordSent = false;
		if (discordChannel && discordChannel.isEnabled(alert)) {
			try {
				const result = await discordChannel.send(notification);
				results.push(result);
				discordSent = result.success;

				if (discordSent) {
					console.log(`[AlertNotificationService] Discord notification sent successfully for alert ${alert.id}`);
				} else {
					console.error(`[AlertNotificationService] Discord notification failed for alert ${alert.id}: ${result.error}`);
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				console.error(`[AlertNotificationService] Discord channel threw error for alert ${alert.id}: ${errorMessage}`);
				results.push({
					channel: 'discord',
					success: false,
					error: errorMessage,
					timestamp: new Date().toISOString(),
				});
			}
		} else {
			console.log(
				`[AlertNotificationService] Discord notification skipped for alert ${alert.id}: ${
					!alert.discord_notifications ? 'disabled' : 'no webhook URL'
				}`,
			);
		}

		// Send email if enabled AND (Discord wasn't sent OR Discord failed)
		if (emailChannel && emailChannel.isEnabled(alert) && !discordSent) {
			try {
				const result = await emailChannel.send(notification);
				results.push(result);

				if (result.success) {
					console.log(`[AlertNotificationService] Email notification sent for alert ${alert.id}`);
				} else {
					console.error(`[AlertNotificationService] Email notification failed for alert ${alert.id}: ${result.error}`);
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				console.error(`[AlertNotificationService] Email channel threw error for alert ${alert.id}: ${errorMessage}`);
				results.push({
					channel: 'email',
					success: false,
					error: errorMessage,
					timestamp: new Date().toISOString(),
				});
			}
		}

		// Check if any notification was sent
		const anySent = results.some((r) => r.success);
		if (!anySent) {
			console.warn(`[AlertNotificationService] No notifications sent for alert ${alert.id}: All methods disabled or failed`);
		}

		return results;
	}

	/**
	 * Get available notification channels
	 */
	getChannels(): string[] {
		return this.channels.map((c) => c.name);
	}
}
