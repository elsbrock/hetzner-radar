/**
 * Cloud Availability Durable Object
 * 
 * Handles Hetzner Cloud server availability tracking
 */

import { DurableObject } from 'cloudflare:workers';
import { CloudStatusService } from './cloud-status-service';
import { NotificationService } from './notification-service';

interface CloudAvailabilityEnv {
	HETZNER_API_TOKEN: string;
	FETCH_INTERVAL_MS?: string;
	ANALYTICS_ENGINE?: AnalyticsEngineDataset;
	MAIN_APP_URL?: string;
	API_KEY?: string;
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

	constructor(ctx: DurableObjectState, env: CloudAvailabilityEnv) {
		super(ctx, env);

		this.ctx = ctx;
		this.env = env;
		this.fetchIntervalMs = env.FETCH_INTERVAL_MS ? parseInt(env.FETCH_INTERVAL_MS) : DEFAULT_FETCH_INTERVAL_MS;

		// Initialize services
		this.cloudStatusService = new CloudStatusService(env.HETZNER_API_TOKEN, ctx.storage, ctx.id.toString());
		this.notificationService = new NotificationService(ctx.storage, ctx.id.toString(), env.ANALYTICS_ENGINE, env.MAIN_APP_URL, env.API_KEY);

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
				this.fetchCloudStatus().catch((err) => console.error(`[CloudAvailabilityDO ${this.ctx.id}] Initial cloud status fetch failed:`, err));
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
				await this.notificationService.handleAvailabilityChanges(changes);
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
		console.log(`  - MAIN_APP_URL: ${this.env.MAIN_APP_URL ? `Present (${this.env.MAIN_APP_URL})` : 'MISSING'}`);
		console.log(`  - API_KEY: ${this.env.API_KEY ? 'Present' : 'MISSING'}`);
		console.log(`  - ANALYTICS_ENGINE: ${this.env.ANALYTICS_ENGINE ? 'Present' : 'MISSING'}`);
		console.log(`  - FETCH_INTERVAL_MS: ${this.fetchIntervalMs}ms`);
	}
}