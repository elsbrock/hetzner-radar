/**
 * Alert Service
 *
 * Handles alert matching logic and processing
 * Ported from src/lib/api/backend/alerts-push.ts
 */

import type { AlertInfo, MatchedAuction, AlertNotification } from './notifications/notification-channel';
import { AlertNotificationService } from './notifications/alert-notification-service';

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

export class AlertService {
	private db: D1Database;
	private notificationService: AlertNotificationService;
	private doId: string;

	// Constants
	private readonly HETZNER_IPV4_COST_CENTS = 119; // €1.19 in cents

	// SQL queries
	private readonly MATCH_ALERTS_SQL = `
		WITH ConfigWithDriveStats AS (
			SELECT
				c.*,
				-- Compute min and max for HDD drives
				(SELECT MIN(value) FROM json_each(c.hdd_drives)) AS min_hdd_drive,
				(SELECT MAX(value) FROM json_each(c.hdd_drives)) AS max_hdd_drive,

				-- Compute min and max for NVMe drives
				(SELECT MIN(value) FROM json_each(c.nvme_drives)) AS min_nvme_drive,
				(SELECT MAX(value) FROM json_each(c.nvme_drives)) AS max_nvme_drive,

				-- Compute min and max for SATA drives
				(SELECT MIN(value) FROM json_each(c.sata_drives)) AS min_sata_drive,
				(SELECT MAX(value) FROM json_each(c.sata_drives)) AS max_sata_drive
			FROM
				current_auctions c
			WHERE
				1=1
		)

		SELECT 
			pa.id AS alert_id,
			pa.name,
			pa.price,
			pa.vat_rate,
			pa.user_id,
			pa.includes_ipv4_cost,
			pa.email_notifications,
			pa.discord_notifications,
			user.email,
			user.discord_webhook_url,
			pa.created_at,
			pa.filter,
			c.id AS auction_id,
			c.price AS auction_price,
			c.seen
		FROM
			price_alert pa
		JOIN
			ConfigWithDriveStats c
		ON
			1 = 1  -- Cross join; all filtering is handled in WHERE
		INNER JOIN
			user
		ON
			pa.user_id = user.id
		WHERE
			-- Price Conditions
			pa.price >= (c.price + (CASE WHEN pa.includes_ipv4_cost = 1 THEN ${this.HETZNER_IPV4_COST_CENTS / 100} ELSE 0 END)) * (1 + pa.vat_rate / 100.0)

			-- Location Conditions: ORed appropriately
			AND (
				(
					json_extract(pa.filter, '$.locationGermany') = 1
					AND c.location = 'Germany'
				)
				OR
				(
					json_extract(pa.filter, '$.locationFinland') = 1
					AND c.location = 'Finland'
				)
			)

			-- CPU Count
			AND c.cpu_count >= json_extract(pa.filter, '$.cpuCount')

			-- CPU Vendor Conditions: ORed appropriately
			AND (
				(
					json_extract(pa.filter, '$.cpuIntel') = 1
					AND c.cpu_vendor = 'Intel'
				)
				OR
				(
					json_extract(pa.filter, '$.cpuAMD') = 1
					AND c.cpu_vendor = 'AMD'
				)
			)

			-- RAM Internal Size (log2 transformation)
			AND (
				json_extract(pa.filter, '$.ramInternalSize[0]') <= (ln(c.ram_size) / ln(2))
				AND (ln(c.ram_size) / ln(2)) <= json_extract(pa.filter, '$.ramInternalSize[1]')
			)

			-- NVMe SSD Count
			AND c.nvme_count BETWEEN json_extract(pa.filter, '$.ssdNvmeCount[0]') AND json_extract(pa.filter, '$.ssdNvmeCount[1]')

			-- NVMe SSD Internal Size
			AND (
				json_extract(pa.filter, '$.ssdNvmeCount[0]') = 0
				OR (
					json_extract(pa.filter, '$.ssdNvmeInternalSize[0]') <=
						COALESCE(FLOOR(c.min_nvme_drive / 250.0), 0)
					AND
						(FLOOR(c.max_nvme_drive / 250.0) + CASE WHEN (c.max_nvme_drive / 250.0) > FLOOR(c.max_nvme_drive / 250.0) THEN 1 ELSE 0 END)
						<= json_extract(pa.filter, '$.ssdNvmeInternalSize[1]')
				)
			)

			-- SATA SSD Count
			AND c.sata_count BETWEEN json_extract(pa.filter, '$.ssdSataCount[0]') AND json_extract(pa.filter, '$.ssdSataCount[1]')

			-- SATA SSD Internal Size
			AND (
				json_extract(pa.filter, '$.ssdSataCount[0]') = 0
				OR (
					json_extract(pa.filter, '$.ssdSataInternalSize[0]') <=
						COALESCE(FLOOR(c.min_sata_drive / 250.0), 0)
					AND
						(FLOOR(c.max_sata_drive / 250.0) + CASE WHEN (c.max_sata_drive / 250.0) > FLOOR(c.max_sata_drive / 250.0) THEN 1 ELSE 0 END)
						<= json_extract(pa.filter, '$.ssdSataInternalSize[1]')
				)
			)

			-- HDD Count
			AND c.hdd_count BETWEEN json_extract(pa.filter, '$.hddCount[0]') AND json_extract(pa.filter, '$.hddCount[1]')

			-- HDD Internal Size
			AND (
				json_extract(pa.filter, '$.hddCount[0]') = 0
				OR (
					json_extract(pa.filter, '$.hddInternalSize[0]') <=
						COALESCE(FLOOR(c.min_hdd_drive / 500.0), 0)
					AND
						(FLOOR(c.max_hdd_drive / 500.0) + CASE WHEN (c.max_hdd_drive / 500.0) > FLOOR(c.max_hdd_drive / 500.0) THEN 1 ELSE 0 END)
						<= json_extract(pa.filter, '$.hddInternalSize[1]')
				)
			)

			-- Selected Datacenters
			AND (
				json_type(pa.filter, '$.selectedDatacenters') = 'null'
				OR json_array_length(json_extract(pa.filter, '$.selectedDatacenters')) = 0
				OR c.datacenter IN (
					SELECT value FROM json_each(pa.filter, '$.selectedDatacenters')
				)
			)

			-- Selected CPU Models
			AND (
				json_type(pa.filter, '$.selectedCpuModels') = 'null'
				OR json_array_length(json_extract(pa.filter, '$.selectedCpuModels')) = 0
				OR c.cpu IN (
					SELECT value FROM json_each(pa.filter, '$.selectedCpuModels')
				)
			)

			-- Extras: ECC
			AND (
				json_type(pa.filter, '$.extrasECC') = 'null'
				OR json_extract(pa.filter, '$.extrasECC') = c.is_ecc
			)

			-- Extras: INIC
			AND (
				json_type(pa.filter, '$.extrasINIC') = 'null'
				OR json_extract(pa.filter, '$.extrasINIC') = c.with_inic
			)

			-- Extras: HWR
			AND (
				json_type(pa.filter, '$.extrasHWR') = 'null'
				OR json_extract(pa.filter, '$.extrasHWR') = c.with_hwr
			)

			-- Extras: GPU
			AND (
				json_type(pa.filter, '$.extrasGPU') = 'null'
				OR json_extract(pa.filter, '$.extrasGPU') = c.with_gpu
			)

			-- Extras: RPS
			AND (
				json_type(pa.filter, '$.extrasRPS') = 'null'
				OR json_extract(pa.filter, '$.extrasRPS') = c.with_rps
			)
	`;

	private readonly ALERT_HISTORY_INSERT_SQL = `
		INSERT INTO price_alert_history (id, name, filter, price, vat_rate, trigger_price, user_id, created_at, triggered_at, email_notifications, discord_notifications)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, current_timestamp, ?, ?)
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
				Array.from(alertMap.entries()).map(([_, data]) => this.processAlert(data.alertInfo, data.matchedAuctions)),
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
	private async findMatchingAlerts(): Promise<any[]> {
		const matchStmt = this.db.prepare(this.MATCH_ALERTS_SQL);
		const result = await matchStmt.all();
		return result.results;
	}

	/**
	 * Group matched alerts by alert ID
	 */
	private groupAlertsByAlertId(matchedAlerts: any[]): Map<
		number,
		{
			alertInfo: AlertInfo;
			matchedAuctions: MatchedAuction[];
		}
	> {
		const alertMap = new Map();

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
						email_notifications: match.email_notifications,
						discord_notifications: match.discord_notifications,
						created_at: match.created_at,
					},
					matchedAuctions: [],
				});
			}

			// Add this auction to the alert's matched auctions
			alertMap.get(match.alert_id).matchedAuctions.push({
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
