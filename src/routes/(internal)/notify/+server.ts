import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import {
	getActiveCloudAlertsForMatching,
	recordCloudAlertTrigger
} from '$lib/api/backend/cloud-alerts';
import { getUser } from '$lib/api/backend/user';
import { sendMail } from '$lib/mail';
import { sendDiscordNotification } from '$lib/api/backend/discord';

interface AvailabilityChange {
	serverTypeId: number;
	serverTypeName: string;
	locationId: number;
	locationName: string;
	eventType: 'available' | 'unavailable';
	timestamp: number;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	// Verify API key
	const authKey = request.headers.get('x-auth-key');
	if (!dev && (!authKey || authKey !== env.API_KEY)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	try {
		const { changes } = (await request.json()) as {
			changes: AvailabilityChange[];
		};

		if (!changes || !Array.isArray(changes)) {
			return json({ error: 'Invalid request body' }, { status: 400 });
		}

		// Get all active cloud alerts
		const activeAlerts = await getActiveCloudAlertsForMatching(platform.env.DB);

		// Process each change
		const notifications: Array<{
			userId: string;
			alertId: string;
			alertName: string;
			change: AvailabilityChange;
			emailEnabled: boolean;
			discordEnabled: boolean;
		}> = [];

		for (const change of changes) {
			// Find matching alerts
			for (const alert of activeAlerts) {
				// Check if this alert matches the change
				const matchesServerType = alert.server_type_ids.includes(change.serverTypeId);
				const matchesLocation = alert.location_ids.includes(change.locationId);
				const matchesEventType = alert.alert_on === 'both' || alert.alert_on === change.eventType;

				if (matchesServerType && matchesLocation && matchesEventType) {
					// Record the trigger
					await recordCloudAlertTrigger(
						platform.env.DB,
						alert.id,
						alert.user_id,
						change.serverTypeId,
						change.serverTypeName,
						change.locationId,
						change.locationName,
						change.eventType
					);

					notifications.push({
						userId: alert.user_id,
						alertId: alert.id,
						alertName: alert.name,
						change,
						emailEnabled: alert.email_notifications,
						discordEnabled: alert.discord_notifications
					});
				}
			}
		}

		// Group notifications by user to avoid spam
		const notificationsByUser = new Map<string, typeof notifications>();
		for (const notification of notifications) {
			const userNotifications = notificationsByUser.get(notification.userId) || [];
			userNotifications.push(notification);
			notificationsByUser.set(notification.userId, userNotifications);
		}

		// Send notifications
		const emailPromises: Promise<void>[] = [];
		const discordPromises: Promise<void>[] = [];

		for (const [userId, userNotifications] of notificationsByUser) {
			const user = await getUser(platform.env.DB, userId);
			if (!user) continue;

			// Prepare notification content
			const emailChanges = userNotifications.filter((n) => n.emailEnabled);
			const discordChanges = userNotifications.filter((n) => n.discordEnabled);

			// Send email notification
			if (emailChanges.length > 0) {
				const emailContent = formatEmailNotification(emailChanges);
				emailPromises.push(
					sendMail(platform.env, {
						from: {
							name: 'Server Radar',
							email: 'no-reply@radar.iodev.org'
						},
						to: user.email,
						subject: `Cloud Alert - ${emailChanges.length} Change${emailChanges.length > 1 ? 's' : ''}`,
						text: emailContent
					})
				);
			}

			// Send Discord notification
			if (discordChanges.length > 0 && user.discord_webhook_url) {
				const discordContent = formatDiscordNotification(discordChanges);
				discordPromises.push(
					sendDiscordNotification(user.discord_webhook_url, {
						content: discordContent
					}).then(() => {})
				);
			}
		}

		// Wait for all notifications to be sent
		await Promise.allSettled([...emailPromises, ...discordPromises]);

		return json({
			success: true,
			processed: changes.length,
			notifications: notifications.length
		});
	} catch (error) {
		console.error('Error processing cloud availability changes:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

function formatEmailNotification(
	notifications: Array<{
		alertName: string;
		change: AvailabilityChange;
	}>
): string {
	const plural = notifications.length > 1;
	let text = `Hi there,

good news! The availability for ${plural ? 'some of your cloud alerts has' : 'one of your cloud alerts has'} changed.

`;

	for (const { alertName, change } of notifications) {
		const action = change.eventType === 'available' ? 'is now available' : 'is no longer available';
		text += `         Alert: ${alertName}
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

function formatDiscordNotification(
	notifications: Array<{
		alertName: string;
		change: AvailabilityChange;
	}>
): string {
	let message = '**Cloud Alert**\n\n';

	for (const { alertName, change } of notifications) {
		const emoji = change.eventType === 'available' ? '✅' : '❌';
		const action = change.eventType === 'available' ? 'is now available' : 'is no longer available';
		message += `${emoji} **${change.serverTypeName}** ${action} in **${change.locationName}** (Alert: ${alertName})\n`;
	}

	message += '\n[View current availability status](https://radar.iodev.org/cloud-status)';

	return message;
}
