/**
 * Cloud Discord Notification Channel
 *
 * Sends cloud availability notifications via Discord webhooks
 */

import type { CloudNotificationChannel, CloudNotification, CloudNotificationResult, CloudAlertMatch } from './cloud-notification-channel';

export class CloudDiscordChannel implements CloudNotificationChannel {
	readonly name = 'cloud-discord';

	isEnabled(notification: CloudNotification): boolean {
		return notification.discordEnabled && !!notification.user.discord_webhook_url;
	}

	async send(notification: CloudNotification): Promise<CloudNotificationResult> {
		const timestamp = new Date().toISOString();

		try {
			if (!this.isEnabled(notification)) {
				return {
					channel: this.name,
					success: false,
					error: 'Discord notifications disabled or no webhook URL',
					timestamp,
					userId: notification.user.id,
					changesProcessed: 0,
				};
			}

			// Filter matches for Discord-enabled alerts
			const discordMatches = notification.matches.filter((match) => match.alert.discord_notifications);

			if (discordMatches.length === 0) {
				return {
					channel: this.name,
					success: false,
					error: 'No Discord-enabled alerts in notification',
					timestamp,
					userId: notification.user.id,
					changesProcessed: 0,
				};
			}

			const webhookUrl = notification.user.discord_webhook_url!;
			const content = this.formatDiscordNotification(discordMatches);
			const success = await this.sendWebhook(webhookUrl, { content });

			return {
				channel: this.name,
				success,
				error: success ? undefined : 'Webhook request failed',
				timestamp,
				userId: notification.user.id,
				changesProcessed: success ? discordMatches.length : 0,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[CloudDiscordChannel] Failed to send notification for user ${notification.user.id}:`, error);

			return {
				channel: this.name,
				success: false,
				error: errorMessage,
				timestamp,
				userId: notification.user.id,
				changesProcessed: 0,
			};
		}
	}

	private formatDiscordNotification(matches: CloudAlertMatch[]): string {
		let message = '**Cloud Alert**\n\n';

		for (const { alert, change } of matches) {
			const emoji = change.eventType === 'available' ? '✅' : '❌';
			const action = change.eventType === 'available' ? 'is now available' : 'is no longer available';
			message += `${emoji} **${change.serverTypeName}** ${action} in **${change.locationName}** (Alert: ${alert.name})\n`;
		}

		message += '\n[View current availability status](https://radar.iodev.org/cloud-status)';

		return message;
	}

	private async sendWebhook(webhookUrl: string, payload: { content: string }): Promise<boolean> {
		try {
			console.log(`[CloudDiscordChannel] Sending webhook to: ${webhookUrl.substring(0, 50)}...`);

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				console.error(`[CloudDiscordChannel] Webhook returned status ${response.status}: ${response.statusText}`);
				try {
					const errorBody = await response.text();
					console.error('[CloudDiscordChannel] Error response:', errorBody);
				} catch {
					console.error('[CloudDiscordChannel] Could not read error response body');
				}
			}

			return response.ok;
		} catch (error) {
			console.error('[CloudDiscordChannel] Failed to send webhook:', error);
			return false;
		}
	}
}
