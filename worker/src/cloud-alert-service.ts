/**
 * Cloud Alert Service
 *
 * Handles cloud availability alert matching and processing
 * Ported from src/routes/(internal)/notify/+server.ts
 */

import type { AvailabilityChange, CloudAlert, CloudAlertUser } from './cloud-notifications/cloud-notification-channel';
import { CloudNotificationService } from './cloud-notifications/cloud-notification-service';

export interface CloudAlertServiceConfig {
	db: D1Database;
	notificationService: CloudNotificationService;
	doId: string;
}

export interface ProcessedCloudAlert {
	changesProcessed: number;
	alertsMatched: number;
	notificationsSent: number;
	success: boolean;
	error?: string;
}

export class CloudAlertService {
	private db: D1Database;
	private notificationService: CloudNotificationService;
	private doId: string;

	// SQL queries
	private readonly GET_ACTIVE_ALERTS_SQL = `
		SELECT * FROM cloud_availability_alert ORDER BY created_at
	`;

	private readonly GET_USER_SQL = `
		SELECT id, email, discord_webhook_url FROM user WHERE id = ?
	`;

	private readonly INSERT_ALERT_HISTORY_SQL = `
		INSERT INTO cloud_alert_history 
		(id, alert_id, user_id, server_type_id, server_type_name, location_id, location_name, event_type) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`;

	constructor(config: CloudAlertServiceConfig) {
		this.db = config.db;
		this.notificationService = config.notificationService;
		this.doId = config.doId;
	}

	/**
	 * Process availability changes and send notifications
	 */
	async processAvailabilityChanges(changes: AvailabilityChange[]): Promise<ProcessedCloudAlert> {
		console.log(`[CloudAlertService ${this.doId}] Processing ${changes.length} availability changes`);

		try {
			if (changes.length === 0) {
				return {
					changesProcessed: 0,
					alertsMatched: 0,
					notificationsSent: 0,
					success: true,
				};
			}

			// Get all active cloud alerts
			const alerts = await this.getActiveCloudAlerts();
			console.log(`[CloudAlertService ${this.doId}] Found ${alerts.length} active cloud alerts`);

			if (alerts.length === 0) {
				return {
					changesProcessed: changes.length,
					alertsMatched: 0,
					notificationsSent: 0,
					success: true,
				};
			}

			// Process notifications
			const result = await this.notificationService.processAvailabilityChanges(changes, alerts, (userId: string) =>
				this.getUserById(userId),
			);

			// Record alert triggers in history
			await this.recordAlertTriggers(changes, alerts);

			const successfulNotifications = result.results.filter((r) => r.success).length;

			console.log(`[CloudAlertService ${this.doId}] Cloud alert processing completed:`, {
				changesProcessed: result.processed,
				alertsMatched: result.notifications,
				notificationsSent: successfulNotifications,
				totalResults: result.results.length,
			});

			return {
				changesProcessed: result.processed,
				alertsMatched: result.notifications,
				notificationsSent: successfulNotifications,
				success: true,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`[CloudAlertService ${this.doId}] Cloud alert processing failed:`, error);

			return {
				changesProcessed: 0,
				alertsMatched: 0,
				notificationsSent: 0,
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Get all active cloud alerts
	 */
	private async getActiveCloudAlerts(): Promise<CloudAlert[]> {
		const stmt = this.db.prepare(this.GET_ACTIVE_ALERTS_SQL);
		const result = await stmt.all();

		return result.results.map((raw) => this.parseCloudAlert(raw));
	}

	/**
	 * Get user by ID
	 */
	private async getUserById(userId: string): Promise<CloudAlertUser | null> {
		const stmt = this.db.prepare(this.GET_USER_SQL);
		const result = await stmt.bind(userId).first();

		if (!result) {
			return null;
		}

		return {
			id: result.id as string,
			email: result.email as string,
			discord_webhook_url: result.discord_webhook_url as string | undefined,
		};
	}

	/**
	 * Record alert triggers in history
	 */
	private async recordAlertTriggers(changes: AvailabilityChange[], alerts: CloudAlert[]): Promise<void> {
		const statements: D1PreparedStatement[] = [];
		const historyStmt = this.db.prepare(this.INSERT_ALERT_HISTORY_SQL);

		for (const change of changes) {
			for (const alert of alerts) {
				// Check if this alert matches the change
				const matchesServerType = alert.server_type_ids.includes(change.serverTypeId);
				const matchesLocation = alert.location_ids.includes(change.locationId);
				const matchesEventType = alert.alert_on === 'both' || alert.alert_on === change.eventType;

				if (matchesServerType && matchesLocation && matchesEventType) {
					const historyId = crypto.randomUUID();
					statements.push(
						historyStmt.bind(
							historyId,
							alert.id,
							alert.user_id,
							change.serverTypeId,
							change.serverTypeName,
							change.locationId,
							change.locationName,
							change.eventType,
						),
					);
				}
			}
		}

		if (statements.length > 0) {
			console.log(`[CloudAlertService ${this.doId}] Recording ${statements.length} alert triggers in history`);
			await this.db.batch(statements);
		}
	}

	/**
	 * Parse raw cloud alert from database
	 */
	private parseCloudAlert(raw: any): CloudAlert {
		return {
			id: raw.id,
			user_id: raw.user_id,
			name: raw.name,
			server_type_ids: JSON.parse(raw.server_type_ids),
			location_ids: JSON.parse(raw.location_ids),
			alert_on: raw.alert_on,
			email_notifications: Boolean(raw.email_notifications),
			discord_notifications: Boolean(raw.discord_notifications),
			created_at: raw.created_at,
		};
	}
}
