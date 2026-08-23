/**
 * Generic Webhook Notification Channel
 *
 * Sends alert notifications as a JSON POST to a user-provided endpoint.
 * The payload is a stable, versioned contract.
 *
 * ntfy URLs are the one exception: they get ntfy's native wire format instead,
 * because the JSON envelope is unusable there. See ./ntfy.
 */

import type { NotificationChannel, AlertInfo, AlertNotification, NotificationResult } from './notification-channel';
import { isNtfyUrl, buildNtfyRequest, type NtfyMessage, type WebhookRequest } from './ntfy';

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
const USER_AGENT = 'ServerRadar-Webhook/1.0 (+https://radar.iodev.org)';

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

			const webhookUrl = notification.alert.webhook_url!;
			const success = await this.post(webhookUrl, this.createRequest(webhookUrl, notification));

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

	/** Picks the wire format for the destination: ntfy's, or our JSON envelope. */
	private createRequest(webhookUrl: string, notification: AlertNotification): WebhookRequest {
		if (isNtfyUrl(webhookUrl)) {
			return buildNtfyRequest(this.createNtfyMessage(notification));
		}

		return {
			body: JSON.stringify(this.createPayload(notification)),
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': USER_AGENT,
			},
		};
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

	/**
	 * A one-line summary rather than the auction list: ntfy renders the body as
	 * the notification text, and anything past ~4 KB becomes a file attachment.
	 */
	private createNtfyMessage(notification: AlertNotification): NtfyMessage {
		const { alert, triggerPrice, matchedAuctions } = notification;
		const count = matchedAuctions.length;

		return {
			title: `Price alert: ${alert.name}`,
			message:
				`${count} matching server${count === 1 ? '' : 's'} from €${triggerPrice.toFixed(2)} ` +
				`(target €${alert.price.toFixed(2)}, incl. ${alert.vat_rate}% VAT)`,
			click: `https://radar.iodev.org/alerts?view=${alert.id}`,
			tags: ['moneybag'],
		};
	}

	private async post(webhookUrl: string, request: WebhookRequest): Promise<boolean> {
		try {
			console.log(`[WebhookChannel] Sending webhook to: ${webhookUrl.substring(0, 50)}...`);

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: request.headers,
				body: request.body,
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
