import { SESSION_COOKIE_NAME, validateSessionToken } from '$lib/api/backend/session';
import { createBlankSessionCookie, createSessionCookie } from '$lib/cookie';
import type { Handle } from '@sveltejs/kit';

/** @type {import('@sveltejs/kit').HandleServerError} */
export async function handleError({ error, event }) {
	const errorId = crypto.randomUUID();

	console.error('unhandled error', event, error, errorId);

	return {
		message: 'Whoops! ' + (error instanceof Error ? error.message : 'An unexpected error occurred'), // Use error.message for clarity
		errorId
	};
}

export const handle: Handle = async ({ event, resolve }) => {
	const db = event.platform?.env.DB;

	// Retrieve the session token from cookies
	const sessionToken = event.cookies.get(SESSION_COOKIE_NAME);

	if (!sessionToken) {
		// No session token present
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	// Validate the session token
	const { session, user } = await validateSessionToken(db, sessionToken);

	if (session && user) {
		// At this point, validateSessionToken has already checked for expiration
		// and renewed the session if it's nearing expiration.

		// Assign the user and session to locals
		event.locals.user = user;
		event.locals.session = session;

		// Refresh the session cookie with the updated expiresAt from the session
		const refreshedCookie = createSessionCookie(SESSION_COOKIE_NAME, sessionToken, {
			expires: session.expiresAt, // Use the updated expiresAt from the session
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax'
		});

		event.cookies.set(refreshedCookie.name, refreshedCookie.value, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			expires: refreshedCookie.expires, // Ensure expires is set correctly
			...refreshedCookie.attributes
		});
	} else {
		// Invalid or expired session token
		event.locals.user = null;
		event.locals.session = null;

		// Clear the session cookie
		const blankCookie = createBlankSessionCookie(SESSION_COOKIE_NAME);
		event.cookies.set(blankCookie.name, blankCookie.value, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			...blankCookie.attributes
		});
	}

	return resolve(event);
};
