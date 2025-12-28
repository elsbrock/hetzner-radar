/**
 * Test fixtures for cloud status data
 */

import type {
	CloudStatusData,
	ServerTypeInfo,
	LocationInfo,
	AvailabilityMatrix,
	SupportMatrix,
	LastSeenMatrix,
} from '../../cloud-status-service';

export const mockServerTypes: ServerTypeInfo[] = [
	{
		id: 1,
		name: 'cx11',
		description: '1 vCPU, 1 GB RAM, 25 GB Disk',
		cores: 1,
		memory: 1073741824,
		disk: 25,
		cpu_type: 'shared',
		architecture: 'x86',
		category: 'regular_purpose',
		storageType: 'local',
		isDeprecated: false,
		deprecated: false,
	},
	{
		id: 2,
		name: 'cx21',
		description: '2 vCPU, 4 GB RAM, 40 GB Disk',
		cores: 2,
		memory: 4294967296,
		disk: 40,
		cpu_type: 'shared',
		architecture: 'x86',
		category: 'regular_purpose',
		storageType: 'local',
		isDeprecated: false,
		deprecated: false,
	},
	{
		id: 3,
		name: 'cx31',
		description: '2 vCPU, 8 GB RAM, 80 GB Disk',
		cores: 2,
		memory: 8589934592,
		disk: 80,
		cpu_type: 'shared',
		architecture: 'x86',
		category: 'regular_purpose',
		storageType: 'local',
		isDeprecated: true,
		deprecated: true,
	},
];

export const mockLocations: LocationInfo[] = [
	{
		id: 1,
		name: 'nbg1',
		city: 'Nuremberg',
		country: 'Germany',
		latitude: 49.452102,
		longitude: 11.076665,
	},
	{
		id: 2,
		name: 'fsn1',
		city: 'Falkenstein',
		country: 'Germany',
		latitude: 50.47612,
		longitude: 12.370071,
	},
	{
		id: 3,
		name: 'hel1',
		city: 'Helsinki',
		country: 'Finland',
		latitude: 60.169857,
		longitude: 24.938379,
	},
];

export const mockAvailabilityMatrix: AvailabilityMatrix = {
	1: [1, 2], // nbg1 has cx11, cx21 available
	2: [1, 3], // fsn1 has cx11, cx31 available
	3: [2, 3], // hel1 has cx21, cx31 available
};

export const mockSupportMatrix: SupportMatrix = {
	1: [1, 2, 3], // nbg1 supports all types
	2: [1, 2, 3], // fsn1 supports all types
	3: [1, 2, 3], // hel1 supports all types
};

export const mockLastSeenMatrix: LastSeenMatrix = {
	'1-1': '2023-12-01T10:00:00.000Z',
	'1-2': '2023-12-01T10:00:00.000Z',
	'2-1': '2023-12-01T10:00:00.000Z',
	'2-3': '2023-12-01T10:00:00.000Z',
	'3-2': '2023-12-01T10:00:00.000Z',
	'3-3': '2023-12-01T10:00:00.000Z',
};

export const mockCloudStatusData: CloudStatusData = {
	serverTypes: mockServerTypes,
	locations: mockLocations,
	availability: mockAvailabilityMatrix,
	supported: mockSupportMatrix,
	lastUpdated: '2023-12-01T10:00:00.000Z',
	lastSeenAvailable: mockLastSeenMatrix,
};

