/**
 * Auction Import Durable Object
 * 
 * Handles Hetzner auction data import
 */

import { DurableObject } from 'cloudflare:workers';
import { AuctionService } from './auction-service';
import { NotificationService } from './notification-service';

interface AuctionImportEnv {
	DB: D1Database;
	AUCTION_IMPORT_INTERVAL_MS?: string;
	HETZNER_AUCTION_API_URL?: string;
	ANALYTICS_ENGINE?: AnalyticsEngineDataset;
	MAIN_APP_URL?: string;
	API_KEY?: string;
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

	constructor(ctx: DurableObjectState, env: AuctionImportEnv) {
		super(ctx, env);

		this.ctx = ctx;
		this.env = env;
		this.auctionImportIntervalMs = env.AUCTION_IMPORT_INTERVAL_MS ? parseInt(env.AUCTION_IMPORT_INTERVAL_MS) : DEFAULT_AUCTION_IMPORT_INTERVAL_MS;
		this.hetznerAuctionApiUrl = env.HETZNER_AUCTION_API_URL || DEFAULT_HETZNER_AUCTION_API_URL;

		// Initialize services
		this.auctionService = new AuctionService(this.hetznerAuctionApiUrl, env.DB, ctx.storage, ctx.id.toString());
		this.notificationService = new NotificationService(ctx.storage, ctx.id.toString(), env.ANALYTICS_ENGINE, env.MAIN_APP_URL, env.API_KEY);

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

	async fetch(request: Request): Promise<Response> {
		await this.ensureInitialized();

		const url = new URL(request.url);
		
		if (url.pathname === '/import' && request.method === 'POST') {
			try {
				console.log(`[AuctionImportDO ${this.ctx.id}] Manual auction import triggered`);
				const result = await this.auctionService.fetchAndImportAuctions();
				
				return new Response(JSON.stringify({ 
					success: true, 
					message: 'Auction import completed successfully',
					...result
				}), {
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (error: any) {
				console.error(`[AuctionImportDO ${this.ctx.id}] Manual auction import failed:`, error);
				return new Response(JSON.stringify({ 
					success: false, 
					error: error?.error?.message || error?.message || String(error),
					duration: error?.duration
				}), { 
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname === '/debug' && request.method === 'GET') {
			try {
				const lastAuctionImport = await this.ctx.storage.get<string>('lastAuctionImport');
				const currentAlarm = await this.ctx.storage.getAlarm();
				
				return new Response(JSON.stringify({
					type: 'auction-import',
					lastAuctionImport: lastAuctionImport || 'never',
					nextAlarm: currentAlarm ? new Date(currentAlarm).toISOString() : 'none',
					interval: `${this.auctionImportIntervalMs}ms`,
					auctionApiUrl: this.hetznerAuctionApiUrl,
					doId: this.ctx.id.toString()
				}), {
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (error) {
				return new Response('Error fetching debug info', { status: 500 });
			}
		}

		if (url.pathname === '/stats' && request.method === 'GET') {
			try {
				// Get some basic stats from the database
				if (!this.env.DB) {
					return new Response('Database not available', { status: 500 });
				}

				const currentAuctionsCount = await this.env.DB.prepare('SELECT COUNT(*) as count FROM current_auctions').first();
				const latestBatch = await this.env.DB.prepare('SELECT * FROM latest_batch WHERE id = 1').first();
				
				return new Response(JSON.stringify({
					currentAuctions: currentAuctionsCount?.count || 0,
					latestBatch: latestBatch?.batch_time || 'never',
					lastUpdated: latestBatch?.updated_at || 'never'
				}), {
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (error) {
				console.error(`[AuctionImportDO ${this.ctx.id}] Error fetching stats:`, error);
				return new Response('Error fetching stats', { status: 500 });
			}
		}

		return new Response('Available endpoints:\n- POST /import\n- GET /debug\n- GET /stats', { status: 404 });
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
		try {
			const result = await this.auctionService.fetchAndImportAuctions();
			console.log(`[AuctionImportDO ${this.ctx.id}] Auction import completed:`, result);
			await this.notificationService.writeImportAnalytics(true, result, result.duration);
		} catch (error: any) {
			console.error(`[AuctionImportDO ${this.ctx.id}] Failed to import auctions:`, error);
			await this.notificationService.writeImportAnalytics(false, undefined, error?.error?.message || error?.message);
			throw error;
		}
	}

	private logEnvironmentInfo(): void {
		console.log(`[AuctionImportDO ${this.ctx.id}] Environment variables check:`);
		console.log(`  - DB: ${this.env.DB ? 'Present' : 'MISSING'}`);
		console.log(`  - ANALYTICS_ENGINE: ${this.env.ANALYTICS_ENGINE ? 'Present' : 'MISSING'}`);
		console.log(`  - AUCTION_IMPORT_INTERVAL_MS: ${this.auctionImportIntervalMs}ms`);
		console.log(`  - HETZNER_AUCTION_API_URL: ${this.hetznerAuctionApiUrl}`);
		console.log(`  - MAIN_APP_URL: ${this.env.MAIN_APP_URL ? `Present (${this.env.MAIN_APP_URL})` : 'MISSING'}`);
		console.log(`  - API_KEY: ${this.env.API_KEY ? 'Present' : 'MISSING'}`);
	}
}