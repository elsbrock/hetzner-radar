/**
 * HTTP Router
 * 
 * Handles HTTP endpoints for the worker
 */

import type { CloudStatusData } from './cloud-status-service';

export class HttpRouter {
	private doId: string;
	private storage: DurableObjectStorage;
	private getCloudStatus: () => Promise<CloudStatusData>;
	private triggerAuctionImport: () => Promise<any>;
	private fetchIntervalMs: number;
	private auctionImportIntervalMs: number;
	private auctionApiUrl: string;

	constructor(
		doId: string,
		storage: DurableObjectStorage,
		getCloudStatus: () => Promise<CloudStatusData>,
		triggerAuctionImport: () => Promise<any>,
		fetchIntervalMs: number,
		auctionImportIntervalMs: number,
		auctionApiUrl: string
	) {
		this.doId = doId;
		this.storage = storage;
		this.getCloudStatus = getCloudStatus;
		this.triggerAuctionImport = triggerAuctionImport;
		this.fetchIntervalMs = fetchIntervalMs;
		this.auctionImportIntervalMs = auctionImportIntervalMs;
		this.auctionApiUrl = auctionApiUrl;
	}

	async handleRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		
		switch (url.pathname) {
			case '/status':
				return this.handleStatus(request);
			case '/import-auctions':
				return this.handleImportAuctions(request);
			case '/debug':
				return this.handleDebug(request);
			default:
				return this.handleNotFound();
		}
	}

	private async handleStatus(request: Request): Promise<Response> {
		if (request.method !== 'GET') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
			const status = await this.getCloudStatus();
			return new Response(JSON.stringify(status), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error(`[HttpRouter ${this.doId}] Error serving /status:`, error);
			return new Response('Error fetching status', { status: 500 });
		}
	}

	private async handleImportAuctions(request: Request): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
			console.log(`[HttpRouter ${this.doId}] Manual auction import triggered`);
			const result = await this.triggerAuctionImport();
			
			return new Response(JSON.stringify({ 
				success: true, 
				message: 'Auction import completed successfully',
				...result
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error: any) {
			console.error(`[HttpRouter ${this.doId}] Manual auction import failed:`, error);
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

	private async handleDebug(request: Request): Promise<Response> {
		if (request.method !== 'GET') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
			const lastCloudUpdate = await this.storage.get<string>('lastUpdated');
			const lastAuctionImport = await this.storage.get<string>('lastAuctionImport');
			const currentAlarm = await this.storage.getAlarm();
			
			return new Response(JSON.stringify({
				lastCloudUpdate: lastCloudUpdate || 'never',
				lastAuctionImport: lastAuctionImport || 'never',
				nextAlarm: currentAlarm ? new Date(currentAlarm).toISOString() : 'none',
				intervals: {
					cloudStatus: `${this.fetchIntervalMs}ms`,
					auctionImport: `${this.auctionImportIntervalMs}ms`
				},
				auctionApiUrl: this.auctionApiUrl
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error) {
			return new Response('Error fetching debug info', { status: 500 });
		}
	}

	private handleNotFound(): Response {
		return new Response(
			'Available endpoints:\n- GET /status (cloud availability)\n- POST /import-auctions (trigger manual import)\n- GET /debug (debug info)', 
			{ status: 404 }
		);
	}
}