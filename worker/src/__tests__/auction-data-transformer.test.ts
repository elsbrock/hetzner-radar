/**
 * Tests for AuctionDataTransformer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuctionDataTransformer } from '../auction-data-transformer';
import { mockHetznerAuctionServer, mockHetznerAuctionServerMinimal, mockRawServerData } from './fixtures/auction-data';

describe('AuctionDataTransformer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('transformServers', () => {
		it('should transform array of servers correctly', () => {
			const servers = [mockHetznerAuctionServer, mockHetznerAuctionServerMinimal];
			const result = AuctionDataTransformer.transformServers(servers);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe(mockHetznerAuctionServer.id);
			expect(result[1].id).toBe(mockHetznerAuctionServerMinimal.id);
		});

		it('should handle empty server array', () => {
			const result = AuctionDataTransformer.transformServers([]);
			expect(result).toEqual([]);
		});

		it('should continue processing other servers when one fails', () => {
			// Create an invalid server that will cause an error during transformation
			const invalidServer = { ...mockHetznerAuctionServer };
			delete (invalidServer as any).serverDiskData; // Remove required field
			const servers = [invalidServer, mockHetznerAuctionServerMinimal];

			const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
			const result = AuctionDataTransformer.transformServers(servers);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(mockHetznerAuctionServerMinimal.id);
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to transform server'), expect.any(Error));
		});
	});

	describe('transformServer', () => {
		it('should transform server with full data correctly', () => {
			const result = AuctionDataTransformer.transformServers([mockHetznerAuctionServer]);
			const transformed = result[0];

			expect(transformed.id).toBe(12345);
			expect(transformed.information).toBe('["Special feature","Additional info"]');
			expect(transformed.datacenter).toBe('FSN1-DC14');
			expect(transformed.location).toBe('Germany');
			expect(transformed.cpu_vendor).toBe('Intel');
			expect(transformed.cpu).toBe('Intel Xeon E5-2680v4');
			expect(transformed.cpu_count).toBe(2);
			expect(transformed.is_highio).toBe(false);
			expect(transformed.ram).toBe('["32768 MB DDR4","2x 16384 MB"]');
			expect(transformed.ram_size).toBe(32768);
			expect(transformed.is_ecc).toBe(true);
			expect(transformed.nvme_count).toBe(0);
			expect(transformed.sata_count).toBe(6);
			expect(transformed.sata_size).toBe(32480);
			expect(transformed.with_inic).toBe(true);
			expect(transformed.with_hwr).toBe(true);
			expect(transformed.with_gpu).toBe(false);
			expect(transformed.with_rps).toBe(false);
			expect(transformed.price).toBe(89.0);
			expect(transformed.fixed_price).toBe(false);
		});

		it('should transform server with minimal data correctly', () => {
			const result = AuctionDataTransformer.transformServers([mockHetznerAuctionServerMinimal]);
			const transformed = result[0];

			expect(transformed.id).toBe(67890);
			expect(transformed.information).toBe(null);
			expect(transformed.datacenter).toBe('NBG1-DC3');
			expect(transformed.location).toBe('Germany');
			expect(transformed.cpu_vendor).toBe('AMD');
			expect(transformed.nvme_count).toBe(1);
			expect(transformed.nvme_size).toBe(1000);
			expect(transformed.sata_count).toBe(0);
			expect(transformed.with_inic).toBe(false);
			expect(transformed.with_hwr).toBe(false);
			expect(transformed.fixed_price).toBe(true);
		});

		it('should handle null information correctly', () => {
			const server = { ...mockHetznerAuctionServer, information: null };
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].information).toBe(null);
		});

		it('should handle empty specials array', () => {
			const server = { ...mockHetznerAuctionServer, specials: [] };
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].with_inic).toBe(false);
			expect(result[0].with_hwr).toBe(false);
			expect(result[0].with_gpu).toBe(false);
			expect(result[0].with_rps).toBe(false);
		});
	});

	describe('location detection', () => {
		it('should detect Germany for NBG datacenters', () => {
			const server = { ...mockHetznerAuctionServer, datacenter: 'NBG1-DC3' };
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].location).toBe('Germany');
		});

		it('should detect Germany for FSN datacenters', () => {
			const server = { ...mockHetznerAuctionServer, datacenter: 'FSN1-DC14' };
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].location).toBe('Germany');
		});

		it('should detect Finland for HEL datacenters', () => {
			const server = { ...mockHetznerAuctionServer, datacenter: 'HEL1-DC2' };
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].location).toBe('Finland');
		});

		it('should default to Finland for unknown datacenters', () => {
			const server = { ...mockHetznerAuctionServer, datacenter: 'UNKNOWN-DC1' };
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].location).toBe('Finland');
		});
	});

	describe('CPU vendor extraction', () => {
		it('should extract Intel from Intel CPU string', () => {
			const server = { ...mockHetznerAuctionServer, cpu: 'Intel Xeon E5-2680v4' };
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].cpu_vendor).toBe('Intel');
		});

		it('should extract AMD from AMD CPU string', () => {
			const server = { ...mockHetznerAuctionServer, cpu: 'AMD Ryzen 7 3700X' };
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].cpu_vendor).toBe('AMD');
		});

		it('should handle single word CPU strings', () => {
			const server = { ...mockHetznerAuctionServer, cpu: 'CustomCPU' };
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].cpu_vendor).toBe('CustomCPU');
		});
	});

	describe('drive data processing', () => {
		it('should process NVMe drives correctly', () => {
			const server = {
				...mockHetznerAuctionServer,
				serverDiskData: {
					nvme: [500, 1000],
					sata: [],
					hdd: [],
					general: [],
				},
			};
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].nvme_count).toBe(2);
			expect(result[0].nvme_size).toBe(1500);
			expect(result[0].nvme_drives).toBe('[500,1000]');
		});

		it('should process SATA drives correctly', () => {
			const server = {
				...mockHetznerAuctionServer,
				serverDiskData: {
					nvme: [],
					sata: [240, 240, 8000, 8000],
					hdd: [],
					general: [],
				},
			};
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].sata_count).toBe(4);
			expect(result[0].sata_size).toBe(16480);
			expect(result[0].sata_drives).toBe('[240,240,8000,8000]');
		});

		it('should process HDD drives correctly', () => {
			const server = {
				...mockHetznerAuctionServer,
				serverDiskData: {
					nvme: [],
					sata: [],
					hdd: [2000, 2000, 2000, 2000],
					general: [],
				},
			};
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].hdd_count).toBe(4);
			expect(result[0].hdd_size).toBe(8000);
			expect(result[0].hdd_drives).toBe('[2000,2000,2000,2000]');
		});

		it('should handle empty drive arrays', () => {
			const server = {
				...mockHetznerAuctionServer,
				serverDiskData: {
					nvme: [],
					sata: [],
					hdd: [],
					general: [],
				},
			};
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].nvme_count).toBe(0);
			expect(result[0].nvme_size).toBe(0);
			expect(result[0].sata_count).toBe(0);
			expect(result[0].sata_size).toBe(0);
			expect(result[0].hdd_count).toBe(0);
			expect(result[0].hdd_size).toBe(0);
		});
	});

	describe('seen timestamp calculation', () => {
		it('should calculate seen timestamp correctly', () => {
			const server = {
				...mockHetznerAuctionServer,
				next_reduce_timestamp: 1640995200, // 2022-01-01 00:00:00
				next_reduce: 3600, // 1 hour
			};
			const result = AuctionDataTransformer.transformServers([server]);

			// Should be 1640995200 - 3600 = 1640991600 (2021-12-31 23:00:00)
			expect(result[0].seen).toBe('2021-12-31T23:00:00.000Z');
		});

		it('should handle zero next_reduce', () => {
			const server = {
				...mockHetznerAuctionServer,
				next_reduce_timestamp: 1640995200,
				next_reduce: 0,
			};
			const result = AuctionDataTransformer.transformServers([server]);

			expect(result[0].seen).toBe('2022-01-01T00:00:00.000Z');
		});
	});

	describe('validateTransformedData', () => {
		it('should validate correct data', () => {
			const validData = [mockRawServerData];
			const result = AuctionDataTransformer.validateTransformedData(validData);

			expect(result.valid).toHaveLength(1);
			expect(result.invalid).toBe(0);
		});

		it('should reject invalid data', () => {
			const invalidData = [
				{ ...mockRawServerData, id: 0 }, // invalid id
				{ ...mockRawServerData, cpu: '' }, // empty cpu
				{ ...mockRawServerData, price: -1 }, // negative price
			];

			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();
			const result = AuctionDataTransformer.validateTransformedData(invalidData);

			expect(result.valid).toHaveLength(0);
			expect(result.invalid).toBe(3);
			expect(consoleSpy).toHaveBeenCalledTimes(3);
		});

		it('should handle mixed valid and invalid data', () => {
			const mixedData = [
				mockRawServerData, // valid
				{ ...mockRawServerData, id: -1 }, // invalid
				{ ...mockRawServerData, id: 999 }, // valid
			];

			const result = AuctionDataTransformer.validateTransformedData(mixedData);

			expect(result.valid).toHaveLength(2);
			expect(result.invalid).toBe(1);
		});
	});
});
