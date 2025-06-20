interface SessionCookieOptions {
	expires?: Date;
	path?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'lax' | 'strict' | 'none';
}

interface SessionCookie {
	name: string;
	value: string;
	attributes: Partial<SessionCookieOptions>;
	expires?: Date;
}

export function createSessionCookie(
	cookieName: string,
	token: string,
	options: SessionCookieOptions = {}
): SessionCookie {
	return {
		name: cookieName,
		value: token,
		attributes: {
			httpOnly: options.httpOnly ?? true,
			secure: options.secure ?? true,
			sameSite: options.sameSite ?? 'lax',
			path: options.path ?? '/',
			expires: options.expires
		}
	};
}

export function createBlankSessionCookie(cookieName: string): SessionCookie {
	return {
		name: cookieName,
		value: '',
		attributes: {
			path: '/',
			expires: new Date(0)
		}
	};
}
