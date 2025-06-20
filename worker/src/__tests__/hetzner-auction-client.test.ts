/**
 * Tests for HetznerAuctionClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HetznerAuctionClient } from '../hetzner-auction-client';
import {
	mockApiResponse,
	mockEmptyApiResponse,
	mockInvalidApiResponse,
	mockHetznerAuctionServer,
	mockInvalidHetznerServer,
} from './fixtures/auction-data';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HetznerAuctionClient', () => {
	const testApiUrl = 'https://api.example.com/auction-data';
	let client: HetznerAuctionClient;

	beforeEach(() => {
		client = new HetznerAuctionClient(testApiUrl);
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with correct API URL and user agent', () => {
			expect(client).toBeInstanceOf(HetznerAuctionClient);
		});
	});

	describe('fetchAuctionData', () => {
		it('should successfully fetch and return auction data', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => JSON.parse(mockApiResponse),
			});

			const result = await client.fetchAuctionData();

			expect(mockFetch).toHaveBeenCalledWith(testApiUrl, {
				headers: {
					'User-Agent': 'Hetzner-Radar-AuctionImport-Worker (https://github.com/elsbrock/hetzner-radar)',
					Accept: 'application/json',
					'Accept-Encoding': 'gzip, deflate',
				},
				cf: {
					cacheTtl: 60,
					cacheEverything: true,
				},
			});

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual(mockHetznerAuctionServer);
		});

		it('should handle empty server response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => JSON.parse(mockEmptyApiResponse),
			});

			const result = await client.fetchAuctionData();

			expect(result).toEqual([]);
		});

		it('should throw error on HTTP error response', async () => {
			// Mock all 3 retry attempts with the same error response
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			});

			await expect(client.fetchAuctionData()).rejects.toThrow(
				/Failed to fetch auction data after 3 attempts.*HTTP error! status: 500 Internal Server Error/,
			);

			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should throw error on invalid response format', async () => {
			// Mock all 3 retry attempts with the same invalid response
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => JSON.parse(mockInvalidApiResponse),
			});

			await expect(client.fetchAuctionData()).rejects.toThrow(
				/Failed to fetch auction data after 3 attempts.*Invalid response format: missing or invalid server array/,
			);
		});

		it('should retry on network errors with exponential backoff', async () => {
			// Mock setTimeout to avoid actual delays in tests
			vi.spyOn(global, 'setTimeout').mockImplementation((callback: unknown) => {
				callback();
				return 1 as any;
			});

			mockFetch
				.mockRejectedValueOnce(new Error('Network error'))
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValueOnce({
					ok: true,
					json: async () => JSON.parse(mockApiResponse),
				});

			const result = await client.fetchAuctionData();

			expect(mockFetch).toHaveBeenCalledTimes(3);
			expect(result).toHaveLength(2);
		});

		it('should fail after max retries', async () => {
			vi.spyOn(global, 'setTimeout').mockImplementation((callback: unknown) => {
				callback();
				return 1 as any;
			});

			mockFetch.mockRejectedValue(new Error('Persistent network error'));

			await expect(client.fetchAuctionData()).rejects.toThrow(/Failed to fetch auction data after 3 attempts.*Persistent network error/);

			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should handle JSON parsing errors', async () => {
			// Mock all 3 retry attempts with the same JSON parsing error
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => {
					throw new Error('Invalid JSON');
				},
			});

			await expect(client.fetchAuctionData()).rejects.toThrow(/Failed to fetch auction data after 3 attempts.*Invalid JSON/);
		});
	});

	describe('validateServer', () => {
		it('should validate a correct server object', () => {
			const isValid = HetznerAuctionClient.validateServer(mockHetznerAuctionServer);
			expect(isValid).toBe(true);
		});

		it('should reject invalid server objects', () => {
			const isValid = HetznerAuctionClient.validateServer(mockInvalidHetznerServer);
			expect(isValid).toBe(false);
		});

		it('should reject server with missing required fields', () => {
			const invalidServer = {
				id: 123,
				cpu: 'Intel',
				// missing cpu_count, price, datacenter, etc.
			};

			const isValid = HetznerAuctionClient.validateServer(invalidServer);
			expect(isValid).toBe(false);
		});

		it('should reject server with wrong types', () => {
			const invalidServer = {
				id: '123', // should be number
				cpu: 'Intel',
				cpu_count: 2,
				price: '89.0', // should be number
				datacenter: 'FSN1',
				hdd_arr: 'not an array',
				serverDiskData: null,
			};

			const isValid = HetznerAuctionClient.validateServer(invalidServer);
			expect(isValid).toBe(false);
		});
	});
});
