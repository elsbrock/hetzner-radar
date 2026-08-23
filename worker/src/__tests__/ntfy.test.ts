/**
 * Tests for ntfy request formatting
 */

import { describe, it, expect } from 'vitest';
import { isNtfyUrl, buildNtfyRequest } from '../notifications/ntfy';

describe('isNtfyUrl', () => {
	it('recognises the hosted service, including topic aliases', () => {
		expect(isNtfyUrl('https://ntfy.sh/my-topic')).toBe(true);
		expect(isNtfyUrl('https://ntfy.sh/my-topic/publish')).toBe(true);
		expect(isNtfyUrl('https://NTFY.SH/my-topic')).toBe(true);
	});

	it('leaves everything else on the generic JSON contract', () => {
		// Self-hosted instances are not detectable from the URL alone.
		expect(isNtfyUrl('https://ntfy.example.com/my-topic')).toBe(false);
		expect(isNtfyUrl('https://example.com/hooks/radar')).toBe(false);
		// A lookalike host must not match on suffix.
		expect(isNtfyUrl('https://notntfy.sh/my-topic')).toBe(false);
		expect(isNtfyUrl('https://evil.com/?x=ntfy.sh')).toBe(false);
	});

	it('does not throw on unparseable URLs', () => {
		expect(isNtfyUrl('not a url')).toBe(false);
		expect(isNtfyUrl('')).toBe(false);
	});
});

describe('buildNtfyRequest', () => {
	it('puts the message in the body and metadata in X-* headers', () => {
		const request = buildNtfyRequest({
			title: 'Price alert: Cheap AX41',
			message: '2 matching servers from €39.99',
			click: 'https://radar.iodev.org/alerts?view=1',
			tags: ['moneybag', 'bell'],
		});

		expect(request.body).toBe('2 matching servers from €39.99');
		expect(request.headers['X-Title']).toBe('Price alert: Cheap AX41');
		expect(request.headers['X-Click']).toBe('https://radar.iodev.org/alerts?view=1');
		expect(request.headers['X-Tags']).toBe('moneybag,bell');
		expect(request.headers['Content-Type']).toBe('text/plain; charset=utf-8');
	});

	it('omits optional headers when not supplied', () => {
		const request = buildNtfyRequest({ title: 'T', message: 'M' });

		expect(request.headers).not.toHaveProperty('X-Click');
		expect(request.headers).not.toHaveProperty('X-Tags');
	});

	it('RFC 2047-encodes non-ASCII titles, which fetch would otherwise reject', () => {
		const request = buildNtfyRequest({
			title: 'Preisalarm: Günstige Server – 64GB',
			message: 'body',
		});

		expect(request.headers['X-Title']).toBe('=?UTF-8?B?UHJlaXNhbGFybTogR8O8bnN0aWdlIFNlcnZlciDigJMgNjRHQg==?=');
	});
});
