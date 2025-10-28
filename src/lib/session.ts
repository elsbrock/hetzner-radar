import { dev } from "$app/environment";
import type { RequestEvent } from "@sveltejs/kit";

type ActionHandler = (event: RequestEvent) => Promise<any>;

export function rateLimit(handler: ActionHandler, action: string = "default") {
  if (dev) {
    return handler;
  }
  return async (event: RequestEvent) => {
    const fingerprint = await createRequestFingerprint(event);

    const rateLimitKey = `rate_limit:${action}:${fingerprint}`;
    const rateLimiter = event.platform?.env?.RATE_LIMIT;

    if (!rateLimiter) {
      return handler(event);
    }

    const { success } = await rateLimiter.limit({
      key: rateLimitKey,
    });
    const notRateLimited = success;

    if (notRateLimited) {
      return handler(event);
    }

    return {
      success: false,
      error: "Rate limited, please try again later",
    };
  };
}

async function createRequestFingerprint(event: RequestEvent): Promise<string> {
  const headers = event.request.headers;
  const userAgent = headers.get("user-agent") || "";
  const acceptLanguage = headers.get("accept-language") || "";

  // Incorporate the session ID if available
  const sessionId = event.locals.session?.id || "";

  const rawFingerprint = `${userAgent}-${acceptLanguage}-${sessionId}`;

  // Generate a hash from the combined string (SHA256)
  const encoder = new TextEncoder();
  const data = encoder.encode(rawFingerprint);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return fingerprint;
}
