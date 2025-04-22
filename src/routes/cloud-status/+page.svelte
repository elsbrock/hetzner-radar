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
		Spinner // For loading state
	} from 'flowbite-svelte';
	import { CheckCircleSolid, CloseCircleSolid, MapPinSolid } from 'flowbite-svelte-icons'; // Icons

	export let data: PageData;

	// Type guard for enhanced ServerTypeInfo (assuming +page.server.ts passes it correctly)
	// This helps TypeScript understand the new fields exist within the loop.
	// In a real app, ensure +page.server.ts fetches/returns the full structure.
	interface EnhancedServerTypeInfo {
		id: number;
		name: string;
		description: string;
		cores: number;
		memory: number;
		disk: number;
		cpu_type: 'shared' | 'dedicated';
	}

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
						map = L.map('map').setView([51.1657, 10.4515], 5); // Centered roughly on Germany

						L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
							attribution:
								'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
						}).addTo(map);

						data.statusData.locations.forEach((location) => {
							if (location.latitude && location.longitude) {
								const marker = L.marker([location.latitude, location.longitude])
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
	<h1 class="text-3xl font-bold mb-5 text-center">Hetzner Cloud Server Availability</h1>

	{#if data.error}
		<Badge color="red" class="p-4 text-lg w-full justify-center">
			<strong class="font-bold mr-2">Error:</strong>
			{data.error}
		</Badge>
	{:else if data.statusData}
		<div class="mb-4 text-center text-gray-500 dark:text-gray-400">
			Last Updated: {formatTimestamp(data.statusData.lastUpdated)}
		</div>

		<!-- Leaflet Map Container -->
		<div class="mb-6 rounded-lg overflow-hidden shadow-lg border dark:border-gray-700">
			{#if browser}
				<div id="map" class="h-96 w-full"></div>
			{:else}
				<div class="h-96 w-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
					<p class="text-gray-500 dark:text-gray-400">Map loading...</p>
				</div>
			{/if}
		</div>


		<div class="overflow-x-auto relative shadow-md sm:rounded-lg">
			<Table hoverable={true}>
				<TableHead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
					<TableHeadCell class="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700">Server Type</TableHeadCell>
					{#each data.statusData.locations as location}
						<TableHeadCell class="text-center whitespace-nowrap">
							<div class="flex flex-col items-center">
								<span>{location.city}, {location.country}</span>
								<span class="text-xs text-gray-500 dark:text-gray-400">({location.name})</span>
							</div>
							<Tooltip triggeredBy="#{location.name}-tooltip">
								{location.city}, {location.country} ({location.name}) - Lat: {location.latitude}, Lng: {location.longitude}
							</Tooltip>
							<div id="{location.name}-tooltip" class="inline-block"></div> <!-- Trigger for tooltip -->
						</TableHeadCell>
					{/each}
				</TableHead>
				<TableBody class="divide-y dark:divide-gray-700">
					{#each data.statusData.serverTypes as serverTypeAny}
						{@const serverType = serverTypeAny as EnhancedServerTypeInfo} <!-- Type assertion -->
						<TableBodyRow class="bg-white dark:bg-gray-800">
							<TableBodyCell class="font-medium text-gray-900 dark:text-white whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800">
								<div class="flex flex-col">
									<span class="font-semibold">{serverType.name}</span>
									<span class="text-xs text-gray-500 dark:text-gray-400">
										{serverType.cores} Cores / {serverType.memory} GB RAM / {serverType.disk} GB Disk ({serverType.cpu_type})
									</span>
								</div>
								<Tooltip triggeredBy="#{serverType.name}-tooltip">{serverType.description}</Tooltip>
								<div id="{serverType.name}-tooltip" class="inline-block"></div> <!-- Trigger for tooltip -->
							</TableBodyCell>
							{#each data.statusData.locations as location}
								{@const available = isAvailable(location.id, serverType.id)}
								<TableBodyCell class="text-center">
									{#if available}
										<Badge color="green" class="inline-flex items-center" id="avail-{location.id}-{serverType.id}">
											<CheckCircleSolid class="w-3 h-3 mr-1" /> Available
										</Badge>
										<Tooltip triggeredBy="#avail-{location.id}-{serverType.id}">Available in {location.city}</Tooltip>
									{:else}
										<Badge color="red" class="inline-flex items-center" id="notavail-{location.id}-{serverType.id}">
											<CloseCircleSolid class="w-3 h-3 mr-1" /> Unavailable
										</Badge>
										<Tooltip triggeredBy="#notavail-{location.id}-{serverType.id}">Not available in {location.city}</Tooltip>
									{/if}
								</TableBodyCell>
							{/each}
						</TableBodyRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{:else}
		<div class="flex justify-center items-center p-10">
			<Spinner size="8" />
			<p class="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading availability data...</p>
		</div>
	{/if}
</div>