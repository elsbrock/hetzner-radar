import {
  SESSION_COOKIE_NAME,
  invalidateSession,
} from "$lib/api/backend/session";
import { createBlankSessionCookie } from "$lib/cookie";
import { sendMail } from "$lib/mail";
import { redirect, error } from "@sveltejs/kit";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getUser,
  updateUserDiscordWebhook,
  updateUserNotificationPreferences,
  updateUserWebhookUrl,
  validateDiscordWebhookUrl,
  validateWebhookUrl,
  type UserNotificationPreferences,
} from "$lib/api/backend/user";
import {
  sendDiscordNotification,
  createTestDiscordEmbed,
} from "$lib/api/backend/discord";
import {
  sendWebhookNotification,
  createTestWebhookPayload,
} from "$lib/api/backend/webhook";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user) {
    throw redirect(302, "/auth/login");
  }

  const env = event.platform?.env;
  const db = env?.DB;
  if (!db) {
    throw error(500, { message: "Database connection error." });
  }

  const user = await getUser(db, event.locals.user.id.toString());
  if (!user) {
    throw error(404, { message: "User not found." });
  }

  return {
    user: {
      email: user.email,
      discord_webhook_url: user.discord_webhook_url,
      webhook_url: user.webhook_url,
      notification_preferences:
        user.notification_preferences || DEFAULT_NOTIFICATION_PREFERENCES,
    },
  };
};

/**
 * Shared handler for the per-channel notification forms: persists the
 * channel's endpoint URL and its enabled flag in one submit. The channel is
 * only marked enabled when a URL is present.
 */
async function updateChannelSettings(
  event: Parameters<NonNullable<Actions[string]>>[0],
  channel: {
    label: string;
    prefKey: "discord" | "webhook";
    urlField: string;
    enabledField: string;
    validate: (url: string) => boolean;
    invalidMessage: string;
    persistUrl: typeof updateUserWebhookUrl;
  },
) {
  if (!event.locals.user) {
    return error(401, { message: "Authentication required." });
  }

  const env = event.platform?.env;
  const db = env?.DB;
  if (!db) {
    return error(500, { message: "Database connection error." });
  }

  const formData = await event.request.formData();
  const url = (formData.get(channel.urlField) as string) || "";
  const enabled = formData.get(channel.enabledField) === "on";

  if (url && !channel.validate(url)) {
    return { success: false, error: channel.invalidMessage };
  }

  const userId = event.locals.user.id.toString();

  try {
    await channel.persistUrl(db, userId, url || null);

    const user = await getUser(db, userId);
    const preferences: UserNotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...user?.notification_preferences,
      [channel.prefKey]: enabled && !!url,
    };
    await updateUserNotificationPreferences(db, userId, preferences);

    return {
      success: true,
      message: `${channel.label} settings updated successfully.`,
    };
  } catch (err) {
    console.error(`Error updating ${channel.label} settings:`, err);
    return {
      success: false,
      error: `Failed to update ${channel.label} settings. Please try again.`,
    };
  }
}

export const actions: Actions = {
  updateDiscordSettings: (event) =>
    updateChannelSettings(event, {
      label: "Discord",
      prefKey: "discord",
      urlField: "discord_webhook_url",
      enabledField: "discord_notifications",
      validate: validateDiscordWebhookUrl,
      invalidMessage:
        "Invalid Discord webhook URL. Please provide a valid Discord webhook URL.",
      persistUrl: updateUserDiscordWebhook,
    }),

  updateWebhookSettings: (event) =>
    updateChannelSettings(event, {
      label: "Webhook",
      prefKey: "webhook",
      urlField: "webhook_url",
      enabledField: "webhook_notifications",
      validate: validateWebhookUrl,
      invalidMessage:
        "Invalid webhook URL. Please provide a public HTTPS endpoint.",
      persistUrl: updateUserWebhookUrl,
    }),

  testDiscordWebhook: async (event) => {
    if (!event.locals.user) {
      return error(401, { message: "Authentication required." });
    }

    const env = event.platform?.env;
    const db = env?.DB;
    if (!db) {
      return error(500, { message: "Database connection error." });
    }

    const user = await getUser(db, event.locals.user.id.toString());
    if (!user || !user.discord_webhook_url) {
      return {
        success: false,
        error: "No Discord webhook URL configured. Please add one first.",
      };
    }

    try {
      const embed = createTestDiscordEmbed();
      const success = await sendDiscordNotification(user.discord_webhook_url, {
        embeds: [embed],
      });

      if (success) {
        return {
          success: true,
          message:
            "Test notification sent successfully! Check your Discord channel.",
        };
      } else {
        return {
          success: false,
          error:
            "Failed to send test notification. Please check your webhook URL.",
        };
      }
    } catch (err) {
      console.error("Error sending test notification:", err);
      return {
        success: false,
        error:
          "Failed to send test notification. Please check your webhook URL.",
      };
    }
  },

  testWebhook: async (event) => {
    if (!event.locals.user) {
      return error(401, { message: "Authentication required." });
    }

    const env = event.platform?.env;
    const db = env?.DB;
    if (!db) {
      return error(500, { message: "Database connection error." });
    }

    const user = await getUser(db, event.locals.user.id.toString());
    if (!user || !user.webhook_url) {
      return {
        success: false,
        error: "No webhook URL configured. Please add one first.",
      };
    }

    try {
      const success = await sendWebhookNotification(
        user.webhook_url,
        createTestWebhookPayload(),
      );

      if (success) {
        return {
          success: true,
          message: "Test notification sent successfully! Check your endpoint.",
        };
      } else {
        return {
          success: false,
          error:
            "Failed to send test notification. Please check your webhook URL.",
        };
      }
    } catch (err) {
      console.error("Error sending test webhook notification:", err);
      return {
        success: false,
        error:
          "Failed to send test notification. Please check your webhook URL.",
      };
    }
  },

  delete: async (event) => {
    if (!event.locals.user || !event.locals.session) {
      return error(401, { message: "Authentication required." });
    }
    const env = event.platform?.env;
    const db = env?.DB;
    if (!db) {
      console.error("Database connection not available for delete action");
      return error(500, { message: "Database connection error." });
    }

    const userRecord = await db
      .prepare("SELECT email FROM user WHERE id = ?")
      .bind(event.locals.user.id)
      .first<{ email: string }>();

    let userEmail: string | null = null;
    if (userRecord?.email) {
      userEmail = userRecord.email;
    }

    if (!userEmail) {
      console.error(`Could not find email for user ${event.locals.user.id}`);
      return error(500, { message: "Could not retrieve user email." });
    }

    const blankCookie = createBlankSessionCookie(SESSION_COOKIE_NAME);
    await invalidateSession(db, event.locals.session.id);
    event.cookies.set(blankCookie.name, blankCookie.value, {
      path: "/",
      ...blankCookie.attributes,
    });
    await db
      .prepare("DELETE FROM user WHERE id = ?")
      .bind(event.locals.user.id)
      .run();

    await sendMail(env, {
      from: {
        name: "Server Radar",
        email: "mail@radar.iodev.org",
      },
      to: userEmail,
      subject: "Account Deleted",
      text: `Greetings!

This is to notify you that your account on Server Radar has been successfully deleted.

We're sad to see you go and hope you'll come back soon. If you have any feedback, we'd love to hear it.

Cheers,
Server Radar
--
https://radar.iodev.org/`,
    });

    throw redirect(302, "/");
  },
};
