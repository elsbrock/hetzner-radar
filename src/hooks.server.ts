import { building } from "$app/environment";
import { SESSION_COOKIE_NAME } from "$lib/api/backend/session";
import { getAuth } from "$lib/server/auth";
import { createMetrics } from "@else42/cf-worker-otel";
import { sequence } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";
import type { Handle } from "@sveltejs/kit";

/**
 * Same content types SvelteKit protects — the ones a cross-site HTML form can
 * produce without triggering a CORS preflight.
 */
const FORM_CONTENT_TYPES = [
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
];
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Paths exempt from the origin check.
 *
 * OAuth token and dynamic-registration requests are server-to-server: form
 * encoded, cross-origin, and carrying no Origin header at all. They cannot
 * satisfy an origin check, and they are not CSRF-shaped either — there is no
 * ambient credential to abuse, since every call must present a client secret or
 * a PKCE verifier that a third-party site cannot know.
 */
const CSRF_EXEMPT_PREFIX = "/api/auth/";

/**
 * Replaces SvelteKit's built-in CSRF origin check, which is disabled in
 * svelte.config.js (see the comment there for why). Identical logic, except it
 * skips the OAuth endpoints instead of being all-or-nothing.
 */
const csrfHandle: Handle = async ({ event, resolve }) => {
  const { request, url } = event;

  if (!url.pathname.startsWith(CSRF_EXEMPT_PREFIX)) {
    const contentType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();

    const forbidden =
      !!contentType &&
      FORM_CONTENT_TYPES.includes(contentType) &&
      MUTATING_METHODS.has(request.method) &&
      request.headers.get("origin") !== url.origin;

    if (forbidden) {
      return new Response(
        `Cross-site ${request.method} form submissions are forbidden`,
        { status: 403, headers: { "content-type": "text/plain" } },
      );
    }
  }

  return resolve(event);
};

/** @type {import('@sveltejs/kit').HandleServerError} */
export async function handleError({ error, event }) {
  const errorId = crypto.randomUUID();

  console.error("unhandled error", event, error, errorId);

  return {
    message:
      "Whoops! " +
      (error instanceof Error ? error.message : "An unexpected error occurred"), // Use error.message for clarity
    errorId,
  };
}

const metricsHandle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;
  const metrics = createMetrics({
    serviceName: "server-radar",
    endpoint: env?.OTLP_ENDPOINT,
    token: env?.OTLP_AUTH_TOKEN,
  });
  const start = Date.now();
  let status = "500";
  try {
    const response = await resolve(event);
    status = String(response.status);
    return response;
  } finally {
    metrics.counter("cf_worker_requests_total", 1, {
      method: event.request.method,
      status,
      route: event.route.id ?? "unknown",
    });
    metrics.histogram("cf_worker_request_duration_ms", Date.now() - start, {
      route: event.route.id ?? "unknown",
    });
    event.platform?.context?.waitUntil(metrics.flush());
  }
};

const sessionHandle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;

  if (!env?.DB) {
    event.locals.user = null;
    event.locals.session = null;
    return resolve(event);
  }

  const auth = getAuth(env);

  // The pre-Better-Auth cookie. Its backing rows are gone after migration
  // 0016, so it can only ever be dead weight — drop it on sight.
  if (event.cookies.get(SESSION_COOKIE_NAME)) {
    event.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
  }

  // Better Auth handles expiry and rolling renewal (`session.updateAge`)
  // internally, and refreshes its own cookie via the sveltekitCookies plugin.
  const result = await auth.api.getSession({ headers: event.request.headers });

  if (result?.session && result.user) {
    // Narrowed to the App.Locals contract so the rest of the app is unchanged.
    event.locals.user = {
      id: result.user.id,
      email: result.user.email,
    };
    event.locals.session = {
      id: result.session.id,
      userId: result.session.userId,
      email: result.user.email,
      expiresAt: new Date(result.session.expiresAt),
    };
  } else {
    event.locals.user = null;
    event.locals.session = null;
  }

  // Mounts Better Auth's own routes under /api/auth/*.
  return svelteKitHandler({ event, resolve, auth, building });
};

// csrfHandle must run first — it is the replacement for a check SvelteKit
// would otherwise have applied before any hook.
export const handle = sequence(csrfHandle, metricsHandle, sessionHandle);
