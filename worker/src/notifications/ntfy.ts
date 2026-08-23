/**
 * ntfy (https://ntfy.sh) request formatting.
 *
 * Our generic webhook contract is a JSON envelope, which ntfy does not
 * understand: with a topic in the URL it treats the whole request body as the
 * message text, so subscribers get a raw JSON dump — and once that body grows
 * past ~4 KB ntfy converts it into a file attachment, so the notification reads
 * "You received a file: attachment.json" instead. Posting our envelope to an
 * instance root instead fails outright with `40009 topic invalid`, because ntfy's
 * own JSON publish format expects a `topic` field.
 *
 * So for ntfy we send what it actually expects: a plain-text body (the message)
 * plus X-* headers for the title, click action and tags. Publishing that way
 * needs no topic parsing, which means every URL alias a user might paste
 * (`/topic`, `/topic/publish`, ...) behaves identically.
 *
 * Detection is deliberately limited to the hosted service — see `isNtfyUrl`.
 */

/**
 * Hosts served by the hosted ntfy instance.
 *
 * Self-hosted instances live on arbitrary domains and cannot be recognised from
 * the URL alone. They keep receiving the generic JSON envelope, which is a
 * usable contract for a relay or bot even though it is a poor ntfy message. If
 * self-hosters ask for this, the way in is sniffing the publish response (ntfy
 * echoes the stored message object back) and persisting the result per user —
 * deliberately not built yet, because it needs a schema change to be worth it.
 */
const NTFY_HOSTS = new Set(['ntfy.sh']);

export interface NtfyMessage {
	title: string;
	/** Body of the notification. Keep it short — ntfy truncates past 4 KB. */
	message: string;
	/** URL opened when the notification is tapped. */
	click?: string;
	/** ntfy tag names or emoji shortcodes, e.g. `moneybag`. */
	tags?: string[];
}

/** Body and headers for an outbound webhook request, ready to hand to fetch. */
export interface WebhookRequest {
	body: string;
	headers: Record<string, string>;
}

/**
 * Whether `webhookUrl` points at the hosted ntfy service and should therefore be
 * sent ntfy's native format rather than our JSON envelope.
 */
export function isNtfyUrl(webhookUrl: string): boolean {
	try {
		return NTFY_HOSTS.has(new URL(webhookUrl).hostname.toLowerCase());
	} catch {
		// Unparseable URLs are somebody else's problem; fetch will reject it.
		return false;
	}
}

/**
 * HTTP header values are limited to ISO-8859-1, but alert names are
 * user-supplied and this audience writes German. ntfy accepts RFC 2047
 * encoded-words for header values, so anything outside printable ASCII goes out
 * base64-encoded rather than throwing in fetch or arriving as mojibake.
 */
function encodeHeaderValue(value: string): string {
	if (/^[\x20-\x7E]*$/.test(value)) {
		return value;
	}

	const utf8 = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of utf8) {
		binary += String.fromCharCode(byte);
	}

	return `=?UTF-8?B?${btoa(binary)}?=`;
}

/** Builds the body and headers for a native ntfy publish request. */
export function buildNtfyRequest(message: NtfyMessage): WebhookRequest {
	const headers: Record<string, string> = {
		'Content-Type': 'text/plain; charset=utf-8',
		'User-Agent': 'ServerRadar-Webhook/1.0 (+https://radar.iodev.org)',
		'X-Title': encodeHeaderValue(message.title),
	};

	if (message.click) {
		headers['X-Click'] = message.click;
	}

	if (message.tags?.length) {
		headers['X-Tags'] = message.tags.join(',');
	}

	return { body: message.message, headers };
}
