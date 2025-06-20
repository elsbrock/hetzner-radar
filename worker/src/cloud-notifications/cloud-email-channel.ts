/**
 * Cloud Email Notification Channel
 *
 * Sends cloud availability notifications via email using ForwardEmail API
 */

import type { CloudNotificationChannel, CloudNotification, CloudNotificationResult, CloudAlertMatch } from './cloud-notification-channel';

export interface CloudEmailChannelConfig {
	apiKey: string;
	fromName: string;
	fromEmail: string;
	apiUrl?: string;
}

export class CloudEmailChannel implements CloudNotificationChannel {
	readonly name = 'cloud-email';
	private config: CloudEmailChannelConfig;

	constructor(config: CloudEmailChannelConfig) {
		this.config = {
			apiUrl: 'https://api.forwardemail.net/v1/emails',
			...config,
		};
	}

	isEnabled(notification: CloudNotification): boolean {
		return notification.emailEnabled && !!notification.user.email;
	}

	async send(notification: CloudNotification): Promise<CloudNotificationResult> {
		const timestamp = new Date().toISOString();

		try {
			if (!this.isEnabled(notification)) {
				return {
					channel: this.name,
					success: false,
					error: 'Email notifications disabled or no email address',
					timestamp,
					userId: notification.user.id,
					changesProcessed: 0,
				};
			}

			// Filter matches for email-enabled alerts
			const emailMatches = notification.matches.filter((match) => match.alert.email_notifications);

			if (emailMatches.length === 0) {
				return {
					channel: this.name,
					success: false,
					error: 'No email-enabled alerts in notification',
					timestamp,
					userId: notification.user.id,
					changesProcessed: 0,
				};
			}

			const emailContent = this.formatEmailNotification(emailMatches);
			await this.sendEmail(
				notification.user.email,
				`Cloud Alert - ${emailMatches.length} Change${emailMatches.length > 1 ? 's' : ''}`,
				emailContent,
			);

			return {
				channel: this.name,
				success: true,
				timestamp,
				userId: notification.user.id,
				changesProcessed: emailMatches.length,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[CloudEmailChannel] Failed to send notification for user ${notification.user.id}:`, error);

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

	private formatEmailNotification(matches: CloudAlertMatch[]): string {
		const plural = matches.length > 1;
		let text = `Hi there,

good news! The availability for ${plural ? 'some of your cloud alerts has' : 'one of your cloud alerts has'} changed.

`;

		for (const { alert, change } of matches) {
			const action = change.eventType === 'available' ? 'is now available' : 'is no longer available';
			text += `         Alert: ${alert.name}
    Server Type: ${change.serverTypeName}
      Location: ${change.locationName}
        Status: ${action}

`;
		}

		text += `View current availability status directly:

  https://radar.iodev.org/cloud-status

Please note that Server Radar may notice availability changes with a delay 
of up to 2 minutes and the server you are looking for may not be available 
anymore when you check.

Fingers crossed!

Cheers,
Server Radar
--

You are receiving this because you have set up cloud alerts.
To manage your alerts, visit: https://radar.iodev.org/alerts`;

		return text;
	}

	private async sendEmail(to: string, subject: string, text: string): Promise<void> {
		const fromField = this.config.fromName ? `"${this.config.fromName}" <${this.config.fromEmail}>` : this.config.fromEmail;

		const body = new URLSearchParams();
		body.append('from', fromField);
		body.append('to', to);
		body.append('subject', subject);
		body.append('text', text);

		// Construct Basic Auth header
		const credentials = btoa(this.config.apiKey + ':');

		const response = await fetch(this.config.apiUrl!, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${credentials}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Email API error: ${response.status} - ${errorText}`);
		}
	}
}
