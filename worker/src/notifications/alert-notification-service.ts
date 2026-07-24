/**
 * Alert Notification Service
 *
 * Orchestrates notification delivery across multiple channels.
 * Instant channels (Discord, webhook) are attempted first; email acts as the
 * fallback and is sent whenever it is enabled and no instant channel delivered.
 */

import type { NotificationChannel, AlertNotification, NotificationResult } from './notification-channel';
import { EmailChannel, type EmailChannelConfig } from './email-channel';
import { DiscordChannel } from './discord-channel';
import { WebhookChannel } from './webhook-channel';

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

		// Discord and webhook channels need no config — they use per-user URLs from the alert
		this.channels.push(new DiscordChannel());
		this.channels.push(new WebhookChannel());
	}

	/**
	 * Send alert notification through all enabled channels.
	 * Instant channels run in parallel; email is sent only if none of them delivered.
	 */
	async sendNotification(notification: AlertNotification): Promise<NotificationResult[]> {
		const alert = notification.alert;

		console.log(`[AlertNotificationService] Processing notifications for alert ${alert.id}:`, {
			email_notifications: alert.email_notifications,
			discord_notifications: alert.discord_notifications,
			webhook_notifications: alert.webhook_notifications,
			email: alert.email ? 'present' : 'missing',
			discord_webhook_url: alert.discord_webhook_url ? 'present' : 'missing',
			webhook_url: alert.webhook_url ? 'present' : 'missing',
		});

		const emailChannel = this.channels.find((c) => c.name === 'email');
		const instantChannels = this.channels.filter((c) => c.name !== 'email' && c.isEnabled(alert));

		const results: NotificationResult[] = await Promise.all(instantChannels.map((channel) => this.trySend(channel, notification)));
		const instantDelivered = results.some((r) => r.success);

		// Email fallback: send when enabled and no instant channel got through
		if (emailChannel && emailChannel.isEnabled(alert) && !instantDelivered) {
			results.push(await this.trySend(emailChannel, notification));
		}

		if (!results.some((r) => r.success)) {
			console.warn(`[AlertNotificationService] No notifications sent for alert ${alert.id}: All methods disabled or failed`);
		}

		return results;
	}

	/**
	 * Send through a single channel, converting thrown errors into a failed result
	 */
	private async trySend(channel: NotificationChannel, notification: AlertNotification): Promise<NotificationResult> {
		const alertId = notification.alert.id;

		try {
			const result = await channel.send(notification);

			if (result.success) {
				console.log(`[AlertNotificationService] ${channel.name} notification sent successfully for alert ${alertId}`);
			} else {
				console.error(`[AlertNotificationService] ${channel.name} notification failed for alert ${alertId}: ${result.error}`);
			}

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[AlertNotificationService] ${channel.name} channel threw error for alert ${alertId}: ${errorMessage}`);

			return {
				channel: channel.name,
				success: false,
				error: errorMessage,
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Get available notification channels
	 */
	getChannels(): string[] {
		return this.channels.map((c) => c.name);
	}
}
