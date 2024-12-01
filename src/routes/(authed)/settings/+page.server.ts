import { SESSION_COOKIE_NAME, invalidateSession } from '$lib/api/backend/session';
import { createBlankSessionCookie } from '$lib/cookie';
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { sendMail } from '$lib/mail';

export const actions: Actions = {
    delete: async (event) => {
        const db = event.platform?.env.DB;
        const email = await db.prepare('SELECT email FROM user WHERE id = ?').bind(event.locals.user.id).first('email');
        const blankCookie = createBlankSessionCookie(SESSION_COOKIE_NAME);
        await invalidateSession(event.platform?.env.DB, event.locals.session.id);
        event.cookies.set(blankCookie.name, blankCookie.value, blankCookie.attributes as any);
        await db.prepare("DELETE FROM user WHERE id = ?").bind(event.locals.user.id).run();

        await sendMail(event.platform?.env, {
            from: "Server Radar <mail@radar.iodev.org>",
            to: email,
            subject: "Account Deleted",
            text: `Greetings!

This is to notify you that your account on Server Radar has been successfully deleted.

We're sad to see you go and hope you'll come back soon. If you have any feedback, we'd love to hear it.

Cheers,
The Server Radar Team`,
        });

        throw redirect(302, '/');
    }
}