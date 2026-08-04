/**
 * Test fixtures for auction data
 */

import type { HetznerAuctionServer, HetznerAuctionFeedServer, HetznerAuctionResponse } from '../../hetzner-auction-client';
import type { RawServerData } from '../../auction-data-transformer';

/** Raw feed records, in the nested shape Hetzner actually serves. */
export const mockHetznerAuctionFeedServer: HetznerAuctionFeedServer = {
	Id: 12345,
	Hardware: {
		CPU: { Name: 'Intel Xeon E5-2680v4', CoreCount: 2 },
		RAM: { RealSize: 16384, Size: 32768, SizeUnit: 'GB', Amount: 2, ecc: true },
		Storage: {
			RealSize: 32480,
			Size: 32480,
			SizeUnit: 'GB',
			Amount: 6,
			Disks: ['2x 240 GB SSD SATA', '4x 8000 GB HDD SATA'],
			Details: { nvme: [], sata: [240, 240, 8000, 8000, 8000, 8000], hdd: [], general: [] },
		},
	},
	Prices: {
		monthly: { EUR: 89.0, USD: 99.0 },
		hourly: { EUR: 0.1426, USD: 0.1586 },
		setup: { EUR: 0, USD: 0 },
		fixed: false,
	},
	IPPrices: {
		monthly: { EUR: 1.7, USD: 1.9 },
		hourly: { EUR: 0.0027, USD: 0.003 },
		Amount: 1,
	},
	Details: {
		Description: ['IPv4', 'iNIC', 'HWR'],
		Information: ['2 x RAM 16384 MB DDR4 ECC', 'Special feature', 'Additional info'],
		Specials: ['iNIC', 'HWR'],
		Traffic: 'unlimited',
		Bandwidth: 1000,
		OS: ['Rescue system'],
		Datacenter: { Name: 'FSN1-DC14', Datacenter: '#FSN1-DC14' },
	},
	Timer: { ReduceNext: 3600, ReduceNextHr: true, ReduceNextTimestamp: 1640995200 },
};

export const mockHetznerAuctionFeedServerMinimal: HetznerAuctionFeedServer = {
	Id: 67890,
	Hardware: {
		CPU: { Name: 'AMD Ryzen 7 3700X', CoreCount: 1 },
		RAM: { RealSize: 16384, Size: 16384, SizeUnit: 'GB', Amount: 1, ecc: false },
		Storage: {
			RealSize: 1000,
			Size: 1000,
			SizeUnit: 'GB',
			Amount: 1,
			Disks: ['1x 1000 GB NVMe SSD'],
			Details: { nvme: [1000], sata: [], hdd: [], general: [] },
		},
	},
	Prices: {
		monthly: { EUR: 45.5, USD: 50.5 },
		hourly: { EUR: 0.0729, USD: 0.0809 },
		setup: { EUR: 0, USD: 0 },
		fixed: true,
	},
	IPPrices: {
		monthly: { EUR: 1.7, USD: 1.9 },
		hourly: { EUR: 0.0027, USD: 0.003 },
		Amount: 1,
	},
	Details: {
		Description: ['IPv4'],
		Information: ['1 x RAM 16384 MB DDR4'],
		Specials: [],
		Traffic: '100 TB',
		Bandwidth: 1000,
		OS: ['Rescue system'],
		Datacenter: { Name: 'NBG1-DC3', Datacenter: '#NBG1-DC3' },
	},
	Timer: { ReduceNext: 0, ReduceNextHr: false, ReduceNextTimestamp: 1640995200 },
};

/** The flattened records the client returns for the feed records above. */
export const mockHetznerAuctionServer: HetznerAuctionServer = {
	id: 12345,
	information: ['2 x RAM 16384 MB DDR4 ECC', 'Special feature', 'Additional info'],
	cpu: 'Intel Xeon E5-2680v4',
	cpu_count: 2,
	is_highio: false,
	traffic: 'unlimited',
	bandwidth: 1000,
	ram: ['2 x RAM 16384 MB DDR4 ECC'],
	ram_size: 32768,
	price: 89.0,
	hdd_arr: ['2x 240 GB SSD SATA', '4x 8000 GB HDD SATA'],
	serverDiskData: {
		nvme: [],
		sata: [240, 240, 8000, 8000, 8000, 8000],
		hdd: [],
		general: [],
	},
	is_ecc: true,
	datacenter: 'FSN1-DC14',
	specials: ['iNIC', 'HWR'],
	fixed_price: false,
	next_reduce_timestamp: 1640995200,
	next_reduce: 3600,
	ip_price: { Monthly: 1.7, Hourly: 0.0027, Amount: 1 },
	setup_price: 0,
	hourly_price: 0.1426,
};

export const mockHetznerAuctionServerMinimal: HetznerAuctionServer = {
	id: 67890,
	information: ['1 x RAM 16384 MB DDR4'],
	cpu: 'AMD Ryzen 7 3700X',
	cpu_count: 1,
	is_highio: false,
	traffic: '100 TB',
	bandwidth: 1000,
	ram: ['1 x RAM 16384 MB DDR4'],
	ram_size: 16384,
	price: 45.5,
	hdd_arr: ['1x 1000 GB NVMe SSD'],
	serverDiskData: {
		nvme: [1000],
		sata: [],
		hdd: [],
		general: [],
	},
	is_ecc: false,
	datacenter: 'NBG1-DC3',
	specials: [],
	fixed_price: true,
	next_reduce_timestamp: 1640995200,
	next_reduce: 0,
	ip_price: { Monthly: 1.7, Hourly: 0.0027, Amount: 1 },
	setup_price: 0,
	hourly_price: 0.0729,
};

export const mockHetznerAuctionResponse: HetznerAuctionResponse = {
	server: [mockHetznerAuctionFeedServer, mockHetznerAuctionFeedServerMinimal],
};

export const mockRawServerData: RawServerData = {
	id: 12345,
	information: '["2 x RAM 16384 MB DDR4 ECC","Special feature","Additional info"]',
	datacenter: 'FSN1-DC14',
	location: 'Germany',
	cpu_vendor: 'Intel',
	cpu: 'Intel Xeon E5-2680v4',
	cpu_count: 2,
	is_highio: false,
	ram: '["2 x RAM 16384 MB DDR4 ECC"]',
	ram_size: 32768,
	is_ecc: true,
	hdd_arr: '["2x 240 GB SSD SATA","4x 8000 GB HDD SATA"]',
	nvme_count: 0,
	nvme_drives: '[]',
	nvme_size: 0,
	sata_count: 6,
	sata_drives: '[240,240,8000,8000,8000,8000]',
	sata_size: 32480,
	hdd_count: 0,
	hdd_drives: '[]',
	hdd_size: 0,
	with_inic: true,
	with_hwr: true,
	with_gpu: false,
	with_rps: false,
	traffic: 'unlimited',
	bandwidth: 1000,
	price: 89.0,
	fixed_price: false,
	seen: '2021-12-31T23:00:00.000Z',
};

export const mockInvalidHetznerServer = {
	id: 'invalid',
	cpu: '',
	price: -1,
	datacenter: null,
};

export const mockApiResponse = JSON.stringify(mockHetznerAuctionResponse);

export const mockEmptyApiResponse = JSON.stringify({ server: [] });

export const mockInvalidApiResponse = JSON.stringify({ invalid: 'response' });
