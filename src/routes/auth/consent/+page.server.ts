/**
 * OAuth consent screen.
 *
 * Better Auth redirects here (configured as `oidcConfig.consentPage`) with a
 * `consent_code` identifying the pending authorization. Approving posts that
 * code back to Better Auth, which then returns the URI to send the user to —
 * the client's callback carrying an authorization code, or an error.
 */

import { getAuth } from "$lib/server/auth";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

/** Human-readable descriptions for the scopes this server issues. */
const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm who you are",
  profile: "Read your basic profile",
  email: "Read your email address",
  offline_access: "Stay connected when you are not using the app",
};

export const load: PageServerLoad = async (event) => {
  const consentCode = event.url.searchParams.get("consent_code");
  const clientId = event.url.searchParams.get("client_id");
  const scope = event.url.searchParams.get("scope") ?? "";

  if (!consentCode || !clientId) {
    error(400, "This authorization link is incomplete or has expired.");
  }

  // Reaching consent without a session should be impossible — Better Auth sends
  // people to the login page first — but never render an approval prompt to an
  // anonymous visitor.
  if (!event.locals.user) {
    redirect(303, `/auth/login?${event.url.searchParams.toString()}`);
  }

  const db = event.platform?.env?.DB;
  const client = db
    ? await db
        .prepare("SELECT name, icon FROM oauthApplication WHERE clientId = ?")
        .bind(clientId)
        .first<{ name: string; icon: string | null }>()
    : null;

  const scopes = scope
    .split(" ")
    .filter(Boolean)
    .map((s) => ({ id: s, label: SCOPE_LABELS[s] ?? s }));

  return {
    consentCode,
    clientId,
    // Client names come from open dynamic registration, so treat them as
    // untrusted display text — anyone can register a client called anything.
    clientName: client?.name ?? "An unknown application",
    clientKnown: !!client,
    scopes,
    userEmail: event.locals.user.email ?? null,
  };
};

async function decide(event: Parameters<Actions[string]>[0], accept: boolean) {
  const env = event.platform?.env;
  if (!env?.DB) return fail(500, { error: "Service unavailable." });

  const formData = await event.request.formData();
  const consentCode = String(formData.get("consent_code") ?? "");
  if (!consentCode) return fail(400, { error: "Missing consent code." });

  let redirectURI: string;
  try {
    const result = await getAuth(env).api.oAuthConsent({
      body: { accept, consent_code: consentCode },
      headers: event.request.headers,
    });
    redirectURI = (result as { redirectURI: string }).redirectURI;
  } catch (err) {
    console.error("oAuthConsent failed:", err);
    return fail(400, {
      error:
        "This authorization request is no longer valid. Start the connection again from the application.",
    });
  }

  if (!redirectURI) {
    return fail(500, { error: "No redirect target was returned." });
  }

  return { redirectTo: redirectURI };
}

export const actions: Actions = {
  approve: (event) => decide(event, true),
  deny: (event) => decide(event, false),
};
