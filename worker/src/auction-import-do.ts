/**
 * Auction Import Durable Object
 *
 * Handles Hetzner auction data import
 */

import { DurableObject } from 'cloudflare:workers';
import { AuctionService } from './auction-service';
import { NotificationService } from './notification-service';
import { AlertService } from './alert-service';
import { AlertNotificationService } from './notifications/alert-notification-service';

interface AuctionImportEnv {
	DB: D1Database;
	AUCTION_IMPORT_INTERVAL_MS?: string;
	HETZNER_AUCTION_API_URL?: string;
	ANALYTICS_ENGINE?: AnalyticsEngineDataset;
	FORWARDEMAIL_API_KEY?: string;
}

const DEFAULT_AUCTION_IMPORT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_HETZNER_AUCTION_API_URL = 'https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json';

export class AuctionImportDO extends DurableObject {
	ctx: DurableObjectState;
	env: AuctionImportEnv;
	private auctionImportIntervalMs: number;
	private hetznerAuctionApiUrl: string;
	private initializing: boolean = false;

	// Services
	private auctionService: AuctionService;
	private notificationService: NotificationService;
	private alertService: AlertService;
	private alertNotificationService: AlertNotificationService;

	constructor(ctx: DurableObjectState, env: AuctionImportEnv) {
		super(ctx, env);

		this.ctx = ctx;
		this.env = env;
		this.auctionImportIntervalMs = env.AUCTION_IMPORT_INTERVAL_MS
			? parseInt(env.AUCTION_IMPORT_INTERVAL_MS)
			: DEFAULT_AUCTION_IMPORT_INTERVAL_MS;
		this.hetznerAuctionApiUrl = env.HETZNER_AUCTION_API_URL || DEFAULT_HETZNER_AUCTION_API_URL;

		// Initialize services
		this.auctionService = new AuctionService(this.hetznerAuctionApiUrl, env.DB, ctx.storage, ctx.id.toString());
		this.notificationService = new NotificationService(ctx.storage, ctx.id.toString(), env.ANALYTICS_ENGINE);

		// Initialize alert notification service
		this.alertNotificationService = new AlertNotificationService({
			email: env.FORWARDEMAIL_API_KEY
				? {
						apiKey: env.FORWARDEMAIL_API_KEY,
						fromName: 'Server Radar',
						fromEmail: 'no-reply@radar.iodev.org',
					}
				: undefined,
		});

		// Initialize alert service
		this.alertService = new AlertService({
			db: env.DB,
			notificationService: this.alertNotificationService,
			doId: ctx.id.toString(),
		});

		this.logEnvironmentInfo();
	}

	async ensureInitialized(): Promise<void> {
		if (this.initializing) {
			console.log(`[AuctionImportDO ${this.ctx.id}] Already initializing, skipping...`);
			return;
		}
		this.initializing = true;

		try {
			const currentAlarm = await this.ctx.storage.getAlarm();
			console.log(`[AuctionImportDO ${this.ctx.id}] Current alarm: ${currentAlarm ? new Date(currentAlarm).toISOString() : 'none'}`);

			if (currentAlarm === null) {
				console.log(`[AuctionImportDO ${this.ctx.id}] No alarm set, setting initial alarm.`);
				await this.ctx.storage.setAlarm(Date.now() + 10000); // 10 seconds delay to stagger with cloud availability
			}

			const lastAuctionImport = await this.ctx.storage.get<string>('lastAuctionImport');
			console.log(`[AuctionImportDO ${this.ctx.id}] Last auction import: ${lastAuctionImport || 'never'}`);

			// Trigger initial import if needed
			if (!lastAuctionImport) {
				this.fetchAuctions().catch((err) => console.error(`[AuctionImportDO ${this.ctx.id}] Initial auction import failed:`, err));
			}
		} catch (err) {
			console.error(`[AuctionImportDO ${this.ctx.id}] Initialization check failed:`, err);
		} finally {
			this.initializing = false;
		}
	}

