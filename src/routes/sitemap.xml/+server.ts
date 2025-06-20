import type { RequestHandler } from '@sveltejs/kit';
import * as sitemap from 'super-sitemap';

export const GET: RequestHandler = async () => {
	return await sitemap.response({
		origin: 'https://radar.iodev.org'
	});
};
