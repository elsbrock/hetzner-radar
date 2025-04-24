<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import 'leaflet/dist/leaflet.css';
	import type L from 'leaflet';
	import {
		Table,
		TableHead,
		TableBody,
		TableHeadCell,
		TableBodyRow,
		TableBodyCell,
		Badge,
		Tooltip,
		Spinner,
		P,
		Heading,
	} from 'flowbite-svelte';
	import {
		CheckCircleSolid,
		CloseCircleOutline,
		CloseCircleSolid,
		ExclamationCircleSolid
	} from 'flowbite-svelte-icons';

	export let data: PageData;

	interface ServerTypeInfo {
		id: number;
		name: string;
		description: string;
		cores: number;
		memory: number;
		disk: number;
		cpu_type: 'shared' | 'dedicated';
		architecture: string;
		deprecated: boolean;
	}

	$: groupedServerTypes = (() => {
		const groups = new Map<string, Map<string, ServerTypeInfo[]>>();
		if (!data.statusData?.serverTypes) {
			return groups;
		}

		const serverTypesTyped: ServerTypeInfo[] = data.statusData.serverTypes as ServerTypeInfo[];

		serverTypesTyped.forEach((serverType) => {
			if (!groups.has(serverType.architecture)) {
				groups.set(serverType.architecture, new Map<string, ServerTypeInfo[]>());
			}
			const archGroup = groups.get(serverType.architecture)!;

			if (!archGroup.has(serverType.cpu_type)) {
				archGroup.set(serverType.cpu_type, []);
			}
			archGroup.get(serverType.cpu_type)!.push(serverType);
		});

		// Custom sort order for architectures
		const architectureOrder = ['x86', 'arm'];
		const sortedGroups = new Map([...groups.entries()].sort(([archA], [archB]) => {
			const indexA = architectureOrder.indexOf(archA);
			const indexB = architectureOrder.indexOf(archB);
			if (indexA === -1 && indexB === -1) return archA.localeCompare(archB); // Fallback for unknown
			if (indexA === -1) return 1; // Unknown last
			if (indexB === -1) return -1; // Unknown last
			return indexA - indexB;
		}));

		// Custom sort order for CPU types within each architecture
		const cpuTypeOrder = ['shared', 'dedicated'];
		sortedGroups.forEach((cpuMap) => {
			const sortedCpuMap = new Map([...cpuMap.entries()].sort(([typeA], [typeB]) => {
				const indexA = cpuTypeOrder.indexOf(typeA);
				const indexB = cpuTypeOrder.indexOf(typeB);
				if (indexA === -1 && indexB === -1) return typeA.localeCompare(typeB); // Fallback for unknown
				if (indexA === -1) return 1; // Unknown last
				if (indexB === -1) return -1; // Unknown last
				return indexA - indexB;
			}));
			// Rebuild the map with the new order
			const originalEntries = [...cpuMap.entries()]; // Keep original data
			cpuMap.clear();
			sortedCpuMap.forEach((_, key) => {
				const originalValue = originalEntries.find(([k]) => k === key)?.[1];
				if (originalValue) {
					cpuMap.set(key, originalValue);
				}
			});
		});

		return sortedGroups;
	})();

	function formatTimestamp(timestamp: string | null | undefined): string {
		if (!timestamp) return 'Loading...';
		try {
			const date = new Date(timestamp);
			return date.toLocaleString();
		} catch (e) {
			console.error('Error formatting timestamp:', e);
			return 'Invalid Date';
		}
	}

	function isAvailable(locationId: number, serverTypeId: number): boolean {
		if (!data.statusData?.availability) return false;
		const locationAvailability = data.statusData.availability[locationId];
		return locationAvailability ? locationAvailability.includes(serverTypeId) : false;
	}


	type LocationStatus = 'all' | 'some' | 'none';

	function getLocationAvailabilityStatus(locationId: number): LocationStatus {
		if (!data.statusData?.availability || !data.statusData?.serverTypes || data.statusData.serverTypes.length === 0) return 'none';

		const locationAvailability = data.statusData.availability[locationId];
		
		// Consider only non-deprecated server types for status calculation
		const activeServerTypes = data.statusData.serverTypes.filter(st => !st.deprecated);
		const totalActiveCount = activeServerTypes.length;

		if (totalActiveCount === 0) return 'none'; // No active types to check against

		if (!locationAvailability || locationAvailability.length === 0) {
			return 'none'; // No types available for this location (even deprecated ones)
		}

		// Count how many *active* server types are available in this location
		const availableActiveCount = locationAvailability.filter(id => 
			activeServerTypes.some(st => st.id === id)
		).length;

		if (availableActiveCount === totalActiveCount) {
			return 'all'; // All active types available
		} else if (availableActiveCount > 0) {
			return 'some'; // Some active types available
		} else {
			return 'none'; // No active types available
		}
	}

	let map: L.Map | null = null;
	let mapInitialized = false;

	onMount(async () => {
		if (browser) {
			const L = await import('leaflet');

			delete (L.Icon.Default.prototype as any)._getIconUrl;
			L.Icon.Default.mergeOptions({
				iconRetinaUrl: '/node_modules/leaflet/dist/images/marker-icon-2x.png',
				iconUrl: '/node_modules/leaflet/dist/images/marker-icon.png',
				shadowUrl: '/node_modules/leaflet/dist/images/marker-shadow.png'
			});

			const createDivIcon = (color: string) => {
				return L.divIcon({
					html: `<span style="background-color: ${color}; width: 1rem; height: 1rem; display: block; border-radius: 50%; border: 1px solid white;"></span>`,
					className: 'custom-div-icon', // Important for potential CSS overrides
					iconSize: [16, 16],
					iconAnchor: [8, 8] // Center the icon
				});
			};

			const iconAllAvailable = createDivIcon('green');
			const iconSomeAvailable = createDivIcon('orange');
			const iconNoneAvailable = createDivIcon('red');

			setTimeout(() => {
				if (data.statusData?.locations && document.getElementById('map') && !mapInitialized) {
					try {
						map = L.map('map', {}); // Initialize without setView

						L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
							attribution:
								'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
						}).addTo(map);

						const markers: L.Marker[] = [];
						const bounds = L.latLngBounds([]); // Create empty bounds

						data.statusData.locations.forEach((location) => {
							if (location.latitude && location.longitude) {
								const latLng: L.LatLngTuple = [location.latitude, location.longitude];
								const status = getLocationAvailabilityStatus(location.id);
								let icon;
								let popupText = `<b>${location.city}, ${location.country}</b> (${location.name})`;

								switch (status) {
									case 'all':
										icon = iconAllAvailable;
										popupText += '<br>Status: All server types available';
										break;
									case 'some':
										icon = iconSomeAvailable;
										popupText += '<br>Status: Not all server types available';
										break;
									case 'none':
									default:
										icon = iconNoneAvailable; // Use red icon for none
										popupText += '<br>Status: No server types available';
										break;
								}

								const marker = L.marker(latLng, { icon: icon }) // Use the determined icon
									.bindPopup(popupText) // Updated popup text
									.addTo(map!);
								markers.push(marker);
								bounds.extend(latLng); // Extend bounds with marker location
							}
						});

						// Fit map to bounds if there are markers
						if (markers.length > 0 && bounds.isValid()) {
							map.fitBounds(bounds, { padding: [50, 50] }); // Add some padding
						} else {
							// Fallback if no locations or bounds are invalid
							map.setView([51.1657, 10.4515], 5);
						}

						mapInitialized = true;
					} catch (error) {
						console.error('Leaflet map initialization failed:', error);
					}
				}
			}, 100);
		}
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
			mapInitialized = false;
		}
	});
