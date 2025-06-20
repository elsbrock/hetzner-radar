/**
 * Cloud Availability Durable Object
 *
 * Handles Hetzner Cloud server availability tracking
 */

import { DurableObject } from 'cloudflare:workers';
import { CloudStatusService } from './cloud-status-service';
import { NotificationService } from './notification-service';
import { CloudAlertService } from './cloud-alert-service';
import { CloudNotificationService } from './cloud-notifications/cloud-notification-service';

interface CloudAvailabilityEnv {
	HETZNER_API_TOKEN: string;
	FETCH_INTERVAL_MS?: string;
	ANALYTICS_ENGINE?: AnalyticsEngineDataset;
	FORWARDEMAIL_API_KEY?: string;
	DB: D1Database;
}

const DEFAULT_FETCH_INTERVAL_MS = 60 * 1000; // 1 minute

export class CloudAvailabilityDO extends DurableObject {
	ctx: DurableObjectState;
	env: CloudAvailabilityEnv;
	private fetchIntervalMs: number;
	private initializing: boolean = false;

	// Services
	private cloudStatusService: CloudStatusService;
	private notificationService: NotificationService;
	private cloudAlertService: CloudAlertService;
	private cloudNotificationService: CloudNotificationService;

	constructor(ctx: DurableObjectState, env: CloudAvailabilityEnv) {
		super(ctx, env);

		this.ctx = ctx;
		this.env = env;
		this.fetchIntervalMs = env.FETCH_INTERVAL_MS ? parseInt(env.FETCH_INTERVAL_MS) : DEFAULT_FETCH_INTERVAL_MS;

		// Initialize services
		this.cloudStatusService = new CloudStatusService(env.HETZNER_API_TOKEN, ctx.storage, ctx.id.toString());
		this.notificationService = new NotificationService(ctx.storage, ctx.id.toString(), env.ANALYTICS_ENGINE);

		// Initialize cloud alert notification service
		this.cloudNotificationService = new CloudNotificationService({
			email: env.FORWARDEMAIL_API_KEY
				? {
						apiKey: env.FORWARDEMAIL_API_KEY,
						fromName: 'Server Radar',
						fromEmail: 'no-reply@radar.iodev.org',
					}
				: undefined,
		});

		// Initialize cloud alert service
		this.cloudAlertService = new CloudAlertService({
			db: env.DB,
			notificationService: this.cloudNotificationService,
			doId: ctx.id.toString(),
		});

		this.logEnvironmentInfo();
	}

	async ensureInitialized(): Promise<void> {
		if (this.initializing) {
			console.log(`[CloudAvailabilityDO ${this.ctx.id}] Already initializing, skipping...`);
			return;
		}
		this.initializing = true;

		try {
			const currentAlarm = await this.ctx.storage.getAlarm();
			console.log(`[CloudAvailabilityDO ${this.ctx.id}] Current alarm: ${currentAlarm ? new Date(currentAlarm).toISOString() : 'none'}`);

			if (currentAlarm === null) {
				console.log(`[CloudAvailabilityDO ${this.ctx.id}] No alarm set, setting initial alarm.`);
				await this.ctx.storage.setAlarm(Date.now() + 5000);
			}

			const lastUpdated = await this.ctx.storage.get<string>('lastUpdated');
			console.log(`[CloudAvailabilityDO ${this.ctx.id}] Last cloud status updated: ${lastUpdated || 'never'}`);

			// Trigger initial fetch if needed
			if (!lastUpdated) {
				this.fetchCloudStatus().catch((err) =>
					console.error(`[CloudAvailabilityDO ${this.ctx.id}] Initial cloud status fetch failed:`, err),
				);
			}
		} catch (err) {
			console.error(`[CloudAvailabilityDO ${this.ctx.id}] Initialization check failed:`, err);
		} finally {
			this.initializing = false;
		}
	}

	async alarm(): Promise<void> {
		console.log(`[CloudAvailabilityDO ${this.ctx.id}] Alarm triggered for cloud status update...`);

		try {
			await this.fetchCloudStatus();
		} catch (error) {
			console.error(`[CloudAvailabilityDO ${this.ctx.id}] Failed to update cloud status:`, error);
		} finally {
			// Schedule next alarm
			const nextAlarmTime = Date.now() + this.fetchIntervalMs;
			await this.ctx.storage.setAlarm(nextAlarmTime);
			console.log(`[CloudAvailabilityDO ${this.ctx.id}] Next alarm scheduled for: ${new Date(nextAlarmTime).toISOString()}`);
		}
	}

	async fetch(request: Request): Promise<Response> {
		return new Response('This DO is accessed via RPC only', { status: 404 });
	}

	async getStatus() {
		try {
			await this.ensureInitialized();
			return await this.cloudStatusService.getStatus();
		} catch (error) {
			console.error(`[CloudAvailabilityDO ${this.ctx.id}] Error in getStatus RPC:`, error);
			throw error;
		}
	}

	private async fetchCloudStatus(): Promise<void> {
		try {
			const changes = await this.cloudStatusService.fetchAndUpdateStatus();
			if (changes && changes.length > 0) {
				console.log(`[CloudAvailabilityDO ${this.ctx.id}] Detected ${changes.length} availability changes`);

				// Send to legacy notification service (for analytics and main app webhook)
				await this.notificationService.handleAvailabilityChanges(changes);

				// Process cloud alerts with new notification system
				if (this.env.DB) {
					console.log(`[CloudAvailabilityDO ${this.ctx.id}] Processing cloud alerts for availability changes...`);
					const alertResult = await this.cloudAlertService.processAvailabilityChanges(changes);

					console.log(`[CloudAvailabilityDO ${this.ctx.id}] Cloud alert processing completed:`, {
						changesProcessed: alertResult.changesProcessed,
						alertsMatched: alertResult.alertsMatched,
						notificationsSent: alertResult.notificationsSent,
						success: alertResult.success,
					});
				} else {
					console.warn(`[CloudAvailabilityDO ${this.ctx.id}] DB not available, skipping cloud alert processing`);
				}
			} else {
				console.log(`[CloudAvailabilityDO ${this.ctx.id}] No availability changes detected`);
			}
		} catch (error) {
			console.error(`[CloudAvailabilityDO ${this.ctx.id}] Failed to update cloud status:`, error);
			throw error;
		}
	}

	private logEnvironmentInfo(): void {
		console.log(`[CloudAvailabilityDO ${this.ctx.id}] Environment variables check:`);
		console.log(`  - HETZNER_API_TOKEN: ${this.env.HETZNER_API_TOKEN ? 'Present' : 'MISSING'}`);
		console.log(`  - ANALYTICS_ENGINE: ${this.env.ANALYTICS_ENGINE ? 'Present' : 'MISSING'}`);
		console.log(`  - FORWARDEMAIL_API_KEY: ${this.env.FORWARDEMAIL_API_KEY ? 'Present' : 'MISSING'}`);
		console.log(`  - DB: ${this.env.DB ? 'Present' : 'MISSING'}`);
		console.log(`  - FETCH_INTERVAL_MS: ${this.fetchIntervalMs}ms`);
		console.log(`  - Cloud alert notification channels: ${this.cloudNotificationService.getChannels().join(', ')}`);
	}
}
