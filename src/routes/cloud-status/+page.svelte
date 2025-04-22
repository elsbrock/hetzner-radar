<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import 'leaflet/dist/leaflet.css';
	import type L from 'leaflet';
	// Import Flowbite-Svelte components
	import {
		Table,
		TableHead,
		TableBody,
		TableHeadCell,
		TableBodyRow,
		TableBodyCell,
		Badge,
		Tooltip,
		Spinner, // For loading state
		P, // Paragraph component
		Heading, // Heading component
		Card // Card for How it Works
	} from 'flowbite-svelte';
	import {
		CheckCircleSolid,
		CloseCircleSolid,
		MapPinSolid,
		ExclamationCircleSolid // Added for deprecated marker
	} from 'flowbite-svelte-icons'; // Icons

	export let data: PageData;

	// Define the full ServerTypeInfo based on expected data
	interface ServerTypeInfo {
		id: number;
		name: string;
		description: string;
		cores: number;
		memory: number;
		disk: number;
		cpu_type: 'shared' | 'dedicated';
		architecture: string; // Added
		deprecated: boolean; // Added
	}

	// Reactive grouping of server types
	$: groupedServerTypes = (() => {
		const groups = new Map<string, Map<string, ServerTypeInfo[]>>();
		if (!data.statusData?.serverTypes) {
			return groups;
		}

		// Ensure correct typing from the start
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

		// Optional: Sort architectures (e.g., x86 first) and cpu_types (e.g., shared first)
		const sortedGroups = new Map([...groups.entries()].sort());
		sortedGroups.forEach((cpuMap) => {
			const sortedCpuMap = new Map([...cpuMap.entries()].sort());
			cpuMap.clear();
			sortedCpuMap.forEach((value, key) => cpuMap.set(key, value));
		});

		return sortedGroups;
	})();

	function formatTimestamp(timestamp: string | null | undefined): string {
		if (!timestamp) return 'Loading...';
		try {
			const date = new Date(timestamp);
			return date.toLocaleString(); // Or use toLocaleDateString() / toLocaleTimeString()
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

	let map: L.Map | null = null;
	let mapInitialized = false;

	onMount(async () => {
		if (browser) {
			const L = await import('leaflet');

			// Delay map initialization slightly to ensure the container is ready
			setTimeout(() => {
				if (data.statusData?.locations && document.getElementById('map') && !mapInitialized) {
					try {
						map = L.map('map', {
							// Remove default zoom controls if desired, or customize
							// zoomControl: false,
						}).setView([51.1657, 10.4515], 5); // Centered roughly on Germany

						L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
							attribution:
								'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
						}).addTo(map);

						// Optional: Custom icon
						// const mapIcon = L.icon({
						// 	iconUrl: '/path/to/your/marker-icon.png',
						// 	iconSize: [25, 41],
						// 	iconAnchor: [12, 41],
						// 	popupAnchor: [1, -34],
						// });

						data.statusData.locations.forEach((location) => {
							if (location.latitude && location.longitude) {
								const marker = L.marker([location.latitude, location.longitude], {
									// icon: mapIcon // Use custom icon if defined
								})
									.bindPopup(`<b>${location.city}, ${location.country}</b> (${location.name})`)
									.addTo(map!);
								// Optional: Open popup on hover
								// marker.on('mouseover', function (e) { this.openPopup(); });
								// marker.on('mouseout', function (e) { this.closePopup(); });
							}
						});
						mapInitialized = true;
					} catch (error) {
						console.error('Leaflet map initialization failed:', error);
						// Optionally display an error message to the user
					}
				}
			}, 100); // 100ms delay
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

<div class="p-4 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
	<Heading tag="h1" class="text-3xl font-bold mb-3 text-center">Hetzner Cloud Server Availability</Heading>
	<P class="text-center text-lg text-gray-600 dark:text-gray-400 mb-2">
		Track the real-time availability of Hetzner Cloud server types across different locations.
	</P>
	<!-- Disclaimer will be added at the bottom -->

	{#if data.error}
		<Badge color="red" class="p-4 text-lg w-full justify-center">
			<strong class="font-bold mr-2">Error:</strong>
			{data.error}
		</Badge>
	{:else if data.statusData}
		<div class="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
			Last Updated: {formatTimestamp(data.statusData.lastUpdated)}
		</div>

		<!-- Leaflet Map Container - Full width, no border/shadow -->
		<div class="w-full"> <!-- Removed mb-6 -->
			{#if browser}
				<div id="map" class="h-64 md:h-80 w-full"></div> <!-- Adjusted height -->
			{:else}
				<div class="h-64 md:h-80 w-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
					<p class="text-gray-500 dark:text-gray-400">Map loading...</p>
				</div>
			{/if}
		</div>

		<!-- Table Container - Allows horizontal scroll, not forced full width -->
		<div class="w-full overflow-x-auto mb-8">
			<div class="inline-block min-w-full align-middle">
				<div class="overflow-hidden shadow sm:rounded-lg border dark:border-gray-700">
					<Table hoverable={true} class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
						<TableHead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
							<TableHeadCell class="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-4 py-3">Server Type</TableHeadCell>
							{#each data.statusData.locations as location}
								<TableHeadCell class="text-center whitespace-nowrap px-4 py-3">
									<div class="flex flex-col items-center">
										<span>{location.city}, {location.country}</span>
										<span class="text-xs font-normal text-gray-500 dark:text-gray-400">({location.name})</span>
									</div>
									<Tooltip triggeredBy="#{location.name}-tooltip">
										{location.city}, {location.country} ({location.name}) - Lat: {location.latitude}, Lng: {location.longitude}
									</Tooltip>
									<div id="{location.name}-tooltip" class="inline-block"></div> <!-- Trigger for tooltip -->
								</TableHeadCell>
							{/each}
						</TableHead>
						<TableBody class="divide-y dark:divide-gray-700">
							{#each groupedServerTypes as [architecture, cpuGroups]}
								{#each cpuGroups as [cpuType, serverTypes]}
									<!-- Group Header Row -->
									<TableBodyRow class="bg-gray-200 dark:bg-gray-700 border-t border-b dark:border-gray-600">
										<TableBodyCell colspan={data.statusData.locations.length + 1} class="px-4 py-3 font-bold text-sm uppercase text-gray-600 dark:text-gray-400 tracking-wider">
											{architecture.toUpperCase()} / {cpuType.charAt(0).toUpperCase() + cpuType.slice(1)} CPU
										</TableBodyCell>
									</TableBodyRow>

									<!-- Server Type Rows within Group -->
									{#each serverTypes as serverType}
										<TableBodyRow class="bg-white dark:bg-gray-800 text-sm">
											<!-- Applied flex items-center, adjusted padding px-3 -->
											<TableBodyCell class="font-medium text-gray-900 dark:text-white whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-4 flex items-center">
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
												<div id="{serverType.name}-tooltip" class="inline-block"></div> <!-- Trigger for tooltip -->
											</TableBodyCell>
											{#each data.statusData.locations as location}
												{@const available = isAvailable(location.id, serverType.id)}
												<!-- Removed flex classes, kept padding adjustment px-3 -->
												<TableBodyCell class="text-center px-3 py-4">
													{#if available}
														<CheckCircleSolid class="w-4 h-4 mr-1" />
														<Tooltip triggeredBy="#avail-{location.id}-{serverType.id}">Available in {location.city}</Tooltip>
													{:else}
														<CloseCircleSolid class="w-4 h-4 mr-1" />
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

		<!-- How it Works Section - Centered -->
		<section class="max-w-4xl mx-auto mt-8">
			<Card>
				<Heading tag="h2" class="mb-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">How It Works</Heading>
				<P class="mb-3 font-normal text-gray-700 dark:text-gray-400">
					This page periodically checks the official Hetzner Cloud status information to determine which server types are currently available in each location.
					The availability status is aggregated for each location (e.g., Falkenstein, Helsinki) based on the data provided by Hetzner.
					Your browser then displays this processed status information in the map and table above. The data is typically updated every minute, and the "Last Updated" timestamp indicates the time of the last successful check.
				</P>
			</Card>
		</section>

	{:else}
		<div class="flex justify-center items-center p-10">
			<Spinner size="8" />
			<p class="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading availability data...</p>
		</div>
	{/if}

	<!-- Disclaimer Section -->
	<P class="text-center text-sm text-gray-500 dark:text-gray-500 mt-8 mb-4">
		Disclaimer: This data is fetched periodically from the Hetzner Cloud API. While we strive for accuracy, there might be slight delays. Always verify critical availability directly with Hetzner if needed.
	</P>
</div>