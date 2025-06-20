import { redirect } from '@sveltejs/kit';

export function load(event) {
	if (!event.locals.session) {
		redirect(303, `/auth/login`);
	}
}
