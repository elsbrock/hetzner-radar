import { SESSION_COOKIE_NAME, invalidateSession } from '$lib/api/backend/session';
import { createBlankSessionCookie } from '$lib/cookie';
import { sendMail } from '$lib/mail';
import { redirect, error } from '@sveltejs/kit';
import {
	getUser,
	updateUserDiscordWebhook,
	updateUserNotificationPreferences,
	validateDiscordWebhookUrl,
	type UserNotificationPreferences
} from '$lib/api/backend/user';
import { sendDiscordNotification, createTestDiscordEmbed } from '$lib/api/backend/discord';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(302, '/auth/login');
	}

	const db = event.platform?.env.DB;
	if (!db) {
		throw error(500, { message: 'Database connection error.' });
	}

	const user = await getUser(db, event.locals.user.id.toString());
	if (!user) {
		throw error(404, { message: 'User not found.' });
	}

	return {
		user: {
			email: user.email,
			discord_webhook_url: user.discord_webhook_url,
			notification_preferences: user.notification_preferences || {
				email: true,
				discord: false
			}
		}
	};
};

export const actions: Actions = {
	updateDiscordWebhook: async (event) => {
		if (!event.locals.user) {
			return error(401, { message: 'Authentication required.' });
		}

		const db = event.platform?.env.DB;
		if (!db) {
			return error(500, { message: 'Database connection error.' });
		}

		const formData = await event.request.formData();
		const webhookUrl = formData.get('discord_webhook_url') as string;

		if (webhookUrl && !validateDiscordWebhookUrl(webhookUrl)) {
			return {
				success: false,
				error: 'Invalid Discord webhook URL. Please provide a valid Discord webhook URL.'
			};
		}

		try {
			await updateUserDiscordWebhook(db, event.locals.user.id.toString(), webhookUrl || null);
			return {
				success: true,
				message: 'Discord webhook updated successfully.'
			};
		} catch (err) {
			console.error('Error updating Discord webhook:', err);
			return {
				success: false,
				error: 'Failed to update Discord webhook. Please try again.'
			};
		}
	},

	updateNotificationPreferences: async (event) => {
		if (!event.locals.user) {
			return error(401, { message: 'Authentication required.' });
		}

		const db = event.platform?.env.DB;
		if (!db) {
			return error(500, { message: 'Database connection error.' });
		}

		const formData = await event.request.formData();
		// Email is always enabled as mandatory fallback - ignore form input
		const discordEnabled = formData.get('discord_notifications') === 'on';

		const preferences: UserNotificationPreferences = {
			email: true, // Email notifications are always enabled as fallback
			discord: discordEnabled
		};

		// Ensure at least one notification method is available
		// (This is guaranteed since email is always true, but explicit check for clarity)
		if (!preferences.email && !preferences.discord) {
			return {
				success: false,
				error: 'At least one notification method must be enabled.'
			};
		}

		try {
			await updateUserNotificationPreferences(db, event.locals.user.id.toString(), preferences);
			return {
				success: true,
				message: 'Notification preferences updated successfully.'
			};
		} catch (err) {
			console.error('Error updating notification preferences:', err);
			return {
				success: false,
				error: 'Failed to update notification preferences. Please try again.'
			};
		}
	},

	testDiscordWebhook: async (event) => {
		if (!event.locals.user) {
			return error(401, { message: 'Authentication required.' });
		}

		const db = event.platform?.env.DB;
		if (!db) {
			return error(500, { message: 'Database connection error.' });
		}

		const user = await getUser(db, event.locals.user.id.toString());
		if (!user || !user.discord_webhook_url) {
			return {
				success: false,
				error: 'No Discord webhook URL configured. Please add one first.'
			};
		}

		try {
			const embed = createTestDiscordEmbed();
			const success = await sendDiscordNotification(user.discord_webhook_url, {
				embeds: [embed]
			});

			if (success) {
				return {
					success: true,
					message: 'Test notification sent successfully! Check your Discord channel.'
				};
			} else {
				return {
					success: false,
					error: 'Failed to send test notification. Please check your webhook URL.'
				};
			}
		} catch (err) {
			console.error('Error sending test notification:', err);
			return {
				success: false,
				error: 'Failed to send test notification. Please check your webhook URL.'
			};
		}
	},

	delete: async (event) => {
		if (!event.locals.user || !event.locals.session) {
			return error(401, { message: 'Authentication required.' });
		}
		const db = event.platform?.env.DB;
		if (!db) {
			console.error('Database connection not available for delete action');
			return error(500, { message: 'Database connection error.' });
		}

		const userRecord: any = await db
			.prepare('SELECT email FROM user WHERE id = ?')
			.bind(event.locals.user.id)
			.first();

		let userEmail: string | null = null;
		if (userRecord && typeof userRecord.email === 'string') {
			userEmail = userRecord.email;
		}

		if (!userEmail) {
			console.error(`Could not find email for user ${event.locals.user.id}`);
			return error(500, { message: 'Could not retrieve user email.' });
		}

		const blankCookie = createBlankSessionCookie(SESSION_COOKIE_NAME);
		await invalidateSession(db, event.locals.session.id);
		event.cookies.set(blankCookie.name, blankCookie.value, blankCookie.attributes as any);
		await db.prepare('DELETE FROM user WHERE id = ?').bind(event.locals.user.id).run();

		await sendMail(event.platform?.env, {
			from: {
				name: 'Server Radar',
				email: 'mail@radar.iodev.org'
			},
			to: userEmail,
			subject: 'Account Deleted',
			text: `Greetings!

This is to notify you that your account on Server Radar has been successfully deleted.

We're sad to see you go and hope you'll come back soon. If you have any feedback, we'd love to hear it.

Cheers,
Server Radar
--
https://radar.iodev.org/`
		});

		throw redirect(302, '/');
	}
};
