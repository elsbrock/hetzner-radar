/**
 * Notification Service
 *
 * Handles availability change notifications and analytics
 */

import type { AvailabilityChange, ServerTypeInfo } from './cloud-status-service';

export class NotificationService {
	private analyticsEngine?: AnalyticsEngineDataset;
	private doId: string;
	private storage: DurableObjectStorage;

	constructor(storage: DurableObjectStorage, doId: string, analyticsEngine?: AnalyticsEngineDataset) {
		this.storage = storage;
		this.doId = doId;
		this.analyticsEngine = analyticsEngine;
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

		// NOTE: Cloud alert processing now handled by CloudAlertService
		// Legacy main app notification removed to avoid duplicate processing
		console.log(`[NotificationService ${this.doId}] Cloud alert processing handled by CloudAlertService, not calling legacy endpoint`);
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
}
