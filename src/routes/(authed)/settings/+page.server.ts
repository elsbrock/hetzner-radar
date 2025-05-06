import { SESSION_COOKIE_NAME, invalidateSession } from '$lib/api/backend/session';
import { createBlankSessionCookie } from '$lib/cookie';
import { sendMail } from '$lib/mail';
import { redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const actions: Actions = {
    delete: async (event) => {
        if (!event.locals.user || !event.locals.session) {
            return error(401, { message: 'Authentication required.' });
        }
        const db = event.platform?.env.DB;
        if (!db) {
            console.error('Database connection not available for delete action');
            return error(500, { message: 'Database connection error.' });
        }

        const userRecord: any = await db.prepare('SELECT email FROM user WHERE id = ?').bind(event.locals.user.id).first();
        
        let userEmail: string | null = null;
        if (userRecord && typeof userRecord.email === 'string') {
            userEmail = userRecord.email;
        }

        if (!userEmail) {
            console.error(`Could not find email for user ${event.locals.user.id}`);
            return error(500, { message: 'Could not retrieve user email.' });
        }

        const blankCookie = createBlankSessionCookie(SESSION_COOKIE_NAME);
        await invalidateSession(db, event.locals.session.id);
        event.cookies.set(blankCookie.name, blankCookie.value, blankCookie.attributes as any);
        await db.prepare("DELETE FROM user WHERE id = ?").bind(event.locals.user.id).run();

        await sendMail(event.platform?.env, {
            from: {
                name: "Server Radar",
                email: "mail@radar.iodev.org",
            },
            to: userEmail,
            subject: "Account Deleted",
            text: `Greetings!

This is to notify you that your account on Server Radar has been successfully deleted.

We're sad to see you go and hope you'll come back soon. If you have any feedback, we'd love to hear it.

Cheers,
Server Radar
--
https://radar.iodev.org/`,
        });

        throw redirect(302, '/');
    }
};
