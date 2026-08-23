/**
 * Cloud Webhook Notification Channel
 *
 * Sends cloud availability notifications as a JSON POST to a user-provided
 * endpoint. Shares the envelope shape (event/version) with the price-alert
 * webhook, and the same ntfy exception — see ../notifications/ntfy.
 */

import type { CloudNotificationChannel, CloudNotification, CloudNotificationResult, CloudAlertMatch } from './cloud-notification-channel';
import { isNtfyUrl, buildNtfyRequest, type NtfyMessage, type WebhookRequest } from '../notifications/ntfy';

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
const USER_AGENT = 'ServerRadar-Webhook/1.0 (+https://radar.iodev.org)';
const CLOUD_STATUS_URL = 'https://radar.iodev.org/alerts?tab=cloud-alerts';

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

			const webhookUrl = notification.user.webhook_url!;
			const success = await this.post(webhookUrl, this.createRequest(webhookUrl, notification));

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

	/** Picks the wire format for the destination: ntfy's, or our JSON envelope. */
	private createRequest(webhookUrl: string, notification: CloudNotification): WebhookRequest {
		if (isNtfyUrl(webhookUrl)) {
			return buildNtfyRequest(this.createNtfyMessage(notification.matches));
		}

		return {
			body: JSON.stringify(this.createPayload(notification)),
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': USER_AGENT,
			},
		};
	}

	/**
	 * One line per change, mirroring the Discord wording. A single change gets a
	 * specific title; a batch gets a count, since ntfy shows only one heading.
	 */
	private createNtfyMessage(matches: CloudAlertMatch[]): NtfyMessage {
		const lines = matches.map(({ change }) => {
			const action = change.eventType === 'available' ? 'is now available' : 'is no longer available';
			return `${change.serverTypeName} ${action} in ${change.locationName}`;
		});

		const title = matches.length === 1 ? 'Cloud availability' : `Cloud availability: ${matches.length} changes`;

		return {
			title,
			message: lines.join('\n'),
			click: CLOUD_STATUS_URL,
			tags: ['cloud'],
		};
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
			url: CLOUD_STATUS_URL,
			triggeredAt: new Date().toISOString(),
		};
	}

	private async post(webhookUrl: string, request: WebhookRequest): Promise<boolean> {
		try {
			console.log(`[CloudWebhookChannel] Sending webhook to: ${webhookUrl.substring(0, 50)}...`);

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: request.headers,
				body: request.body,
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
