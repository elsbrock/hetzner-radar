import { dev } from "$app/environment";
import {
  deleteExpiredVerificationCodes,
  deleteVerificationCodes,
  generateEmailVerificationCode,
  verifyCodeExists,
} from "$lib/api/backend/auth";
import {
  createSession,
  generateSessionToken,
  SESSION_COOKIE_NAME,
  validateSessionToken,
} from "$lib/api/backend/session";
import { createUser, getUserId } from "$lib/api/backend/user";
import { createSessionCookie } from "$lib/cookie";
import { sendMail } from "$lib/mail";
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
      if (!db) {
        return fail(500, {
          error: "Database connection error.",
        });
      }

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

      const verificationCode = await generateEmailVerificationCode(db, email);
      console.log("verification code", verificationCode);

      await sendMail(env, {
        from: {
          name: "Server Radar",
          email: "no-reply@radar.iodev.org",
        },
        to: email,
        subject: "Your Magic Sign-In Code",
        text: `Greetings!

You've requested to sign in to Server Radar. Here's your magic code:

  ${verificationCode}

You've got 15 minutes to use it before it expires. If you didn't request
this, just ignore this email – no action needed on your part.

Cheers,
Server Radar
--
https://radar.iodev.org/`,
      });

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

      await deleteExpiredVerificationCodes(db);

      const codeExists = await verifyCodeExists(db, email, code);
      if (!codeExists) {
        return fail(400, {
          error: "Invalid code, please try again.",
        });
      }

      let userId = await getUserId(db, email);
      if (!userId) {
        userId = await createUser(db, email);
      }

      await deleteVerificationCodes(db, email);

      const sessionToken = generateSessionToken();
      const session = await createSession(db, sessionToken, userId, email);

      const cookie = createSessionCookie(SESSION_COOKIE_NAME, sessionToken, {
        secure: !dev,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      event.cookies.set(cookie.name, cookie.value, cookie.attributes as any);

      // If application/json, return JSON. Else, redirect to /analyze
      if (event.request.headers.get("accept")?.includes("application/json")) {
        const { user } = await validateSessionToken(db, sessionToken);
        return { success: true, session, user };
      } else {
        throw redirect(303, "/analyze");
      }
    } catch (error) {
      console.error("Authenticate action error:", error);
      return fail(500, {
        error: "An unexpected error occurred. Please try again later.",
      });
    }
  }),
};
