/**
 * Alert Service
 *
 * Handles alert matching logic and processing
 * Ported from src/lib/api/backend/alerts-push.ts
 */

import type { AlertInfo, MatchedAuction, AlertNotification } from './notifications/notification-channel';
import { AlertNotificationService } from './notifications/alert-notification-service';
import { MATCH_ALERTS_SQL, HETZNER_IPV4_COST_CENTS } from './alert-matching-sql';

export interface AlertServiceConfig {
	db: D1Database;
	notificationService: AlertNotificationService;
	doId: string;
}

export interface ProcessedAlert {
	alertId: number;
	notifications: number;
	success: boolean;
	error?: string;
}

// Field names mirror the column aliases of MATCH_ALERTS_SQL
interface MatchedAlertData {
	alert_id: number;
	name: string;
	filter: string;
	price: number;
	vat_rate: number;
	user_id: string;
	includes_ipv4_cost: boolean;
	email: string | null;
	discord_webhook_url: string | null;
	webhook_url: string | null;
	email_notifications: boolean;
	discord_notifications: boolean;
	webhook_notifications: boolean;
	created_at: string;
	auction_id: number;
	auction_price: number;
	seen: string;
}

export class AlertService {
	private db: D1Database;
	private notificationService: AlertNotificationService;
	private doId: string;

	// Constants
	private readonly HETZNER_IPV4_COST_CENTS = HETZNER_IPV4_COST_CENTS;

	// SQL queries — see ./alert-matching-sql.ts
	private readonly MATCH_ALERTS_SQL = MATCH_ALERTS_SQL;

	private readonly ALERT_HISTORY_INSERT_SQL = `
		INSERT INTO price_alert_history (id, name, filter, price, vat_rate, trigger_price, user_id, created_at, triggered_at, email_notifications, discord_notifications, webhook_notifications)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, current_timestamp, ?, ?, ?)
	`;

	private readonly ALERT_DELETE_SQL = `DELETE FROM price_alert WHERE id = ?`;

	private readonly ALERT_AUCTION_MATCHES_INSERT_SQL = `
		INSERT INTO alert_auction_matches (alert_history_id, auction_id, auction_seen_at, match_price)
		VALUES (?, ?, ?, ?)
	`;

	constructor(config: AlertServiceConfig) {
		this.db = config.db;
		this.notificationService = config.notificationService;
		this.doId = config.doId;
	}

	/**
	 * Process alerts for the current auction data
	 */
	async processAlerts(): Promise<ProcessedAlert[]> {
		console.log(`[AlertService ${this.doId}] Starting alert processing...`);

		try {
			// Find matching alerts
			const matchedAlerts = await this.findMatchingAlerts();

			if (matchedAlerts.length === 0) {
				console.log(`[AlertService ${this.doId}] No matching alerts found`);
				return [];
			}

			console.log(`[AlertService ${this.doId}] Found ${matchedAlerts.length} matching alerts`);

			// Group by alert ID
			const alertMap = this.groupAlertsByAlertId(matchedAlerts);
			console.log(`[AlertService ${this.doId}] Processing ${alertMap.size} unique alerts`);

			// Process all alerts in parallel
			const results = await Promise.allSettled(
				Array.from(alertMap.entries()).map(([, data]) => this.processAlert(data.alertInfo, data.matchedAuctions)),
			);

			// Collect results
			const processedAlerts: ProcessedAlert[] = results.map((result, index) => {
				const alertId = Array.from(alertMap.keys())[index];
				if (result.status === 'fulfilled') {
					return result.value;
				} else {
					console.error(`[AlertService ${this.doId}] Failed to process alert ${alertId}:`, result.reason);
					return {
						alertId,
						notifications: 0,
						success: false,
						error: result.reason?.message || 'Unknown error',
					};
				}
			});

			const successful = processedAlerts.filter((a) => a.success).length;
			console.log(`[AlertService ${this.doId}] Alert processing completed: ${successful}/${processedAlerts.length} successful`);

			return processedAlerts;
		} catch (error) {
			console.error(`[AlertService ${this.doId}] Alert processing failed:`, error);
			throw error;
		}
	}

	/**
	 * Find alerts that match current auction data
	 */
	private async findMatchingAlerts(): Promise<MatchedAlertData[]> {
		const matchStmt = this.db.prepare(this.MATCH_ALERTS_SQL);
		const result = await matchStmt.all();
		return result.results as MatchedAlertData[];
	}

