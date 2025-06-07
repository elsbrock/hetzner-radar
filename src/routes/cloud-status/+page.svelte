<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import 'leaflet/dist/leaflet.css';
	import type L from 'leaflet';
	import { settingsStore } from '$lib/stores/settings'; // Import settings store
	import CloudAlertModal from '$lib/components/CloudAlertModal.svelte';
	import { invalidateAll } from '$app/navigation';
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
		Alert,
		A,
		Button
	} from 'flowbite-svelte';
	import {
		CheckCircleSolid,
		CloseCircleOutline,
		CloseCircleSolid,
		ExclamationCircleSolid,
		InfoCircleSolid,
		BellRingSolid
	} from 'flowbite-svelte-icons';

	export let data: PageData;

	// Cloud alert modal state
	let showCloudAlertModal = false;
	let editingCloudAlert: any = null;

	// Server type and location options based on cloud status data
	$: serverTypeOptions = data.statusData?.serverTypes?.map(st => ({
		value: st.id,
		name: `${st.name.toUpperCase()} - ${st.cores} Core${st.cores > 1 ? 's' : ''} / ${st.memory} GB RAM`
	})) || [];

	$: locationOptions = data.statusData?.locations?.map(loc => ({
		value: loc.id,
		name: `${loc.city}, ${loc.country} (${loc.name})`
	})) || [];

	function openCreateAlertModal() {
		editingCloudAlert = null;
		showCloudAlertModal = true;
	}

	// --- Tile Layer Configuration ---
	const lightTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	const lightTileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
	const darkTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
	const darkTileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
	// --- End Tile Layer Configuration ---


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
	let currentTileLayer: L.TileLayer | null = null; // Reference to the current tile layer
	let isDarkMode = false; // Reactive variable for theme state
	let L_Instance: typeof L | null = null; // Store Leaflet instance
	let themeObserver: MutationObserver | null = null; // Observer for <html> class changes

	function updateMapTheme() {
		if (!browser || !map || !L_Instance) return;

		const currentlyDark = document.documentElement.classList.contains('dark');
		if (currentlyDark === isDarkMode && currentTileLayer) return; // No change needed

		isDarkMode = currentlyDark;

		// Remove existing layer if it exists
		if (currentTileLayer) {
			map.removeLayer(currentTileLayer);
			currentTileLayer = null;
		}

		// Add new layer
		const tileUrl = isDarkMode ? darkTileUrl : lightTileUrl;
		const tileAttribution = isDarkMode ? darkTileAttribution : lightTileAttribution;

		currentTileLayer = L_Instance.tileLayer(tileUrl, {
			attribution: tileAttribution,
			maxZoom: 18, // Standard max zoom
			minZoom: 2   // Prevent zooming out too far
		}).addTo(map);
	}


	onMount(async () => {
		if (browser) {
			L_Instance = await import('leaflet'); // Store L instance

			delete (L_Instance.Icon.Default.prototype as any)._getIconUrl;
			L_Instance.Icon.Default.mergeOptions({
				iconRetinaUrl: '/node_modules/leaflet/dist/images/marker-icon-2x.png',
				iconUrl: '/node_modules/leaflet/dist/images/marker-icon.png',
				shadowUrl: '/node_modules/leaflet/dist/images/marker-shadow.png'
			});

			const createDivIcon = (color: string) => {
				return L_Instance!.divIcon({ // Use L_Instance
					html: `<span style="background-color: ${color}; width: 1rem; height: 1rem; display: block; border-radius: 50%; border: 1px solid white;"></span>`,
					className: 'custom-div-icon',
					iconSize: [16, 16],
					iconAnchor: [8, 8]
				});
			};

			const iconAllAvailable = createDivIcon('green');
			const iconSomeAvailable = createDivIcon('orange');
			const iconNoneAvailable = createDivIcon('red');

			// Use setTimeout to ensure the DOM element is ready
			setTimeout(() => {
				if (data.statusData?.locations && document.getElementById('map') && !mapInitialized) {
					try {
						map = L_Instance!.map('map', {}); // Initialize map

						// Initial theme setup
						updateMapTheme(); // Set initial tile layer based on theme

						const markers: L.Marker[] = [];
						const bounds = L_Instance!.latLngBounds([]);

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
										icon = iconNoneAvailable;
										popupText += '<br>Status: No server types available';
										break;
								}

								const marker = L_Instance!.marker(latLng, { icon: icon })
									.bindPopup(popupText)
									.addTo(map!);
								markers.push(marker);
								bounds.extend(latLng);
							}
						});

						if (markers.length > 0 && bounds.isValid()) {
							map.fitBounds(bounds, { padding: [50, 50] });
						} else {
							map.setView([51.1657, 10.4515], 5);
						}

						mapInitialized = true;

						// --- Observe theme changes ---
						themeObserver = new MutationObserver((mutationsList) => {
							for(let mutation of mutationsList) {
								if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
									updateMapTheme(); // Update map on class change
								}
							}
						});
						themeObserver.observe(document.documentElement, { attributes: true });
						// --- End Observe theme changes ---

					} catch (error) {
						console.error('Leaflet map initialization failed:', error);
					}
				}
			}, 100); // Delay slightly
		}
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
			mapInitialized = false;
		}
		if (themeObserver) {
			themeObserver.disconnect(); // Clean up observer
			themeObserver = null;
		}
		L_Instance = null; // Clear L instance
		currentTileLayer = null;
	});