</script>

<div class="p-4 dark:bg-gray-900 dark:text-gray-100">
	<Heading tag="h1" class="text-3xl font-bold mt-4 mb-4 text-center">Cloud Server Availability</Heading>
	<P class="text-center text-lg text-gray-600 dark:text-gray-400 mb-4">
		Track the real-time availability of Hetzner Cloud server types across different locations.
	</P>

	{#if data.error}
		<Badge color="red" class="p-4 text-lg w-full justify-center">
			<strong class="font-bold mr-2">Error:</strong>
			{data.error}
		</Badge>
	{:else if data.statusData}
		<div class="mb-8 text-center text-sm text-gray-500 dark:text-gray-400">
			Last Updated: {formatTimestamp(data.statusData.lastUpdated)}
		</div>

		<!-- Wrapper for Map and Table -->
		<div class="mx-4 md:mx-8 lg:mx-auto lg:max-w-7xl">
			<!-- Map Container -->
			<div class="w-full shadow border dark:border-gray-700 rounded-t-lg overflow-hidden">
				{#if browser}
					<div id="map" class="h-96 w-full"></div>
				{:else}
					<div class="h-96 w-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
						<p class="text-gray-500 dark:text-gray-400">Map loading...</p>
					</div>
				{/if}
			</div>

			<!-- Table Container -->
			<div class="overflow-x-auto">
				<div class="inline-block min-w-full align-middle">
					<div class="overflow-hidden rounded-b-lg border-b border-l border-r dark:border-gray-700">
						<Table hoverable={true} class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
							<TableHead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
								<TableHeadCell class="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-4 pb-3 pt-4 align-middle">Server Type</TableHeadCell>
								{#each data.statusData.locations as location}
								<TableHeadCell class="text-center whitespace-nowrap px-4 pb-3 pt-4 align-middle">
									{location.city}, {location.country}<br />
									<span class="text-xs font-normal text-gray-500 dark:text-gray-400">({location.name})</span>
								</TableHeadCell>
							{/each}
						</TableHead>
						<TableBody class="divide-y dark:divide-gray-700">
							{#each groupedServerTypes as [architecture, cpuGroups]}
								{#each cpuGroups as [cpuType, serverTypes]}
									<TableBodyRow class="bg-gray-200 dark:bg-gray-700 border-t border-b dark:border-gray-600">
										<TableBodyCell colspan={data.statusData.locations.length + 1} class="px-4 py-3 font-bold text-sm uppercase text-gray-600 dark:text-gray-400 tracking-wider">
											{architecture.toUpperCase()} / {cpuType.charAt(0).toUpperCase() + cpuType.slice(1)} CPU
										</TableBodyCell>
									</TableBodyRow>

									{#each serverTypes as serverType}
										<TableBodyRow class="bg-white dark:bg-gray-800 text-sm">
											<TableBodyCell class="font-medium text-gray-900 dark:text-white whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800 px-4 py-4 flex items-center">
												<div class="flex flex-col">
													<div class="flex items-center space-x-2">
														<span class="font-semibold text-base">{serverType.name.toUpperCase()}</span>
														{#if serverType.deprecated}
															<Badge color="yellow" class="inline-flex items-center px-1.5 py-0.5 text-xs" id="deprecated-{serverType.id}">
																<ExclamationCircleSolid class="w-3 h-3 mr-1" /> Deprecated
															</Badge>
															<Tooltip triggeredBy="#deprecated-{serverType.id}">This server type is deprecated.</Tooltip>
														{/if}
													</div>
													<span class="text-xs text-gray-500 dark:text-gray-400 mt-1">
														{serverType.cores} Cores / {serverType.memory} GB RAM / {serverType.disk} GB Disk
													</span>
												</div>
												<Tooltip triggeredBy="#{serverType.name}-tooltip">{serverType.description}</Tooltip>
												<div id="{serverType.name}-tooltip" class="inline-block"></div>
											</TableBodyCell>
											{#each data.statusData.locations as location}
												{@const available = isAvailable(location.id, serverType.id)}
												<TableBodyCell class="text-center px-4 py-4">
													{#if available}
														<CheckCircleSolid size="xl" color="green" class="w-6 h-6 inline-block align-middle" id="avail-{location.id}-{serverType.id}" />
														<Tooltip triggeredBy="#avail-{location.id}-{serverType.id}">Available in {location.city}</Tooltip>
													{:else}
														<CloseCircleSolid size="xl" color="red" class="w-6 h-6 inline-block align-middle" id="notavail-{location.id}-{serverType.id}" />
														<Tooltip triggeredBy="#notavail-{location.id}-{serverType.id}">Not available in {location.city}</Tooltip>
													{/if}
												</TableBodyCell>
											{/each}
										</TableBodyRow>
									{/each}
								{/each}
							{/each}
						</TableBody>
						</Table>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex justify-center items-center p-10">
			<Spinner size="8" />
			<p class="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading availability data...</p>
		</div>
	{/if}

	<section class="mt-8 mb-12">
		<h2 class="text-3xl font-semibold text-gray-800 dark:text-gray-200 mb-6 text-center">
			How It Works
		</h2>
		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md max-w-3xl mx-auto">
			<p class="text-gray-700 dark:text-gray-400">
				This page periodically checks the official Hetzner Cloud status information to determine which server types are currently available in each location.
				The availability status is aggregated for each location (e.g., Falkenstein, Helsinki) based on the data provided by Hetzner.
				Your browser then displays this processed status information in the map and table above. The data is typically updated every minute, and the "Last Updated" timestamp indicates the time of the last successful check.
			</p>
		</div>
	</section>
</div>