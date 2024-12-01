import {
    SESSION_COOKIE_NAME,
    invalidateSession,
} from "$lib/api/backend/session";
import { createBlankSessionCookie } from "$lib/cookie";
import type { Actions } from "./$types";

export const actions: Actions = {
    default: async (event) => {
        const blankCookie = createBlankSessionCookie(SESSION_COOKIE_NAME);
        event.cookies.set(
            blankCookie.name,
            blankCookie.value,
            blankCookie.attributes as any,
        );
        if (event.locals.session?.id) {
            await invalidateSession(
                event.platform?.env.DB,
                event.locals.session.id,
            );
        }
    },
};