// Raw Hetzner API response fixtures
export const mockHetznerServerTypesResponse = {
	server_types: [
		{
			id: 1,
			name: 'cx11',
			description: '1 vCPU, 1 GB RAM, 25 GB Disk',
			cores: 1,
			memory: 1073741824,
			disk: 25,
			storage_type: 'local' as const,
			cpu_type: 'shared' as const,
			category: 'regular_purpose',
			architecture: 'x86',
			deprecation: null,
		},
		{
			id: 2,
			name: 'cx21',
			description: '2 vCPU, 4 GB RAM, 40 GB Disk',
			cores: 2,
			memory: 4294967296,
			disk: 40,
			storage_type: 'local' as const,
			cpu_type: 'shared' as const,
			category: 'regular_purpose',
			architecture: 'x86',
			deprecation: null,
		},
		{
			id: 3,
			name: 'cx31',
			description: '2 vCPU, 8 GB RAM, 80 GB Disk',
			cores: 2,
			memory: 8589934592,
			disk: 80,
			storage_type: 'local' as const,
			cpu_type: 'shared' as const,
			category: 'regular_purpose',
			architecture: 'x86',
			deprecation: {
				unavailable_after: '2024-12-31T23:59:59+00:00',
				announced: '2023-12-01T00:00:00+00:00',
			},
		},
	],
	meta: {
		pagination: {
			page: 1,
			per_page: 50,
			previous_page: null,
			next_page: null,
			last_page: 1,
			total_entries: 3,
		},
	},
};

export const mockHetznerDatacentersResponse = {
	datacenters: [
		{
			id: 1,
			name: 'nbg1-dc3',
			description: 'Nuremberg 1 DC 3',
			location: {
				id: 1,
				name: 'nbg1',
				description: 'Nuremberg DC Park 1',
				country: 'Germany',
				city: 'Nuremberg',
				latitude: 49.452102,
				longitude: 11.076665,
				network_zone: 'eu-central',
			},
			server_types: {
				supported: [1, 2, 3],
				available: [1, 2],
				available_for_migration: [1, 2, 3],
			},
		},
		{
			id: 2,
			name: 'fsn1-dc14',
			description: 'Falkenstein 1 DC 14',
			location: {
				id: 2,
				name: 'fsn1',
				description: 'Falkenstein DC Park 1',
				country: 'Germany',
				city: 'Falkenstein',
				latitude: 50.47612,
				longitude: 12.370071,
				network_zone: 'eu-central',
			},
			server_types: {
				supported: [1, 2, 3],
				available: [1, 3],
				available_for_migration: [1, 2, 3],
			},
		},
		{
			id: 3,
			name: 'hel1-dc2',
			description: 'Helsinki 1 DC 2',
			location: {
				id: 3,
				name: 'hel1',
				description: 'Helsinki DC Park 1',
				country: 'Finland',
				city: 'Helsinki',
				latitude: 60.169857,
				longitude: 24.938379,
				network_zone: 'eu-central',
			},
			server_types: {
				supported: [1, 2, 3],
				available: [2, 3],
				available_for_migration: [1, 2, 3],
			},
		},
	],
	meta: {
		pagination: {
			page: 1,
			per_page: 50,
			previous_page: null,
			next_page: null,
			last_page: 1,
			total_entries: 3,
		},
	},
};

export const mockHetznerServerTypesResponsePaginatedPage1 = {
	server_types: [
		{
			id: 1,
			name: 'cx11',
			description: '1 vCPU, 1 GB RAM, 25 GB Disk',
			cores: 1,
			memory: 1073741824,
			disk: 25,
			storage_type: 'local' as const,
			cpu_type: 'shared' as const,
			category: 'regular_purpose',
			architecture: 'x86',
			deprecation: null,
		},
	],
	meta: {
		pagination: {
			page: 1,
			per_page: 50,
			previous_page: null,
			next_page: 2,
			last_page: 2,
			total_entries: 2,
		},
	},
};

export const mockHetznerServerTypesResponsePaginatedPage2 = {
	server_types: [
		{
			id: 99,
			name: 'ccx23',
			description: '4 vCPU, 16 GB RAM, 80 GB Disk',
			cores: 4,
			memory: 17179869184,
			disk: 80,
			storage_type: 'local' as const,
			cpu_type: 'dedicated' as const,
			category: 'general_purpose',
			architecture: 'x86',
			deprecation: null,
		},
	],
	meta: {
		pagination: {
			page: 2,
			per_page: 50,
			previous_page: 1,
			next_page: null,
			last_page: 2,
			total_entries: 2,
		},
	},
};
