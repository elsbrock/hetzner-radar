/**
 * Cloud Webhook Notification Channel
 *
 * Sends cloud availability notifications as a JSON POST to a user-provided
 * endpoint. Shares the envelope shape (event/version) with the price-alert
 * webhook — see docs/specs/webhook-alerts-2026-07.md.
 */

import type { CloudNotificationChannel, CloudNotification, CloudNotificationResult } from './cloud-notification-channel';

export interface CloudWebhookPayload {
	event: 'cloud_alert.triggered';
	version: 1;
	changes: Array<{
		alert: {
			id: string;
			name: string;
		};
		serverType: {
			id: number;
			name: string;
		};
		location: {
			id: number;
			name: string;
		};
		eventType: 'available' | 'unavailable';
	}>;
	url: string;
	triggeredAt: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

export class CloudWebhookChannel implements CloudNotificationChannel {
	readonly name = 'cloud-webhook';

	isEnabled(notification: CloudNotification): boolean {
		return notification.webhookEnabled && !!notification.user.webhook_url;
	}

	async send(notification: CloudNotification): Promise<CloudNotificationResult> {
		const timestamp = new Date().toISOString();

		try {
			if (!this.isEnabled(notification)) {
				return {
					channel: this.name,
					success: false,
					error: 'Webhook notifications disabled or no webhook URL',
					timestamp,
					userId: notification.user.id,
					changesProcessed: 0,
				};
			}

			const payload = this.createPayload(notification);
			const success = await this.postPayload(notification.user.webhook_url!, payload);

			return {
				channel: this.name,
				success,
				error: success ? undefined : 'Webhook request failed',
				timestamp,
				userId: notification.user.id,
				changesProcessed: success ? notification.matches.length : 0,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[CloudWebhookChannel] Failed to send notification for user ${notification.user.id}:`, error);

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

	private createPayload(notification: CloudNotification): CloudWebhookPayload {
		return {
			event: 'cloud_alert.triggered',
			version: 1,
			changes: notification.matches.map(({ alert, change }) => ({
				alert: {
					id: alert.id,
					name: alert.name,
				},
				serverType: {
					id: change.serverTypeId,
					name: change.serverTypeName,
				},
				location: {
					id: change.locationId,
					name: change.locationName,
				},
				eventType: change.eventType,
			})),
			url: 'https://radar.iodev.org/alerts?tab=cloud-alerts',
			triggeredAt: new Date().toISOString(),
		};
	}

	private async postPayload(webhookUrl: string, payload: CloudWebhookPayload): Promise<boolean> {
		try {
			console.log(`[CloudWebhookChannel] Sending webhook to: ${webhookUrl.substring(0, 50)}...`);

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'ServerRadar-Webhook/1.0 (+https://radar.iodev.org)',
				},
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});

			if (!response.ok) {
				console.error(`[CloudWebhookChannel] Webhook returned status ${response.status}: ${response.statusText}`);
			}

			return response.ok;
		} catch (error) {
			console.error('[CloudWebhookChannel] Failed to send webhook:', error);
			return false;
		}
	}
}
