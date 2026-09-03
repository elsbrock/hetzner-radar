/**
 * Tests for CloudStatusService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	CloudStatusService,
	type AvailabilityMatrix,
	type LastSeenMatrix,
	type LocationInfo,
	type SupportMatrix,
} from '../cloud-status-service';
import { createMockDurableObjectStorage, type MockDurableObjectStorage } from './fixtures/database-mocks';
import {
	mockServerTypes,
	mockLocations,
	mockAvailabilityMatrix,
	mockSupportMatrix,
	mockLastSeenMatrix,
	mockHetznerServerTypesResponse,
	mockHetznerLocationsResponse,
	mockHetznerServerTypesResponsePaginatedPage1,
	mockHetznerServerTypesResponsePaginatedPage2,
} from './fixtures/cloud-data';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CloudStatusService', () => {
	let service: CloudStatusService;
	let mockStorage: MockDurableObjectStorage;
	const testApiToken = 'test-api-token';
	const testDoId = 'test-do-id';

	beforeEach(() => {
		mockStorage = createMockDurableObjectStorage();
		service = new CloudStatusService(testApiToken, mockStorage as DurableObjectStorage, testDoId);
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with correct parameters', () => {
			expect(service).toBeInstanceOf(CloudStatusService);
		});
	});

	describe('getStatus', () => {
		it('should return stored status data', async () => {
			await mockStorage.put({
				serverTypes: mockServerTypes,
				locations: mockLocations,
				availability: mockAvailabilityMatrix,
				supported: mockSupportMatrix,
				lastUpdated: '2023-12-01T10:00:00.000Z',
				lastSeenAvailable: mockLastSeenMatrix,
			});

			const result = await service.getStatus();

			expect(result).toEqual({
				serverTypes: mockServerTypes,
				locations: mockLocations,
				availability: mockAvailabilityMatrix,
				supported: mockSupportMatrix,
				lastUpdated: '2023-12-01T10:00:00.000Z',
				lastSeenAvailable: mockLastSeenMatrix,
			});
		});

		it('should return default values when no data is stored', async () => {
			const result = await service.getStatus();

			expect(result).toEqual({
				serverTypes: [],
				locations: [],
				availability: {},
				supported: {},
				lastUpdated: null,
				lastSeenAvailable: {},
			});
		});
	});

	describe('fetchAndUpdateStatus', () => {
		it('should fetch and process cloud data successfully', async () => {
			// Mock successful API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			const result = await service.fetchAndUpdateStatus();

			expect(mockFetch).toHaveBeenCalledTimes(2);
			expect(mockFetch).toHaveBeenNthCalledWith(
				1,
				'https://api.hetzner.cloud/v1/server_types?page=1&per_page=50',
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: `Bearer ${testApiToken}`,
						'User-Agent': expect.stringContaining('Hetzner-Radar-CloudAvailability-Monitor'),
					}),
				}),
			);
			expect(mockFetch).toHaveBeenNthCalledWith(
				2,
				'https://api.hetzner.cloud/v1/locations?page=1&per_page=50',
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: `Bearer ${testApiToken}`,
					}),
				}),
			);

			expect(Array.isArray(result)).toBe(true);
		});

		it('should fetch all paginated server type pages', async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponsePaginatedPage1,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponsePaginatedPage2,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			await service.fetchAndUpdateStatus();

			expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://api.hetzner.cloud/v1/server_types?page=1&per_page=50', expect.anything());
			expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://api.hetzner.cloud/v1/server_types?page=2&per_page=50', expect.anything());
			expect(mockFetch).toHaveBeenNthCalledWith(3, 'https://api.hetzner.cloud/v1/locations?page=1&per_page=50', expect.anything());
		});

		it('should throw error when API token is missing', async () => {
			const serviceWithoutToken = new CloudStatusService('', mockStorage as DurableObjectStorage, testDoId);

			await expect(serviceWithoutToken.fetchAndUpdateStatus()).rejects.toThrow('HETZNER_API_TOKEN is not configured.');
		});

		it('should handle server types API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: async () => 'Unauthorized',
			});

			await expect(service.fetchAndUpdateStatus()).rejects.toThrow('Failed to fetch server types: 401 Unauthorized');
		});

		it('should handle locations API errors', async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					text: async () => 'Internal Server Error',
				});

			await expect(service.fetchAndUpdateStatus()).rejects.toThrow('Failed to fetch locations: 500 Internal Server Error');
		});

		it('should store processed data correctly', async () => {
			// Mock successful API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			const putSpy = vi.spyOn(mockStorage, 'put');

			await service.fetchAndUpdateStatus();

			expect(putSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					serverTypes: expect.arrayContaining([
						expect.objectContaining({
							id: 1,
							name: 'cx11',
							category: 'regular_purpose',
							storageType: 'local',
							isDeprecated: false,
							deprecated: false,
						}),
						expect.objectContaining({
							id: 3,
							name: 'cx31',
							category: 'regular_purpose',
							storageType: 'local',
							isDeprecated: true,
							deprecated: true,
						}),
					]),
					locations: expect.arrayContaining([
						expect.objectContaining({
							id: 1,
							name: 'nbg1',
							city: 'Nuremberg',
							country: 'Germany',
						}),
					]),
					availability: expect.objectContaining({
						1: expect.arrayContaining([1, 2]), // nbg1 has cx11, cx21 available
						2: expect.arrayContaining([1, 3]), // fsn1 has cx11, cx31 available
						3: expect.arrayContaining([2, 3]), // hel1 has cx21, cx31 available
					}),
					supported: expect.objectContaining({
						1: expect.arrayContaining([1, 2, 3]),
						2: expect.arrayContaining([1, 2, 3]),
						3: expect.arrayContaining([1, 2, 3]),
					}),
					lastUpdated: expect.any(String),
					lastSeenAvailable: expect.any(Object),
				}),
			);
		});

		it('should detect availability changes correctly', async () => {
			// Mock successful API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			// Set up previous availability state, computed under the current
			// algorithm version — otherwise the version-mismatch guard treats it as
			// stale (pre-migration) state and skips diffing.
			await mockStorage.put('availability', {
				1: [1], // nbg1 only had cx11 before
				2: [1, 2, 3], // fsn1 had all before
				3: [2], // hel1 only had cx21 before
			});
			await mockStorage.put('availabilityAlgorithmVersion', 2);

			const changes = await service.fetchAndUpdateStatus();

			// Should detect:
			// - cx21 now available in nbg1 (new)
			// - cx21 no longer available in fsn1 (removed)
			// - cx31 now available in hel1 (new)
			expect(changes).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						serverTypeId: 2,
						serverTypeName: 'cx21',
						locationId: 1,
						locationName: 'nbg1',
						eventType: 'available',
					}),
					expect.objectContaining({
						serverTypeId: 2,
						serverTypeName: 'cx21',
						locationId: 2,
						locationName: 'fsn1',
						eventType: 'unavailable',
					}),
					expect.objectContaining({
						serverTypeId: 3,
						serverTypeName: 'cx31',
						locationId: 3,
						locationName: 'hel1',
						eventType: 'available',
					}),
				]),
			);
		});

		it('should return empty changes array when no previous data exists', async () => {
			// Mock successful API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			const changes = await service.fetchAndUpdateStatus();

			expect(changes).toEqual([]);
		});

		it('should skip change detection when stored availability predates the current algorithm version', async () => {
			// Mock successful API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			// Previous availability exists, but with no algorithm version recorded
			// (as if written before the version was introduced) — e.g. by the old
			// datacenter.server_types-based algorithm, which disagreed with the
			// current one on several pairs. Diffing against it would report that
			// disagreement as real availability changes.
			await mockStorage.put('availability', {
				1: [], // nbg1 previously reported nothing available
				2: [], // fsn1 previously reported nothing available
				3: [], // hel1 previously reported nothing available
			});

			const changes = await service.fetchAndUpdateStatus();

			expect(changes).toEqual([]);
		});

		it('should update last seen timestamps correctly', async () => {
			// Mock successful API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			const putSpy = vi.spyOn(mockStorage, 'put');

			await service.fetchAndUpdateStatus();

			const storedData = putSpy.mock.calls[0][0] as { lastSeenAvailable: LastSeenMatrix };
			const lastSeenAvailable = storedData.lastSeenAvailable;

			// Check that all available server types have updated timestamps
			expect(lastSeenAvailable['1-1']).toBeDefined(); // nbg1-cx11
			expect(lastSeenAvailable['1-2']).toBeDefined(); // nbg1-cx21
			expect(lastSeenAvailable['2-1']).toBeDefined(); // fsn1-cx11
			expect(lastSeenAvailable['2-3']).toBeDefined(); // fsn1-cx31
			expect(lastSeenAvailable['3-2']).toBeDefined(); // hel1-cx21
			expect(lastSeenAvailable['3-3']).toBeDefined(); // hel1-cx31
		});

		it('should preserve existing last seen timestamps for unchanged availability', async () => {
			// Mock successful API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			const existingLastSeen = {
				'1-1': '2023-11-01T10:00:00.000Z',
				'2-2': '2023-11-01T09:00:00.000Z',
			};
			await mockStorage.put('lastSeenAvailable', existingLastSeen);

			const putSpy = vi.spyOn(mockStorage, 'put');
			await service.fetchAndUpdateStatus();

			const storedData = putSpy.mock.calls[0][0] as { lastSeenAvailable: LastSeenMatrix };
			const lastSeenAvailable = storedData.lastSeenAvailable;

			// Should have both old and new timestamps
			expect(Object.keys(lastSeenAvailable).length).toBeGreaterThan(2);
		});

		it('should handle network errors gracefully', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await expect(service.fetchAndUpdateStatus()).rejects.toThrow('Network error');
		});

		it('should process server types with deprecation correctly', async () => {
			// Mock successful API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			const putSpy = vi.spyOn(mockStorage, 'put');

			await service.fetchAndUpdateStatus();

			const storedData = putSpy.mock.calls[0][0] as { lastSeenAvailable: LastSeenMatrix };
			const serverTypes = storedData.serverTypes;

			const deprecatedType = serverTypes.find((st: unknown) => st.id === 3);
			const nonDeprecatedType = serverTypes.find((st: unknown) => st.id === 1);

			expect(deprecatedType.isDeprecated).toBe(true);
			expect(nonDeprecatedType.isDeprecated).toBe(false);
		});

		it('should sort server types and locations alphabetically', async () => {
			// Mock successful API responses
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerServerTypesResponse,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			const putSpy = vi.spyOn(mockStorage, 'put');

			await service.fetchAndUpdateStatus();

			const storedData = putSpy.mock.calls[0][0] as { lastSeenAvailable: LastSeenMatrix };
			const serverTypes = storedData.serverTypes;
			const locations = storedData.locations;

			// Check that server types are sorted by name
			for (let i = 1; i < serverTypes.length; i++) {
				expect(serverTypes[i].name.localeCompare(serverTypes[i - 1].name)).toBeGreaterThanOrEqual(0);
			}

			// Check that locations are sorted by name
			for (let i = 1; i < locations.length; i++) {
				expect(locations[i].name.localeCompare(locations[i - 1].name)).toBeGreaterThanOrEqual(0);
			}
		});

		it('should read availability from server_type.locations[].available', async () => {
			// The deprecated datacenters endpoint drifted out of sync with reality
			// (it claimed every CAX type was available while none could be created),
			// so availability must come from the per-location flag on the type.
			mockFetch
				.mockResolvedValueOnce({ ok: true, json: async () => mockHetznerServerTypesResponse })
				.mockResolvedValueOnce({ ok: true, json: async () => mockHetznerLocationsResponse });

			const putSpy = vi.spyOn(mockStorage, 'put');
			await service.fetchAndUpdateStatus();

			const stored = putSpy.mock.calls[0][0] as { availability: AvailabilityMatrix; supported: SupportMatrix };

			// cx11 available in nbg1+fsn1, cx21 in nbg1+hel1, cx31 in fsn1+hel1.
			expect(stored.availability).toEqual({ 1: [1, 2], 2: [1, 3], 3: [2, 3] });
			// Every type names every location, so all three are supported everywhere.
			expect(stored.supported).toEqual({ 1: [1, 2, 3], 2: [1, 2, 3], 3: [1, 2, 3] });
		});

		it('should keep a location that offers nothing as an empty column', async () => {
			const serverTypesNowhereAvailable = {
				...mockHetznerServerTypesResponse,
				server_types: mockHetznerServerTypesResponse.server_types.map((st) => ({
					...st,
					locations: st.locations.filter((loc) => loc.id !== 3),
				})),
			};

			mockFetch
				.mockResolvedValueOnce({ ok: true, json: async () => serverTypesNowhereAvailable })
				.mockResolvedValueOnce({ ok: true, json: async () => mockHetznerLocationsResponse });

			const putSpy = vi.spyOn(mockStorage, 'put');
			await service.fetchAndUpdateStatus();

			const stored = putSpy.mock.calls[0][0] as {
				availability: AvailabilityMatrix;
				supported: SupportMatrix;
				locations: LocationInfo[];
			};

			// hel1 supports nothing now, but must not vanish from the grid.
			expect(stored.locations.map((l) => l.name)).toContain('hel1');
			expect(stored.availability[3]).toEqual([]);
			expect(stored.supported[3]).toEqual([]);
		});

		it('should deduplicate and sort server type ids per location', async () => {
			// A server type naming the same location twice in its `locations[]`
			// array is the actual source of duplicates this logic must survive.
			const responseWithDuplicateLocationEntry = {
				...mockHetznerServerTypesResponse,
				server_types: [
					{
						...mockHetznerServerTypesResponse.server_types[0],
						locations: [
							{ id: 1, name: 'nbg1', available: true, recommended: false, deprecation: null },
							{ id: 1, name: 'nbg1', available: true, recommended: false, deprecation: null },
						],
					},
					...mockHetznerServerTypesResponse.server_types.slice(1),
				],
			};

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => responseWithDuplicateLocationEntry,
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockHetznerLocationsResponse,
				});

			const putSpy = vi.spyOn(mockStorage, 'put');

			await service.fetchAndUpdateStatus();

			const storedData = putSpy.mock.calls[0][0] as { lastSeenAvailable: LastSeenMatrix };
			const availability = storedData.availability;

			// nbg1 (location 1) must count server type 1 exactly once despite the
			// duplicate entry.
			expect(availability[1].filter((id) => id === 1)).toEqual([1]);

			// Every location should have sorted unique server type IDs.
			Object.values(availability).forEach((serverTypeIds: unknown) => {
				expect(Array.isArray(serverTypeIds)).toBe(true);
				expect(serverTypeIds).toEqual([...new Set(serverTypeIds)].sort((a, b) => a - b));
			});
		});
	});
});
