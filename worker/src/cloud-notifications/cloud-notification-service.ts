/**
 * Cloud Alert Notification Service
 *
 * Orchestrates cloud availability notification delivery across multiple channels
 * Groups notifications by user and handles fallback logic
 */

import type {
	CloudNotificationChannel,
	CloudNotification,
	CloudNotificationResult,
	CloudAlert,
	CloudAlertUser,
	CloudAlertMatch,
} from './cloud-notification-channel';
import { CloudEmailChannel, type CloudEmailChannelConfig } from './cloud-email-channel';
import { CloudDiscordChannel } from './cloud-discord-channel';
import { CloudWebhookChannel } from './cloud-webhook-channel';

export interface CloudNotificationServiceConfig {
	email?: CloudEmailChannelConfig;
}

export class CloudNotificationService {
	private channels: CloudNotificationChannel[];

	constructor(config: CloudNotificationServiceConfig) {
		this.channels = [];

		// Initialize email channel if configured
		if (config.email) {
			this.channels.push(new CloudEmailChannel(config.email));
		}

		// Discord and webhook channels need no config — they use per-user URLs
		this.channels.push(new CloudDiscordChannel());
		this.channels.push(new CloudWebhookChannel());
	}

	/**
	 * Process availability changes and send notifications to matching alerts
	 */
	async processAvailabilityChanges(
		changes: AvailabilityChange[],
		alerts: CloudAlert[],
		getUserById: (userId: string) => Promise<CloudAlertUser | null>,
	): Promise<{
		processed: number;
		notifications: number;
		results: CloudNotificationResult[];
	}> {
		console.log(`[CloudNotificationService] Processing ${changes.length} availability changes against ${alerts.length} alerts`);

		// Find matching alerts for each change
		const matches: CloudAlertMatch[] = [];

		for (const change of changes) {
			for (const alert of alerts) {
				// Check if this alert matches the change
				const matchesServerType = alert.server_type_ids.includes(change.serverTypeId);
				const matchesLocation = alert.location_ids.includes(change.locationId);
				const matchesEventType = alert.alert_on === 'both' || alert.alert_on === change.eventType;

				if (matchesServerType && matchesLocation && matchesEventType) {
					const user = await getUserById(alert.user_id);
					if (user) {
						matches.push({ alert, change, user });
					}
				}
			}
		}

		console.log(`[CloudNotificationService] Found ${matches.length} alert matches`);

		if (matches.length === 0) {
			return {
				processed: changes.length,
				notifications: 0,
				results: [],
			};
		}

		// Group matches by user to avoid spam
		const matchesByUser = new Map<string, CloudAlertMatch[]>();
		for (const match of matches) {
			const userMatches = matchesByUser.get(match.user.id) || [];
			userMatches.push(match);
			matchesByUser.set(match.user.id, userMatches);
		}

		console.log(`[CloudNotificationService] Grouped matches into ${matchesByUser.size} user notifications`);

		// Send notifications for each user
		const allResults: CloudNotificationResult[] = [];

		for (const [, userMatches] of matchesByUser) {
			const user = userMatches[0].user; // All matches have same user

			// Determine which notifications are enabled
			const emailEnabled = userMatches.some((match) => match.alert.email_notifications);
			const discordEnabled = userMatches.some((match) => match.alert.discord_notifications);
			const webhookEnabled = userMatches.some((match) => match.alert.webhook_notifications);

			const notification: CloudNotification = {
				user,
				matches: userMatches,
				emailEnabled,
				discordEnabled,
				webhookEnabled,
			};

			const results = await this.sendNotification(notification);
			allResults.push(...results);
		}

		const successfulNotifications = allResults.filter((r) => r.success).length;
		const totalChangesProcessed = allResults.reduce((sum, r) => sum + r.changesProcessed, 0);

		console.log(
			`[CloudNotificationService] Notification processing completed: ${successfulNotifications}/${allResults.length} successful, ${totalChangesProcessed} changes processed`,
		);

		return {
			processed: changes.length,
			notifications: matches.length,
			results: allResults,
		};
	}

	/**
	 * Send notification through all enabled channels.
	 * Instant channels (Discord, webhook) run first; email is the fallback and
	 * is sent whenever it is enabled and no instant channel delivered.
	 */
	private async sendNotification(notification: CloudNotification): Promise<CloudNotificationResult[]> {
		const userId = notification.user.id;

		console.log(`[CloudNotificationService] Processing notifications for user ${userId}:`, {
			emailEnabled: notification.emailEnabled,
			discordEnabled: notification.discordEnabled,
			webhookEnabled: notification.webhookEnabled,
			email: notification.user.email ? 'present' : 'missing',
			discord_webhook_url: notification.user.discord_webhook_url ? 'present' : 'missing',
			webhook_url: notification.user.webhook_url ? 'present' : 'missing',
			matches: notification.matches.length,
		});

		const emailChannel = this.channels.find((c) => c.name === 'cloud-email');
		const instantChannels = this.channels.filter((c) => c.name !== 'cloud-email' && c.isEnabled(notification));

		const results: CloudNotificationResult[] = await Promise.all(
			instantChannels.map(async (channel) => {
				const result = await channel.send(notification);
				if (result.success) {
					console.log(`[CloudNotificationService] ${channel.name} notification sent successfully for user ${userId}`);
				} else {
					console.error(`[CloudNotificationService] ${channel.name} notification failed for user ${userId}: ${result.error}`);
				}
				return result;
			}),
		);
		const instantDelivered = results.some((r) => r.success);

		// Email fallback: send when enabled and no instant channel got through
		if (emailChannel && emailChannel.isEnabled(notification) && !instantDelivered) {
			const result = await emailChannel.send(notification);
			results.push(result);

			if (result.success) {
				console.log(`[CloudNotificationService] Email notification sent for user ${userId}`);
			} else {
				console.error(`[CloudNotificationService] Email notification failed for user ${userId}: ${result.error}`);
			}
		}

		if (!results.some((r) => r.success)) {
			console.warn(`[CloudNotificationService] No notifications sent for user ${userId}: All methods disabled or failed`);
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
