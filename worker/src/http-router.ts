/**
 * HTTP Router
 *
 * Handles HTTP endpoints for the worker
 */

import type { CloudStatusData, LocationInfo, ServerTypeInfo } from './cloud-status-service';
import { type AuctionImportResult, isAuctionImportFailure } from './auction-service';

/** Storage entries whose key matches, for the verbose debug endpoints. */
async function listStorageWhere(storage: DurableObjectStorage, matches: (key: string) => boolean): Promise<Record<string, unknown>> {
	const entries = await storage.list();
	const out: Record<string, unknown> = {};
	for (const [key, value] of entries) {
		if (matches(key)) out[key] = value;
	}
	return out;
}

/** Renders whatever `fetchAndImportAuctions` threw into a message for the response. */
function describeImportFailure(thrown: unknown): string {
	const inner = isAuctionImportFailure(thrown) ? thrown.error : thrown;
	if (inner instanceof Error) return inner.message;
	if (typeof inner === 'object' && inner !== null && 'message' in inner) {
		return String((inner as { message: unknown }).message);
	}
	return String(inner);
}

export class HttpRouter {
	private doId: string;
	private storage: DurableObjectStorage;
	private getCloudStatus: () => Promise<CloudStatusData>;
	private triggerAuctionImport: () => Promise<AuctionImportResult>;
	private fetchIntervalMs: number;
	private auctionImportIntervalMs: number;
	private auctionApiUrl: string;