	/**
	 * Group matched alerts by alert ID
	 */
	private groupAlertsByAlertId(matchedAlerts: MatchedAlertData[]): Map<
		number,
		{
			alertInfo: AlertInfo;
			matchedAuctions: MatchedAuction[];
		}
	> {
		const alertMap = new Map<number, { alertInfo: AlertInfo; matchedAuctions: MatchedAuction[] }>();

		for (const match of matchedAlerts) {
			if (!alertMap.has(match.alert_id)) {
				alertMap.set(match.alert_id, {
					alertInfo: {
						id: match.alert_id,
						name: match.name,
						filter: match.filter,
						price: match.price,
						vat_rate: match.vat_rate,
						user_id: match.user_id,
						includes_ipv4_cost: match.includes_ipv4_cost,
						email: match.email,
						discord_webhook_url: match.discord_webhook_url,
						webhook_url: match.webhook_url,
						email_notifications: match.email_notifications,
						discord_notifications: match.discord_notifications,
						webhook_notifications: match.webhook_notifications,
						created_at: match.created_at,
					},
					matchedAuctions: [],
				});
			}

			// Add this auction to the alert's matched auctions
			alertMap.get(match.alert_id)!.matchedAuctions.push({
				auction_id: match.auction_id,
				price: match.auction_price,
				seen: match.seen,
			});
		}

		return alertMap;
	}

	/**
	 * Process a single alert
	 */
	private async processAlert(alertInfo: AlertInfo, matchedAuctions: MatchedAuction[]): Promise<ProcessedAlert> {
		console.log(`[AlertService ${this.doId}] Processing alert ${alertInfo.id} with ${matchedAuctions.length} matched auctions`);

		try {
			// Find the lowest price among matched auctions
			const lowestAuctionPrice = Math.min(...matchedAuctions.map((a) => a.price));

			// Calculate trigger price including VAT and IPv4 cost if applicable
			const ipv4Cost = alertInfo.includes_ipv4_cost ? this.HETZNER_IPV4_COST_CENTS / 100 : 0;
			const triggerPrice = (lowestAuctionPrice + ipv4Cost) * (1 + alertInfo.vat_rate / 100.0);

			// Send notifications
			const notification: AlertNotification = {
				alert: alertInfo,
				triggerPrice,
				matchedAuctions,
				lowestAuctionPrice,
			};

			const notificationResults = await this.notificationService.sendNotification(notification);

			// Store alert history and matched auctions
			await this.storeAlertHistory(alertInfo, triggerPrice, matchedAuctions);

			// Delete the processed alert
			await this.deleteAlert(alertInfo.id);

			const successfulNotifications = notificationResults.filter((r) => r.success).length;
			return {
				alertId: alertInfo.id,
				notifications: successfulNotifications,
				success: true,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[AlertService ${this.doId}] Error processing alert ${alertInfo.id}:`, error);

			return {
				alertId: alertInfo.id,
				notifications: 0,
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Store alert history and matched auctions
	 */
	private async storeAlertHistory(alertInfo: AlertInfo, triggerPrice: number, matchedAuctions: MatchedAuction[]): Promise<void> {
		// Start a transaction
		const statements: D1PreparedStatement[] = [];

		// Insert alert history record
		const historyStmt = this.db.prepare(this.ALERT_HISTORY_INSERT_SQL);
		statements.push(
			historyStmt.bind(
				alertInfo.id,
				alertInfo.name,
				alertInfo.filter,
				alertInfo.price,
				alertInfo.vat_rate,
				triggerPrice,
				alertInfo.user_id,
				alertInfo.created_at,
				alertInfo.email_notifications ?? true,
				alertInfo.discord_notifications ?? false,
				alertInfo.webhook_notifications ?? false,
			),
		);

		// Execute the history insert
		await this.db.batch(statements);

		// Store matched auctions
		const auctionMatchStatements: D1PreparedStatement[] = [];
		const matchesStmt = this.db.prepare(this.ALERT_AUCTION_MATCHES_INSERT_SQL);

		for (const auction of matchedAuctions) {
			auctionMatchStatements.push(matchesStmt.bind(alertInfo.id, auction.auction_id, auction.seen, auction.price));
		}

		if (auctionMatchStatements.length > 0) {
			await this.db.batch(auctionMatchStatements);
		}
	}

	/**
	 * Delete a processed alert
	 */
	private async deleteAlert(alertId: number): Promise<void> {
		const deleteStmt = this.db.prepare(this.ALERT_DELETE_SQL);
		await deleteStmt.bind(alertId).run();
	}
}
