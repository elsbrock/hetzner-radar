/**
 * Email Notification Channel
 *
 * Sends alert notifications via Cloudflare Email Sending
 */

import type { NotificationChannel, AlertInfo, AlertNotification, NotificationResult } from './notification-channel';

/** Structural type of the Cloudflare Email Sending `send_email` binding. */
export interface EmailBinding {
	send(message: {
		from: string | { name: string; email: string };
		to: string;
		subject: string;
		text?: string;
		html?: string;
		headers?: Record<string, string>;
	}): Promise<{ messageId: string }>;
}

export interface EmailChannelConfig {
	binding: EmailBinding;
	fromName: string;
	fromEmail: string;
}

export class EmailChannel implements NotificationChannel {
	readonly name = 'email';
	private config: EmailChannelConfig;

	constructor(config: EmailChannelConfig) {
		this.config = config;
	}

	isEnabled(alert: AlertInfo): boolean {
		// Check if email notifications are enabled and email is present
		return (alert.email_notifications ?? true) && !!alert.email;
	}

	async send(notification: AlertNotification): Promise<NotificationResult> {
		const timestamp = new Date().toISOString();

		try {
			if (!this.isEnabled(notification.alert)) {
				return {
					channel: this.name,
					success: false,
					error: 'Email notifications disabled or no email address',
					timestamp,
				};
			}

			const emailBody = this.formatEmailBody(notification);
			await this.sendEmail(notification.alert.email!, emailBody.subject, emailBody.text);

			return {
				channel: this.name,
				success: true,
				timestamp,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[EmailChannel] Failed to send notification for alert ${notification.alert.id}:`, error);

			return {
				channel: this.name,
				success: false,
				error: errorMessage,
				timestamp,
			};
		}
	}

	private formatEmailBody(notification: AlertNotification): { subject: string; text: string } {
		const { alert, triggerPrice } = notification;

		const subject = `Price Alert: Target Price Reached`;

		const text = `Hi there,

good news! The target price for one of your alerts has been reached.

         Filter: ${alert.name}
   Target Price: ${alert.price.toFixed(2)} EUR (incl. ${alert.vat_rate}% VAT)
  Trigger Price: ${triggerPrice.toFixed(2)} EUR (incl. ${alert.vat_rate}% VAT${alert.includes_ipv4_cost ? ' and IPv4 cost' : ''})

View the matched auctions directly:

  https://radar.iodev.org/alerts?view=${alert.id}

Please note that Server Radar may notice prices with a delay of up to 60
minutes and the server you are looking for may not be available anymore.

Fingers crossed!

Cheers,
Server Radar
--
https://radar.iodev.org/
    `;

		return { subject, text };
	}

	private async sendEmail(to: string, subject: string, text: string): Promise<void> {
		const { binding, fromName, fromEmail } = this.config;
		await binding.send({
			from: fromName ? { name: fromName, email: fromEmail } : fromEmail,
			to,
			subject,
			text,
		});
	}
}
