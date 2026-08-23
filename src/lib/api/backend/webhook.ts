/**
 * Generic webhook delivery for user-facing test notifications.
 *
 * The production alert payloads are sent by the worker (see
 * worker/src/notifications/webhook-channel.ts and
 * worker/src/cloud-notifications/cloud-webhook-channel.ts); both share the same
 * envelope shape (event/version). The ntfy formatting is imported from the
 * worker rather than reimplemented, so the Test button exercises the same wire
 * format a real alert would.
 */

import {
  isNtfyUrl,
  buildNtfyRequest,
  type WebhookRequest,
} from "../../../../worker/src/notifications/ntfy";

const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "ServerRadar-Webhook/1.0 (+https://radar.iodev.org)";

export interface TestWebhookPayload {
  event: "test";
  version: 1;
  message: string;
  triggeredAt: string;
}

const TEST_MESSAGE =
  "This is a test notification from Server Radar. Your webhook is working correctly!";

export function createTestWebhookPayload(): TestWebhookPayload {
  return {
    event: "test",
    version: 1,
    message: TEST_MESSAGE,
    triggeredAt: new Date().toISOString(),
  };
}

function createTestRequest(webhookUrl: string): WebhookRequest {
  if (isNtfyUrl(webhookUrl)) {
    return buildNtfyRequest({
      title: "Server Radar test",
      message: TEST_MESSAGE,
      click: "https://radar.iodev.org/alerts",
      tags: ["white_check_mark"],
    });
  }

  return {
    body: JSON.stringify(createTestWebhookPayload()),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
  };
}

/**
 * Sends a test notification, formatted for whatever endpoint the user configured.
 */
export async function sendTestWebhookNotification(
  webhookUrl: string,
): Promise<boolean> {
  const request = createTestRequest(webhookUrl);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `Webhook returned status ${response.status}: ${response.statusText}`,
      );
    }

    return response.ok;
  } catch (error) {
    console.error("Failed to send webhook notification:", error);
    return false;
  }
}
