/**
 * Discord Notification Channel
 *
 * Sends alert notifications via Discord webhooks with rich embeds
 */

import type { NotificationChannel, AlertInfo, AlertNotification, NotificationResult } from './notification-channel';

export interface DiscordEmbed {
	title: string;
	description?: string;
	color?: number;
	fields?: Array<{
		name: string;
		value: string;
		inline?: boolean;
	}>;
	footer?: {
		text: string;
	};
	timestamp?: string;
	url?: string;
}

export interface DiscordWebhookPayload {
	content?: string;
	embeds?: DiscordEmbed[];
}

export class DiscordChannel implements NotificationChannel {
	readonly name = 'discord';

	isEnabled(alert: AlertInfo): boolean {
		// Check if Discord notifications are enabled and webhook URL is present
		return (alert.discord_notifications ?? false) && !!alert.discord_webhook_url;
	}

	async send(notification: AlertNotification): Promise<NotificationResult> {
		const timestamp = new Date().toISOString();

		try {
			if (!this.isEnabled(notification.alert)) {
				return {
					channel: this.name,
					success: false,
					error: 'Discord notifications disabled or no webhook URL',
					timestamp,
				};
			}

			const webhookUrl = notification.alert.discord_webhook_url!;
			const embed = this.createAlertEmbed(notification);
			const success = await this.sendWebhook(webhookUrl, { embeds: [embed] });

			return {
				channel: this.name,
				success,
				error: success ? undefined : 'Webhook request failed',
				timestamp,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[DiscordChannel] Failed to send notification for alert ${notification.alert.id}:`, error);

			return {
				channel: this.name,
				success: false,
				error: errorMessage,
				timestamp,
			};
		}
	}

	private createAlertEmbed(notification: AlertNotification): DiscordEmbed {
		const { alert, triggerPrice } = notification;
		const auctionUrl = `https://radar.iodev.org/alerts?view=${alert.id}`;

		const fields = [
			{
				name: '🎯 Target Price',
				value: `€${alert.price.toFixed(2)} (incl. ${alert.vat_rate}% VAT)`,
				inline: true,
			},
			{
				name: '💰 Trigger Price',
				value: `€${triggerPrice.toFixed(2)} (incl. ${alert.vat_rate}% VAT)`,
				inline: true,
			},
			{
				name: '💾 Savings',
				value: `€${(alert.price - triggerPrice).toFixed(2)}`,
				inline: true,
			},
			{
				name: '🔗 View Auction',
				value: `[Click here to view details](${auctionUrl})`,
				inline: false,
			},
		];

		return {
			title: `🚨 Price Alert Triggered: ${alert.name}`,
			description:
				'Your target price has been reached! A Hetzner server matching your criteria is now available at or below your desired price.',
			color: 0x00ff00, // Green color
			fields,
			footer: {
				text: 'Server Radar • Price Alert',
			},
			timestamp: new Date().toISOString(),
			url: auctionUrl,
		};
	}

	private async sendWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<boolean> {
		try {
			console.log(`[DiscordChannel] Sending webhook to: ${webhookUrl.substring(0, 50)}...`);

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				console.error(`[DiscordChannel] Webhook returned status ${response.status}: ${response.statusText}`);
				try {
					const errorBody = await response.text();
					console.error('[DiscordChannel] Error response:', errorBody);
				} catch {
					console.error('[DiscordChannel] Could not read error response body');
				}
			}

			return response.ok;
		} catch (error) {
			console.error('[DiscordChannel] Failed to send webhook:', error);
			return false;
		}
	}
}
