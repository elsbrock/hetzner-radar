import { dev } from "$app/environment";
import {
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
import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
    identify: rateLimit(async (event) => {
        const db = event.platform?.env.DB;
        const formData = await event.request.formData();
        const email = formData.get("email") as string;
        const tosAgree = formData.get("tosagree") as string;
        const cookieConsent = formData.get("cookieconsent") as string;

        if (!email) {
            return {
                success: false,
                error: "Invalid email, please try again.",
            };
        }
        const verificationCode = await generateEmailVerificationCode(db, email);
        console.log("verification code", verificationCode);

        await sendMail(event.platform?.env, {
            from: "Server Radar <no-reply@radar.iodev.org>",
            to: email,
            subject: "Your Magic Sign-In Code",
            text: `Greetings!

You've requested to sign in to Server Radar. Here's your magic code:

  ${verificationCode}

You've got 15 minutes to use it before it expires. If you didn't request this, just ignore this email – no action needed on your part.

Cheers,
The Server Radar Team`,
        });

        return { success: true };
    }),

    authenticate: rateLimit(async (event) => {
        const db = event.platform?.env.DB;
        const formData = await event.request.formData();
        const code = formData.get("code") as string;
        const email = formData.get("email") as string;

        console.log(await db.prepare("SELECT * FROM email_verification_code").all());

        if (!code) {
            return { success: false, error: "Invalid code, please try again." };
        }

        const codeExists = await verifyCodeExists(db, email, code);
        if (!codeExists) {
            return { success: false, error: "Invalid code, please try again." };
        }

        let userId = await getUserId(db, email);
        if (!userId) {
            userId = await createUser(db, email);
        }

        await deleteVerificationCodes(db, email);

        const sessionToken = generateSessionToken();
        const session = await createSession(db, sessionToken, userId, email);

        const cookie = createSessionCookie(SESSION_COOKIE_NAME, sessionToken, {
            secure: !dev
        });
        event.cookies.set(cookie.name, cookie.value, cookie.attributes as any);

        // if application/json, return json. else, redirect to /analyze
        if (event.request.headers.get("accept") === "application/json") {
            const { user } = await validateSessionToken(db, sessionToken);
            return { success: true, session, user };
        } else {
            throw redirect(303, "/analyze");
        }
    }),
};
