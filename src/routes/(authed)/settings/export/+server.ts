import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	if (!event.locals.user) {
		return error(401, { message: 'Authentication required.' });
	}
	const db = event.platform?.env.DB;
	if (!db) {
		console.error('Database connection not available for exportData');
		return error(500, { message: 'Database connection error.' });
	}

	const userId = event.locals.user.id;

	try {
		const userData: any = await db.prepare('SELECT id, email, created_at FROM user WHERE id = ?').bind(userId).first();

		const sessionsQuery = await db.prepare('SELECT id, expires_at FROM session WHERE user_id = ?').bind(userId).all();
		const sessionsResults = sessionsQuery?.results || [];

		const priceAlertsQuery = await db.prepare('SELECT id, name, filter, price, created_at, vat_rate, includes_ipv4_cost FROM price_alert WHERE user_id = ?').bind(userId).all();
		const priceAlertsResults = priceAlertsQuery?.results || [];

		const priceAlertHistoryQuery = await db.prepare('SELECT id, name, filter, price, trigger_price, created_at, triggered_at, vat_rate FROM price_alert_history WHERE user_id = ?').bind(userId).all();
		const priceAlertHistoryRaw = priceAlertHistoryQuery?.results || [];
		
		const fullPriceAlertHistory = [];
		for (const historyItem of priceAlertHistoryRaw) {
			if (typeof (historyItem as any).id !== 'string' && typeof (historyItem as any).id !== 'number') {
				 console.warn('Skipping price alert history item with invalid ID:', historyItem);
				 continue;
			}
			const matchesQuery = await db.prepare('SELECT auction_id, auction_seen_at, match_price, matched_at FROM alert_auction_matches WHERE alert_history_id = ?').bind((historyItem as any).id).all();
			const matchesResults = matchesQuery?.results || [];
			fullPriceAlertHistory.push({
				...(historyItem as any),
				matches: matchesResults
			});
		}

		const exportPayload = {
			user: userData || {},
			sessions: sessionsResults,
			price_alerts: priceAlertsResults,
			price_alert_history: fullPriceAlertHistory
		};

		const jsonString = JSON.stringify(exportPayload, null, 2);

		return new Response(jsonString, {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': 'attachment; filename="sr_export.json"'
			}
		});

	} catch (e: any) {
		console.error('Failed to export GDPR data for user:', userId, e);
		const errorMessage = (e instanceof Error && e.message) ? e.message : 'An unknown error occurred.';
		// Using SvelteKit's json helper for error response
		return json({ message: `An error occurred while exporting your data: ${errorMessage}` }, { status: 500 });
	}
}