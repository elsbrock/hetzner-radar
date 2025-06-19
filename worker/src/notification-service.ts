/**
 * Notification Service
 * 
 * Handles availability change notifications and analytics
 */

import type { AvailabilityChange, ServerTypeInfo } from './cloud-status-service';

export class NotificationService {
	private analyticsEngine?: AnalyticsEngineDataset;
	private mainAppUrl?: string;
	private apiKey?: string;
	private doId: string;
	private storage: DurableObjectStorage;

	constructor(
		storage: DurableObjectStorage,
		doId: string,
		analyticsEngine?: AnalyticsEngineDataset,
		mainAppUrl?: string,
		apiKey?: string
	) {
		this.storage = storage;
		this.doId = doId;
		this.analyticsEngine = analyticsEngine;
		this.mainAppUrl = mainAppUrl;
		this.apiKey = apiKey;
	}

	async handleAvailabilityChanges(changes: AvailabilityChange[]): Promise<void> {
		if (changes.length === 0) return;

		console.log(`[NotificationService ${this.doId}] Handling ${changes.length} availability changes...`);

		// Write to Analytics Engine if available
		if (this.analyticsEngine) {
			console.log(`[NotificationService ${this.doId}] Writing to Analytics Engine...`);
			try {
				await this.writeToAnalyticsEngine(changes);
			} catch (error) {
				console.error(`[NotificationService ${this.doId}] Failed to write to Analytics Engine:`, error);
			}
		}

		// Notify main app if configured
		if (this.mainAppUrl && this.apiKey) {
			console.log(`[NotificationService ${this.doId}] Notifying main app at ${this.mainAppUrl}...`);
			try {
				await this.notifyMainApp(changes);
			} catch (error) {
				console.error(`[NotificationService ${this.doId}] Failed to notify main app:`, error);
			}
		} else {
			console.log(`[NotificationService ${this.doId}] Main app notification not configured:`);
			console.log(`  - MAIN_APP_URL: ${this.mainAppUrl || 'MISSING'}`);
			console.log(`  - API_KEY: ${this.apiKey ? 'Present' : 'MISSING'}`);
		}
	}

	private async writeToAnalyticsEngine(changes: AvailabilityChange[]): Promise<void> {
		if (!this.analyticsEngine) return;

		const serverTypes = (await this.storage.get<ServerTypeInfo[]>('serverTypes')) || [];
		const serverTypeMap = new Map(serverTypes.map((st) => [st.id, st]));

		for (const change of changes) {
			const serverType = serverTypeMap.get(change.serverTypeId);

			this.analyticsEngine.writeDataPoint({
				blobs: [String(change.serverTypeId), String(change.locationId), change.eventType, change.serverTypeName, change.locationName],
				doubles: [change.eventType === 'available' ? 1 : 0, serverType?.cores || 0, serverType?.memory || 0],
				indexes: [change.serverTypeName],
			});
		}

		console.log(`[NotificationService ${this.doId}] Wrote ${changes.length} data points to Analytics Engine`);
	}

	private async notifyMainApp(changes: AvailabilityChange[]): Promise<void> {
		if (!this.mainAppUrl || !this.apiKey) return;

		const url = `${this.mainAppUrl}/notify`;
		const requestBody = { changes };

		console.log(`[NotificationService ${this.doId}] Sending notification request to ${url}`);

		const startTime = Date.now();

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
					'x-auth-key': this.apiKey,
				},
				body: JSON.stringify(requestBody),
			});

			const duration = Date.now() - startTime;
			console.log(`[NotificationService ${this.doId}] Notification response received in ${duration}ms: ${response.status}`);

			if (!response.ok) {
				const responseText = await response.text();
				throw new Error(`Main app notification failed: ${response.status} ${responseText}`);
			}

			console.log(`[NotificationService ${this.doId}] Successfully notified main app about ${changes.length} changes`);
		} catch (error) {
			console.error(`[NotificationService ${this.doId}] Notification request failed:`, error);
			throw error;
		}
	}

	async writeImportAnalytics(success: boolean, stats?: any, duration?: number, error?: string): Promise<void> {
		if (!this.analyticsEngine) return;

		try {
			if (success && stats) {
				this.analyticsEngine.writeDataPoint({
					blobs: ['auction_import', 'success'],
					doubles: [stats.processed || 0, stats.newAuctions || 0, stats.priceChanges || 0, duration || 0],
					indexes: ['auction_import_success'],
				});
			} else {
				this.analyticsEngine.writeDataPoint({
					blobs: ['auction_import', 'error', error || 'unknown'],
					doubles: [duration || 0],
					indexes: ['auction_import_error'],
				});
			}
		} catch (analyticsError) {
			console.error(`[NotificationService ${this.doId}] Failed to write analytics:`, analyticsError);
		}
	}
}