import { getAuth } from "$lib/server/auth";
import { rateLimit } from "$lib/session";
import { fail, redirect } from "@sveltejs/kit";
import validator from "validator";
import type { Actions, PageServerLoad } from "./$types";

const DEFAULT_DESTINATION = "/analyze";
const OAUTH_AUTHORIZE_PATH = "/api/auth/mcp/authorize";

/**
 * OAuth parameters forwarded when resuming an interrupted authorization.
 *
 * Whitelisted rather than passed through wholesale: the value reaching the
 * action comes from a form field, so only known-good keys are rebuilt onto our
 * own authorize path. Combined with the fixed path that makes an open redirect
 * impossible — a caller cannot steer the browser anywhere but back into Better
 * Auth, which independently validates client_id and redirect_uri.
 */
const OAUTH_PARAMS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "scope",
  "state",
  "nonce",
  "resource",
  "prompt",
];

/**
 * Strips Better Auth's `oidc_login_prompt` cookie from headers forwarded to the
 * sign-in API.
 *
 * The mcp plugin registers an after-hook on every response that sets a session
 * cookie: when that cookie is present it tries to finish the pending
 * authorization itself, reaching `authorize()`, which throws
 * `UNAUTHORIZED / "request not found"` because a server-side `auth.api` call has
 * no `ctx.request`. The sign-in then surfaces as a bogus "invalid code".
 *
 * Passing `request` through satisfies that check but makes the call return `{}`
 * instead of `{ token, user }`, leaving the client with no session. Hiding the
 * cookie instead keeps the normal return shape and leaves the redirect to
 * `buildOAuthResume`, which reconstructs it from the form anyway.
 */
function withoutOidcPrompt(headers: Headers): Headers {
  const cookie = headers.get("cookie");
  if (!cookie?.includes("oidc_login_prompt")) return headers;

  const filtered = cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => !part.startsWith("oidc_login_prompt="))
    .join("; ");

  const copy = new Headers(headers);
  if (filtered) copy.set("cookie", filtered);
  else copy.delete("cookie");
  return copy;
}

function buildOAuthResume(source: URLSearchParams): string | null {
  // client_id is what distinguishes an OAuth hand-off from a plain sign-in.
  if (!source.get("client_id")) return null;

  const params = new URLSearchParams();
  for (const key of OAUTH_PARAMS) {
    const value = source.get(key);
    if (value) params.set(key, value);
  }
  return `${OAUTH_AUTHORIZE_PATH}?${params.toString()}`;
}

/**
 * `mcp({ loginPage })` sends unauthenticated authorization requests here with
 * the OAuth query intact. The sign-in form posts to `?/authenticate`, which
 * replaces the query string, so the parameters are surfaced to the page and
 * sent back as a hidden field — otherwise the flow is lost at sign-in and the
 * client reports "Authorization failed".
 */
export const load: PageServerLoad = async ({ url }) => ({
  oauthResume: buildOAuthResume(url.searchParams),
});

export const actions: Actions = {
  identify: rateLimit(async (event) => {
    try {
      const env = event.platform?.env;
      const db = env?.DB;
      if (!db) {
        return fail(500, {
          error: "Database connection error.",
        });
      }
      const formData = await event.request.formData();

      let email = formData.get("email") as string;
      const tosAgree = formData.get("tosagree") as string;
      const cookieConsent = formData.get("cookieconsent") as string;

      if (tosAgree !== "on") {
        return fail(400, {
          error: "You must agree to the Terms of Service.",
        });
      }

      if (cookieConsent !== "on") {
        return fail(400, {
          error: "You must consent to the use of cookies.",
        });
      }

      if (!email) {
        return fail(400, {
          error: "Invalid email, please try again.",
        });
      }

      email = email.toLowerCase();

      if (!validator.isEmail(email)) {
        return fail(400, {
          error: "Invalid email format.",
        });
      }

      // Better Auth generates and stores the OTP, then hands it to the
      // `sendVerificationOTP` callback configured in $lib/server/auth.
      try {
        await getAuth(env).api.sendVerificationOTP({
          body: { email, type: "sign-in" },
          headers: event.request.headers,
        });
      } catch (mailError) {
        console.error("Failed to send verification email:", mailError);
        return fail(500, {
          error: "Unable to send verification email. Please try again later.",
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Identify action error:", error);
      return fail(500, {
        error: "An unexpected error occurred. Please try again later.",
      });
    }
  }),

  authenticate: rateLimit(async (event) => {
    let destination: string | undefined;
    try {
      const env = event.platform?.env;
      const db = env?.DB;
      if (!db) {
        return fail(500, {
          error: "Database connection error.",
        });
      }
      const formData = await event.request.formData();
      const code = formData.get("code") as string;
      let email = formData.get("email") as string;

      if (!email) {
        return fail(400, {
          error: "Email is required.",
        });
      }

      email = email.toLowerCase();

      if (!validator.isEmail(email)) {
        return fail(400, {
          error: "Invalid email format.",
        });
      }

      if (!code) {
        return fail(400, {
          error: "Invalid code, please try again.",
        });
      }

      // Verifies the OTP, creates the user on first sign-in, and issues the
      // session cookie via the sveltekitCookies plugin. Throws on a bad or
      // expired code.
      let signedIn;
      try {
        signedIn = await getAuth(env).api.signInEmailOTP({
          body: { email, otp: code },
          headers: withoutOidcPrompt(event.request.headers),
        });
      } catch (error) {
        // Logged rather than swallowed: a bad code and a genuine fault both
        // land here, and reporting "invalid code" for the latter sends people
        // chasing a typo that does not exist.
        console.error("signInEmailOTP failed:", error);
        return fail(400, {
          error: "Invalid code, please try again.",
        });
      }

      // signInEmailOTP returns only { token, user }. The client store expects
      // an App.Session, so resolve the row the token just created — `token` is
      // UNIQUE, so this is a single indexed lookup.
      const row = await db
        .prepare("SELECT id, user_id, expires_at FROM session WHERE token = ?")
        .bind(signedIn.token)
        .first<{ id: string; user_id: string; expires_at: string }>();

      const session: App.Session | null = row
        ? {
            id: row.id,
            userId: row.user_id,
            email: signedIn.user.email,
            expiresAt: new Date(row.expires_at),
          }
        : null;

      // Resume an interrupted OAuth authorization, otherwise carry on to the app.
      destination =
        buildOAuthResume(
          new URLSearchParams(String(formData.get("oauth_resume") ?? "")),
        ) ?? DEFAULT_DESTINATION;

      // If application/json, return JSON. Else, redirect.
      if (event.request.headers.get("accept")?.includes("application/json")) {
        return {
          success: true,
          session,
          user: { id: signedIn.user.id, email: signedIn.user.email },
          redirectTo: destination,
        };
      }
    } catch (error) {
      console.error("Authenticate action error:", error);
      return fail(500, {
        error: "An unexpected error occurred. Please try again later.",
      });
    }

    // Only reachable once sign-in has succeeded and the caller wants a redirect
    // rather than JSON. Thrown outside the try so the catch cannot swallow it.
    redirect(303, destination ?? DEFAULT_DESTINATION);
  }),
};