	async alarm(): Promise<void> {
		console.log(`[AuctionImportDO ${this.ctx.id}] Alarm triggered for auction import...`);

		try {
			await this.fetchAuctions();
		} catch (error) {
			console.error(`[AuctionImportDO ${this.ctx.id}] Failed to import auctions:`, error);
		} finally {
			// Schedule next alarm
			const nextAlarmTime = Date.now() + this.auctionImportIntervalMs;
			await this.ctx.storage.setAlarm(nextAlarmTime);
			console.log(`[AuctionImportDO ${this.ctx.id}] Next alarm scheduled for: ${new Date(nextAlarmTime).toISOString()}`);
		}
	}

	async fetch(): Promise<Response> {
		return new Response('This DO is accessed via RPC only', { status: 404 });
	}

	async getAuctionStats() {
		try {
			await this.ensureInitialized();

			if (!this.env.DB) {
				throw new Error('D1 database is not configured.');
			}

			const [currentAuctionsCount, latestBatch, lastImport] = await Promise.all([
				this.env.DB.prepare('SELECT COUNT(*) as count FROM current_auctions').first(),
				this.env.DB.prepare('SELECT * FROM latest_batch WHERE id = 1').first(),
				this.ctx.storage.get<string>('lastAuctionImport'),
			]);

			return {
				currentAuctions: currentAuctionsCount?.count || 0,
				latestBatch: latestBatch?.batch_time || null,
				lastUpdated: latestBatch?.updated_at || null,
				lastImport: lastImport || null,
			};
		} catch (error) {
			console.error(`[AuctionImportDO ${this.ctx.id}] Error in getAuctionStats RPC:`, error);
			throw error;
		}
	}

	private async fetchAuctions(): Promise<void> {
		let auctionImportResult: unknown = null;
		let alertProcessingResult: unknown[] = [];

		try {
			// Import auction data
			auctionImportResult = await this.auctionService.fetchAndImportAuctions();
			console.log(`[AuctionImportDO ${this.ctx.id}] Auction import completed:`, auctionImportResult);

			// Process alerts if auction import was successful
			if (auctionImportResult && (auctionImportResult.newAuctions > 0 || auctionImportResult.priceChanges > 0)) {
				console.log(`[AuctionImportDO ${this.ctx.id}] Processing alerts after auction changes...`);
				alertProcessingResult = await this.alertService.processAlerts();

				const successfulAlerts = alertProcessingResult.filter((a) => a.success).length;
				const totalNotifications = alertProcessingResult.reduce((sum, a) => sum + a.notifications, 0);

				console.log(
					`[AuctionImportDO ${this.ctx.id}] Alert processing completed: ${successfulAlerts}/${alertProcessingResult.length} alerts processed, ${totalNotifications} notifications sent`,
				);
			} else {
				console.log(`[AuctionImportDO ${this.ctx.id}] No auction changes detected, skipping alert processing`);
			}
		} catch (error: unknown) {
			console.error(`[AuctionImportDO ${this.ctx.id}] Failed during auction import/alert processing:`, error);
			throw error;
		}
	}

	private logEnvironmentInfo(): void {
		console.log(`[AuctionImportDO ${this.ctx.id}] Environment variables check:`);
		console.log(`  - DB: ${this.env.DB ? 'Present' : 'MISSING'}`);
		console.log(`  - ANALYTICS_ENGINE: ${this.env.ANALYTICS_ENGINE ? 'Present' : 'MISSING'}`);
		console.log(`  - AUCTION_IMPORT_INTERVAL_MS: ${this.auctionImportIntervalMs}ms`);
		console.log(`  - HETZNER_AUCTION_API_URL: ${this.hetznerAuctionApiUrl}`);
		console.log(`  - FORWARDEMAIL_API_KEY: ${this.env.FORWARDEMAIL_API_KEY ? 'Present' : 'MISSING'}`);
		console.log(`  - Alert notification channels: ${this.alertNotificationService.getChannels().join(', ')}`);
	}
}
