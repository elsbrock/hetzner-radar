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
	AvailabilityChange as _AvailabilityChange,
	CloudAlert,
	CloudAlertUser,
	CloudAlertMatch,
} from './cloud-notification-channel';
import { CloudEmailChannel, type CloudEmailChannelConfig } from './cloud-email-channel';
import { CloudDiscordChannel } from './cloud-discord-channel';

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

		// Discord channel doesn't need config - uses webhook URL from user
		this.channels.push(new CloudDiscordChannel());
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

		for (const [_userId, userMatches] of matchesByUser) {
			const user = userMatches[0].user; // All matches have same user

			// Determine which notifications are enabled
			const emailEnabled = userMatches.some((match) => match.alert.email_notifications);
			const discordEnabled = userMatches.some((match) => match.alert.discord_notifications);

			const notification: CloudNotification = {
				user,
				matches: userMatches,
				emailEnabled,
				discordEnabled,
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
	 * Send notification through all enabled channels with fallback logic
	 */
	private async sendNotification(notification: CloudNotification): Promise<CloudNotificationResult[]> {
		const results: CloudNotificationResult[] = [];

		// Log notification attempt
		console.log(`[CloudNotificationService] Processing notifications for user ${notification.user.id}:`, {
			emailEnabled: notification.emailEnabled,
			discordEnabled: notification.discordEnabled,
			discord_webhook_url: notification.user.discord_webhook_url ? 'present' : 'missing',
			email: notification.user.email ? 'present' : 'missing',
			matches: notification.matches.length,
		});

		// Determine which channels should be used
		const discordChannel = this.channels.find((c) => c.name === 'cloud-discord');
		const emailChannel = this.channels.find((c) => c.name === 'cloud-email');

		// Try Discord first if enabled
		let discordSent = false;
		if (discordChannel && discordChannel.isEnabled(notification)) {
			const result = await discordChannel.send(notification);
			results.push(result);
			discordSent = result.success;

			if (discordSent) {
				console.log(`[CloudNotificationService] Discord notification sent successfully for user ${notification.user.id}`);
			} else {
				console.error(`[CloudNotificationService] Discord notification failed for user ${notification.user.id}: ${result.error}`);
			}
		} else {
			console.log(
				`[CloudNotificationService] Discord notification skipped for user ${notification.user.id}: ${
					!notification.discordEnabled ? 'disabled' : 'no webhook URL'
				}`,
			);
		}

		// Send email if enabled AND (Discord wasn't sent OR Discord failed)
		if (emailChannel && emailChannel.isEnabled(notification) && !discordSent) {
			const result = await emailChannel.send(notification);
			results.push(result);

			if (result.success) {
				console.log(`[CloudNotificationService] Email notification sent for user ${notification.user.id}`);
			} else {
				console.error(`[CloudNotificationService] Email notification failed for user ${notification.user.id}: ${result.error}`);
			}
		}

		// Check if any notification was sent
		const anySent = results.some((r) => r.success);
		if (!anySent) {
			console.warn(`[CloudNotificationService] No notifications sent for user ${notification.user.id}: All methods disabled or failed`);
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