	private jsonResponse(body: unknown): Response {
		return new Response(JSON.stringify(body, null, 2), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	constructor(
		doId: string,
		storage: DurableObjectStorage,
		getCloudStatus: () => Promise<CloudStatusData>,
		triggerAuctionImport: () => Promise<AuctionImportResult>,
		fetchIntervalMs: number,
		auctionImportIntervalMs: number,
		auctionApiUrl: string,
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
			// Legacy routes (maintained for compatibility)
			case '/status':
				return this.handleStatus(request);
			case '/import-auctions':
				return this.handleImportAuctions(request);
			case '/debug':
				return this.handleDebug(request, url.searchParams);

			// Cloud availability routes
			case '/cloud/status':
				return this.handleStatus(request);
			case '/cloud/debug':
				return this.handleCloudDebug(request, url.searchParams);

			// Auction import routes
			case '/auction/import':
				return this.handleImportAuctions(request);
			case '/auction/debug':
				return this.handleAuctionDebug(request, url.searchParams);

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

			return new Response(
				JSON.stringify({
					success: true,
					message: 'Auction import completed successfully',
					...result,
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				},
			);
		} catch (error: unknown) {
			console.error(`[HttpRouter ${this.doId}] Manual auction import failed:`, error);
			return new Response(
				JSON.stringify({
					success: false,
					error: describeImportFailure(error),
					duration: isAuctionImportFailure(error) ? error.duration : undefined,
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
	}

	private async handleDebug(request: Request, params: URLSearchParams): Promise<Response> {
		if (request.method !== 'GET') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
			const lastCloudUpdate = await this.storage.get<string>('lastUpdated');
			const lastAuctionImport = await this.storage.get<string>('lastAuctionImport');
			const currentAlarm = await this.storage.getAlarm();
			const verbose = params.get('verbose') === 'true';

			const debugInfo = {
				doId: this.doId,
				lastCloudUpdate: lastCloudUpdate || 'never',
				lastAuctionImport: lastAuctionImport || 'never',
				nextAlarm: currentAlarm ? new Date(currentAlarm).toISOString() : 'none',
				intervals: {
					cloudStatus: `${this.fetchIntervalMs}ms (${Math.round(this.fetchIntervalMs / 60000)}min)`,
					auctionImport: `${this.auctionImportIntervalMs}ms (${Math.round(this.auctionImportIntervalMs / 60000)}min)`,
				},
				auctionApiUrl: this.auctionApiUrl,
				timestamp: new Date().toISOString(),
				uptime: currentAlarm ? `Next scheduled: ${new Date(currentAlarm).toLocaleString()}` : 'No alarm set',
			};

			if (verbose) {
				return this.jsonResponse({ ...debugInfo, storage: Object.fromEntries(await this.storage.list()) });
			}

			return new Response(JSON.stringify(debugInfo, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error(`[HttpRouter ${this.doId}] Debug endpoint error:`, error);
			return new Response(
				JSON.stringify(
					{
						error: 'Error fetching debug info',
						doId: this.doId,
						timestamp: new Date().toISOString(),
					},
					null,
					2,
				),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
	}

	private async handleCloudDebug(request: Request, params: URLSearchParams): Promise<Response> {
		if (request.method !== 'GET') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
			const lastCloudUpdate = await this.storage.get<string>('lastUpdated');
			const currentAlarm = await this.storage.getAlarm();
			const verbose = params.get('verbose') === 'true';
			const serverTypes = (await this.storage.get<ServerTypeInfo[]>('serverTypes')) || [];
			const locations = (await this.storage.get<LocationInfo[]>('locations')) || [];

			const debugInfo = {
				type: 'cloud-availability',
				doId: this.doId,
				lastUpdate: lastCloudUpdate || 'never',
				nextAlarm: currentAlarm ? new Date(currentAlarm).toISOString() : 'none',
				interval: `${this.fetchIntervalMs}ms (${Math.round(this.fetchIntervalMs / 60000)}min)`,
				timestamp: new Date().toISOString(),
				nextScheduled: currentAlarm ? new Date(currentAlarm).toLocaleString() : 'No alarm set',
				snapshot: {
					serverTypeCount: serverTypes.length,
					locationCount: locations.length,
					categories: Array.from(new Set(serverTypes.map((st) => st.category))).sort(),
					sampleServerTypes: serverTypes.slice(0, 10).map((st) => ({
						id: st.id,
						name: st.name,
						category: st.category,
						architecture: st.architecture,
						cpuType: st.cpu_type,
					})),
				},
			};

			if (verbose) {
				const storage = await listStorageWhere(this.storage, (k) => k.includes('cloud') || k === 'lastUpdated');
				return this.jsonResponse({ ...debugInfo, storage });
			}

			return new Response(JSON.stringify(debugInfo, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error(`[HttpRouter ${this.doId}] Cloud debug endpoint error:`, error);
			return new Response(
				JSON.stringify(
					{
						error: 'Error fetching cloud debug info',
						type: 'cloud-availability',
						doId: this.doId,
						timestamp: new Date().toISOString(),
					},
					null,
					2,
				),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
	}

	private async handleAuctionDebug(request: Request, params: URLSearchParams): Promise<Response> {
		if (request.method !== 'GET') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
			const lastAuctionImport = await this.storage.get<string>('lastAuctionImport');
			const currentAlarm = await this.storage.getAlarm();
			const verbose = params.get('verbose') === 'true';

			const debugInfo = {
				type: 'auction-import',
				doId: this.doId,
				lastImport: lastAuctionImport || 'never',
				nextAlarm: currentAlarm ? new Date(currentAlarm).toISOString() : 'none',
				interval: `${this.auctionImportIntervalMs}ms (${Math.round(this.auctionImportIntervalMs / 60000)}min)`,
				auctionApiUrl: this.auctionApiUrl,
				timestamp: new Date().toISOString(),
				nextScheduled: currentAlarm ? new Date(currentAlarm).toLocaleString() : 'No alarm set',
			};

			if (verbose) {
				const storage = await listStorageWhere(this.storage, (k) => k.includes('auction') || k === 'lastAuctionImport');
				return this.jsonResponse({ ...debugInfo, storage });
			}

			return new Response(JSON.stringify(debugInfo, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error(`[HttpRouter ${this.doId}] Auction debug endpoint error:`, error);
			return new Response(
				JSON.stringify(
					{
						error: 'Error fetching auction debug info',
						type: 'auction-import',
						doId: this.doId,
						timestamp: new Date().toISOString(),
					},
					null,
					2,
				),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
	}

	private handleNotFound(): Response {
		return new Response(
			`Available endpoints:

Legacy Routes (for compatibility):
- GET /status (cloud availability)
- POST /import-auctions (trigger manual import)  
- GET /debug (combined debug info)

Cloud Availability:
- GET /cloud/status (current cloud server availability)
- GET /cloud/debug (cloud availability debug info)

Auction Import:
- POST /auction/import (trigger manual auction import)
- GET /auction/debug (auction import debug info)

Query Parameters:
- ?verbose=true (include storage details in debug endpoints)

Examples for local development:
- curl http://localhost:8787/cloud/status
- curl http://localhost:8787/cloud/debug?verbose=true
- curl -X POST http://localhost:8787/auction/import
- curl http://localhost:8787/auction/debug`,
			{ status: 404 },
		);
	}
}
