/**
 * Test fixtures for auction data
 */

import type { HetznerAuctionServer, HetznerAuctionResponse } from '../../hetzner-auction-client';
import type { RawServerData } from '../../auction-data-transformer';

export const mockHetznerAuctionServer: HetznerAuctionServer = {
	id: 12345,
	information: ['Special feature', 'Additional info'],
	cpu: 'Intel Xeon E5-2680v4',
	cpu_count: 2,
	is_highio: false,
	traffic: 'unlimited',
	bandwidth: 1000,
	ram: ['32768 MB DDR4', '2x 16384 MB'],
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
};

export const mockHetznerAuctionServerMinimal: HetznerAuctionServer = {
	id: 67890,
	information: null,
	cpu: 'AMD Ryzen 7 3700X',
	cpu_count: 1,
	is_highio: true,
	traffic: '100 TB',
	bandwidth: 1000,
	ram: ['16384 MB DDR4'],
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
};

export const mockHetznerAuctionResponse: HetznerAuctionResponse = {
	server: [mockHetznerAuctionServer, mockHetznerAuctionServerMinimal],
};

export const mockRawServerData: RawServerData = {
	id: 12345,
	information: '["Special feature","Additional info"]',
	datacenter: 'FSN1-DC14',
	location: 'Germany',
	cpu_vendor: 'Intel',
	cpu: 'Intel Xeon E5-2680v4',
	cpu_count: 2,
	is_highio: false,
	ram: '["32768 MB DDR4","2x 16384 MB"]',
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
