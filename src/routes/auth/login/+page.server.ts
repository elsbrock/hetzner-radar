import { getAuth } from "$lib/server/auth";
import { rateLimit } from "$lib/session";
import { fail, redirect } from "@sveltejs/kit";
import validator from "validator";
import type { Actions } from "./$types";

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
          headers: event.request.headers,
        });
      } catch {
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

      // If application/json, return JSON. Else, redirect to /analyze
      if (event.request.headers.get("accept")?.includes("application/json")) {
        return {
          success: true,
          session,
          user: { id: signedIn.user.id, email: signedIn.user.email },
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
    redirect(303, "/analyze");
  }),
};
