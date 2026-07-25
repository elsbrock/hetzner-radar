import { SESSION_COOKIE_NAME } from "$lib/api/backend/session";
import { getAuth } from "$lib/server/auth";
import type { Actions } from "./$types";

export const actions: Actions = {
  default: async (event) => {
    // Clear any leftover pre-Better-Auth cookie alongside the real sign-out.
    event.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });

    const env = event.platform?.env;
    if (!env?.DB || !event.locals.session) {
      return;
    }

    // Revokes the session row and clears the Better Auth cookie via the
    // sveltekitCookies plugin.
    await getAuth(env).api.signOut({ headers: event.request.headers });
  },
};
