/**
 * Generic webhook delivery for user-facing test notifications.
 * The production alert payload is sent by the worker (see
 * worker/src/notifications/webhook-channel.ts); both share the same
 * envelope shape (event/version).
 */

const REQUEST_TIMEOUT_MS = 10_000;

export interface TestWebhookPayload {
  event: "test";
  version: 1;
  message: string;
  triggeredAt: string;
}

export function createTestWebhookPayload(): TestWebhookPayload {
  return {
    event: "test",
    version: 1,
    message:
      "This is a test notification from Server Radar. Your webhook is working correctly!",
    triggeredAt: new Date().toISOString(),
  };
}

export async function sendWebhookNotification(
  webhookUrl: string,
  payload: unknown,
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ServerRadar-Webhook/1.0 (+https://radar.iodev.org)",
      },
      body: JSON.stringify(payload),
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
