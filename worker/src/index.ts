/**
 * Cloud Availability Worker
 *
 * This worker manages two separate Durable Objects:
 * 1. CloudAvailabilityDO: Fetches Hetzner Cloud server availability data every 60 seconds
 * 2. AuctionImportDO: Imports Hetzner dedicated server auction data every 5 minutes
 *
 * Required secrets (set via wrangler secret put):
 * - HETZNER_API_TOKEN: Token for accessing Hetzner Cloud API
 * - FORWARDEMAIL_API_KEY: API key for email notifications
 *
 * Environment variables (set in wrangler.jsonc):
 * - MAIN_APP_URL: URL of the main application (e.g., https://radar.iodev.org)
 * - FETCH_INTERVAL_MS: How often to check Hetzner Cloud API (default: 60000ms)
 * - AUCTION_IMPORT_INTERVAL_MS: How often to import auction data (default: 300000ms)
 * - HETZNER_AUCTION_API_URL: URL for Hetzner auction API (default: Hetzner's live data endpoint)
 *
 * Database bindings:
 * - DB: D1 database for storing auction data (auctions and current_auctions tables)
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { CloudAvailabilityDO } from './cloud-availability-do';
import { AuctionImportDO } from './auction-import-do';

interface Env {
	CLOUD_STATUS_DO: DurableObjectNamespace<CloudAvailabilityDO>;
	AUCTION_IMPORT_DO: DurableObjectNamespace<AuctionImportDO>;
	HETZNER_API_TOKEN: string;
	FETCH_INTERVAL_MS?: string;
	ANALYTICS_ENGINE: AnalyticsEngineDataset;
	MAIN_APP_URL?: string;
	FORWARDEMAIL_API_KEY?: string;
	DB: D1Database;
	AUCTION_IMPORT_INTERVAL_MS?: string;
	HETZNER_AUCTION_API_URL?: string;
}

export { CloudAvailabilityDO, AuctionImportDO };

export default class CloudAvailabilityWorker extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		try {
			// Route requests based on path
			if (url.pathname.startsWith('/cloud/') || url.pathname === '/status' || url.pathname === '/') {
				// Cloud availability requests
				const cloudPath = url.pathname.replace('/cloud', '') || '/status';
				const cloudUrl = new URL(request.url);
				cloudUrl.pathname = cloudPath;

				const durableObjectId = this.env.CLOUD_STATUS_DO.idFromName('singleton-cloud-availability-v1');
				const stub = this.env.CLOUD_STATUS_DO.get(durableObjectId);
				const cloudRequest = new Request(cloudUrl.toString(), request);
				return await stub.fetch(cloudRequest);
			} else if (url.pathname.startsWith('/auction/')) {
				// Auction import requests
				const auctionPath = url.pathname.replace('/auction', '') || '/debug';
				const auctionUrl = new URL(request.url);
				auctionUrl.pathname = auctionPath;

				const durableObjectId = this.env.AUCTION_IMPORT_DO.idFromName('singleton-auction-import-v1');
				const stub = this.env.AUCTION_IMPORT_DO.get(durableObjectId);
				const auctionRequest = new Request(auctionUrl.toString(), request);
				return await stub.fetch(auctionRequest);
			} else if (url.pathname === '/debug' && request.method === 'GET') {
				// Combined debug endpoint
				return this.handleCombinedDebug();
			} else {
				// Default help response
				return new Response(
					`Available endpoints:
Cloud Availability:
  - GET /status or /cloud/status (cloud server availability)
  - POST /cloud/trigger (manual cloud status update)
  - GET /cloud/debug (cloud availability debug info)

Auction Import:
  - POST /auction/import (manual auction import)
  - GET /auction/debug (auction import debug info)
  - GET /auction/stats (auction database stats)

Combined:
  - GET /debug (combined debug info for both DOs)
`,
					{
						status: 404,
						headers: { 'Content-Type': 'text/plain' },
					},
				);
			}
		} catch (e: any) {
			console.error('Error in Worker fetch:', e);
			return new Response(`Error processing request: ${e.message}`, { status: 500 });
		}
	}

	async getStatus() {
		try {
			const durableObjectId = this.env.CLOUD_STATUS_DO.idFromName('singleton-cloud-availability-v1');
			const stub = this.env.CLOUD_STATUS_DO.get(durableObjectId);
			return await (stub as any).getStatus();
		} catch (e: any) {
			console.error('Error in Worker getStatus RPC:', e);
			throw new Error(`Error calling getStatus on DO: ${e.message}`);
		}
	}

	async getAuctionStats() {
		try {
			const durableObjectId = this.env.AUCTION_IMPORT_DO.idFromName('singleton-auction-import-v1');
			const stub = this.env.AUCTION_IMPORT_DO.get(durableObjectId);
			return await (stub as any).getAuctionStats();
		} catch (e: any) {
			console.error('Error in Worker getAuctionStats RPC:', e);
			throw new Error(`Error calling getAuctionStats on DO: ${e.message}`);
		}
	}

	private async handleCombinedDebug(): Promise<Response> {
		try {
			// Get debug info from both DOs
			const cloudDOId = this.env.CLOUD_STATUS_DO.idFromName('singleton-cloud-availability-v1');
			const cloudStub = this.env.CLOUD_STATUS_DO.get(cloudDOId);

			const auctionDOId = this.env.AUCTION_IMPORT_DO.idFromName('singleton-auction-import-v1');
			const auctionStub = this.env.AUCTION_IMPORT_DO.get(auctionDOId);

			const [cloudDebug, auctionDebug] = await Promise.allSettled([
				cloudStub.fetch(new Request('http://localhost/debug')),
				auctionStub.fetch(new Request('http://localhost/debug')),
			]);

			const cloudData =
				cloudDebug.status === 'fulfilled' && cloudDebug.value.ok
					? await cloudDebug.value.json()
					: { error: 'Failed to fetch cloud debug info' };

			const auctionData =
				auctionDebug.status === 'fulfilled' && auctionDebug.value.ok
					? await auctionDebug.value.json()
					: { error: 'Failed to fetch auction debug info' };

			return new Response(
				JSON.stringify(
					{
						cloudAvailability: cloudData,
						auctionImport: auctionData,
						worker: {
							timestamp: new Date().toISOString(),
							environment: {
								HETZNER_API_TOKEN: this.env.HETZNER_API_TOKEN ? 'Present' : 'MISSING',
								DB: this.env.DB ? 'Present' : 'MISSING',
								ANALYTICS_ENGINE: this.env.ANALYTICS_ENGINE ? 'Present' : 'MISSING',
								MAIN_APP_URL: this.env.MAIN_APP_URL || 'Not set',
								FORWARDEMAIL_API_KEY: this.env.FORWARDEMAIL_API_KEY ? 'Present' : 'MISSING',
							},
						},
					},
					null,
					2,
				),
				{
					headers: { 'Content-Type': 'application/json' },
				},
			);
		} catch (error) {
			console.error('Error in combined debug:', error);
			return new Response('Error fetching combined debug info', { status: 500 });
		}
	}
}