</script>

<div class="p-4 dark:text-gray-100">
	<Heading tag="h1" class="text-3xl font-bold mt-4 mb-4 text-center dark:text-gray-100">Cloud Server Availability</Heading>
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
			<div class="w-full shadow border dark:border-gray-700 rounded-t-lg overflow-hidden bg-white dark:bg-gray-800">
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
						<Table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
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
															<Tooltip triggeredBy="#deprecated-{serverType.id}" class="z-50">This server type is deprecated.</Tooltip>
														{/if}
													</div>
													<span class="text-xs text-gray-500 dark:text-gray-400 mt-1">
														{serverType.cores} Cores / {serverType.memory} GB RAM / {serverType.disk} GB Disk
													</span>
												</div>
												<Tooltip triggeredBy="#{serverType.name}-tooltip" class="z-50">{serverType.description}</Tooltip>
												<div id="{serverType.name}-tooltip" class="inline-block"></div>
											</TableBodyCell>
											{#each data.statusData.locations as location}
												{@const available = isAvailable(location.id, serverType.id)}
												<TableBodyCell class="text-center px-4 py-4">
													{#if available}
														<CheckCircleSolid size="xl" color="green" class="w-6 h-6 inline-block align-middle" id="avail-{location.id}-{serverType.id}" />
														<Tooltip triggeredBy="#avail-{location.id}-{serverType.id}" class="z-50">Available in {location.city}</Tooltip>
													{:else}
														<CloseCircleSolid size="xl" color="red" class="w-6 h-6 inline-block align-middle" id="notavail-{location.id}-{serverType.id}" />
														<Tooltip triggeredBy="#notavail-{location.id}-{serverType.id}" class="z-50">Not available in {location.city}</Tooltip>
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

	<section class="mt-12 mb-8">
		<div class="mx-4 md:mx-8 lg:mx-auto lg:max-w-7xl">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
				<div class="text-center">
					<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
						Stay Ahead of Availability Changes
					</h3>
					<p class="text-gray-600 dark:text-gray-400 mb-4 max-w-2xl mx-auto">
						Get instant notifications when your desired server types become available or unavailable in specific locations. 
						Set up smart alerts to never miss the perfect server configuration for your needs.
					</p>
					<div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
						{#if data.user}
							<Button on:click={openCreateAlertModal} color="primary" class="px-6 py-2 font-medium">
								<BellRingSolid class="w-4 h-4 mr-2" />
								Create Availability Alert
							</Button>
							<span class="text-sm text-gray-500 dark:text-gray-400">
								Create alerts instantly or <a href="/alerts?tab=cloud-alerts" class="underline hover:text-orange-500">manage existing ones</a>
							</span>
						{:else}
							<Button href="/auth/login" color="primary" class="px-6 py-2 font-medium">
								<InfoCircleSolid class="w-4 h-4 mr-2" />
								Sign In to Create Alerts
							</Button>
							<span class="text-sm text-gray-500 dark:text-gray-400">
								Free email and Discord notifications
							</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>

</div>

<!-- Cloud Alert Modal -->
<CloudAlertModal 
	bind:open={showCloudAlertModal}
	alert={editingCloudAlert}
	{serverTypeOptions}
	{locationOptions}
	on:success={() => invalidateAll()}
	on:close={() => { showCloudAlertModal = false; }}
/>

