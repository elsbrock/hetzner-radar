/**
 * Generic Webhook Notification Channel
 *
 * Sends alert notifications as a JSON POST to a user-provided endpoint.
 * The payload is a stable, versioned contract — see docs/specs/webhook-alerts-2026-07.md.
 */

import type { NotificationChannel, AlertInfo, AlertNotification, NotificationResult } from './notification-channel';

export interface WebhookPayload {
	event: 'price_alert.triggered';
	version: 1;
	alert: {
		id: number;
		name: string;
		targetPrice: number;
		vatRate: number;
	};
	trigger: {
		price: number;
		lowestAuctionPrice: number;
	};
	auctions: Array<{
		id: number;
		price: number;
		seen: string;
	}>;
	url: string;
	triggeredAt: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

export class WebhookChannel implements NotificationChannel {
	readonly name = 'webhook';

	isEnabled(alert: AlertInfo): boolean {
		return (alert.webhook_notifications ?? false) && !!alert.webhook_url;
	}

	async send(notification: AlertNotification): Promise<NotificationResult> {
		const timestamp = new Date().toISOString();

		try {
			if (!this.isEnabled(notification.alert)) {
				return {
					channel: this.name,
					success: false,
					error: 'Webhook notifications disabled or no webhook URL',
					timestamp,
				};
			}

			const payload = this.createPayload(notification);
			const success = await this.postPayload(notification.alert.webhook_url!, payload);

			return {
				channel: this.name,
				success,
				error: success ? undefined : 'Webhook request failed',
				timestamp,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[WebhookChannel] Failed to send notification for alert ${notification.alert.id}:`, error);

			return {
				channel: this.name,
				success: false,
				error: errorMessage,
				timestamp,
			};
		}
	}

	private createPayload(notification: AlertNotification): WebhookPayload {
		const { alert, triggerPrice, matchedAuctions, lowestAuctionPrice } = notification;

		return {
			event: 'price_alert.triggered',
			version: 1,
			alert: {
				id: alert.id,
				name: alert.name,
				targetPrice: alert.price,
				vatRate: alert.vat_rate,
			},
			trigger: {
				price: Number(triggerPrice.toFixed(2)),
				lowestAuctionPrice,
			},
			auctions: matchedAuctions.map((auction) => ({
				id: auction.auction_id,
				price: auction.price,
				seen: auction.seen,
			})),
			url: `https://radar.iodev.org/alerts?view=${alert.id}`,
			triggeredAt: new Date().toISOString(),
		};
	}

	private async postPayload(webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
		try {
			console.log(`[WebhookChannel] Sending webhook to: ${webhookUrl.substring(0, 50)}...`);

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
				console.error(`[WebhookChannel] Webhook returned status ${response.status}: ${response.statusText}`);
			}

			return response.ok;
		} catch (error) {
			console.error('[WebhookChannel] Failed to send webhook:', error);
			return false;
		}
	}
}
