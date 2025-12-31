<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import 'leaflet/dist/leaflet.css';
	import type L from 'leaflet';
	import CloudAlertModal from '$lib/components/CloudAlertModal.svelte';
	import CloudAvailabilityChart from '$lib/components/CloudAvailabilityChart.svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	// import QuickStat from '$lib/components/QuickStat.svelte';
	import { fade as _fade, slide as _slide } from 'svelte/transition';
	import { formatRelativeTime, getAvailabilityRecency } from '$lib/util';
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
		Button,
		Input,
		Select,
		Toggle,
		Card,
		ButtonGroup,
		Label
	} from 'flowbite-svelte';
	import {
		CheckCircleSolid,
		CloseCircleSolid,
		ExclamationCircleSolid,
		InfoCircleSolid,
		BellRingSolid,
		QuestionCircleSolid,
		ChevronDownOutline,
		ChevronRightOutline,
		FilterSolid
	} from 'flowbite-svelte-icons';

	const { data }: { data: PageData } = $props();

	// Cloud alert modal state
	let showCloudAlertModal = $state(false);
	let editingCloudAlert = $state<any>(null);

	// Get initial filter values from URL query parameters
	const params = $page.url.searchParams;
	const initialShowAvailableOnly = params.get('available') === 'true';
	const initialShowRecentlyAvailable = params.get('recent') === 'true';
	const initialArchitectureFilter = params.get('arch') || 'all';
	const initialCpuTypeFilter = params.get('cpu') || 'all';
	const initialCategoryFilter = params.get('category') || 'all';
	const initialSearchQuery = params.get('search') || '';
	
	// Feature flag from URL
	const enableAvailabilityPatterns = params.get('timeline') === 'true';

	const CATEGORY_LABELS: Record<string, string> = {
		regular_purpose: 'Regular Purpose',
		general_purpose: 'General Purpose',
		cost_optimized: 'Cost Optimized',
		storage_optimized: 'Storage Optimized'
	};

	// Filter states
	let showAvailableOnly = $state(initialShowAvailableOnly);
	let showRecentlyAvailable = $state(initialShowRecentlyAvailable);
	let architectureFilter = $state(initialArchitectureFilter);
	let cpuTypeFilter = $state(initialCpuTypeFilter);
	let categoryFilter = $state(initialCategoryFilter);
	let searchQuery = $state(initialSearchQuery);

	// Collapsed groups state
	let collapsedGroups = $state(new Set<string>());
	
	// Availability patterns state
	let showAvailabilityPatterns = $state(false);
	let availabilityViewMode = $state<'location' | 'serverType'>('location');
	let selectedPatternLocationId = $state<number | undefined>();
	let selectedPatternServerTypeId = $state<number | undefined>();
	let patternDateRange = $state<'24h' | '7d' | '30d'>('7d');
	let _patternGranularity = $state<'hour' | 'day' | 'week'>('hour');

	// Update URL when filters change
	$effect(() => {
		if (!browser) return;

		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const params = new URLSearchParams();
		
		// Only add parameters if they differ from defaults
		if (showAvailableOnly) params.set('available', 'true');
		if (showRecentlyAvailable) params.set('recent', 'true');
		if (architectureFilter !== 'all') params.set('arch', architectureFilter);
		if (cpuTypeFilter !== 'all') params.set('cpu', cpuTypeFilter);
		if (categoryFilter !== 'all') params.set('category', categoryFilter);
		if (searchQuery) params.set('search', searchQuery);
		
		// Construct the new URL
		const newUrl = params.toString() ? `?${params.toString()}` : $page.url.pathname;
		
		// Update the URL without triggering navigation
		if ($page.url.search !== (params.toString() ? `?${params.toString()}` : '')) {
			 
			goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true });
		}
	});

	// Server type and location options based on cloud status data
	const serverTypeOptions = $derived(
		data.statusData?.serverTypes?.map((st) => ({
			value: st.id,
			name: `${st.name.toUpperCase()} - ${st.cores} Core${st.cores > 1 ? 's' : ''} / ${st.memory} GB RAM`
		})) || []
	);

	const locationOptions = $derived(
		data.statusData?.locations?.map((loc) => ({
			value: loc.id,
			name: `${loc.city}, ${loc.country} (${loc.name})`
		})) || []
	);

	const categoryOptions = $derived(
		(() => {
			if (!data.statusData?.serverTypes) return [];
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const categories = new Set<string>();
			data.statusData.serverTypes.forEach((st) => {
				if (st.category) {
					categories.add(st.category);
				}
			});
			return Array.from(categories)
				.sort((a, b) => formatCategory(a).localeCompare(formatCategory(b)))
				.map((category) => ({ value: category, name: formatCategory(category) }));
		})()
	);
	
	// Compute date ranges for patterns
	const patternDateRanges = $derived(() => {
		const now = new Date();
		const ranges = {
			'24h': {
				start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
				end: now,
				granularity: 'hour' as const
			},
			'7d': {
				start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
				end: now,
				granularity: 'hour' as const
			},
			'30d': {
				start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
				end: now,
				granularity: 'day' as const
			}
		};
		return ranges[patternDateRange];
	});

	function openCreateAlertModal() {
		editingCloudAlert = null;
		showCloudAlertModal = true;
	}

	// --- Tile Layer Configuration ---
	const lightTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	const lightTileAttribution =
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
	const darkTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
	const darkTileAttribution =
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
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
		category: string;
		storageType: 'local' | 'network';
		deprecated: boolean;
		isDeprecated?: boolean;
	}

	const groupedServerTypes = $derived(
		(() => {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
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
			const sortedGroups = new Map(
				[...groups.entries()].sort(([archA], [archB]) => {
					const indexA = architectureOrder.indexOf(archA);
					const indexB = architectureOrder.indexOf(archB);
					if (indexA === -1 && indexB === -1) return archA.localeCompare(archB); // Fallback for unknown
					if (indexA === -1) return 1; // Unknown last
					if (indexB === -1) return -1; // Unknown last
					return indexA - indexB;
				})
			);

			// Custom sort order for CPU types within each architecture
			const cpuTypeOrder = ['shared', 'dedicated'];
			sortedGroups.forEach((cpuMap) => {
				const sortedCpuMap = new Map(
					[...cpuMap.entries()].sort(([typeA], [typeB]) => {
						const indexA = cpuTypeOrder.indexOf(typeA);
						const indexB = cpuTypeOrder.indexOf(typeB);
						if (indexA === -1 && indexB === -1) return typeA.localeCompare(typeB); // Fallback for unknown
						if (indexA === -1) return 1; // Unknown last
						if (indexB === -1) return -1; // Unknown last
						return indexA - indexB;
					})
				);
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
		})()
	);

	// Calculate summary statistics
	const summaryStats = $derived(
		(() => {
			if (!data.statusData) return null;

			let totalSupported = 0;
			let totalAvailable = 0;
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const locationStats = new Map();
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const serverTypeAvailability = new Map();

			// Calculate stats for non-deprecated server types only
			const activeServerTypes = data.statusData.serverTypes.filter((st) => !st.deprecated);
			const totalActiveTypes = activeServerTypes.length;

			data.statusData.locations.forEach((location) => {
				const supportedTypes = data.statusData!.supported[location.id] || [];
				const _availableTypes = data.statusData!.availability[location.id] || [];

				// Only count active (non-deprecated) types
				const activeSupportedCount = supportedTypes.filter((id) =>
					activeServerTypes.some((st) => st.id === id)
				).length;
				// Only count as available if it's active AND has been seen available at least once
				// We need to check all active supported types, not just those in availableTypes
				const activeAvailableCount = activeSupportedCount > 0
					? supportedTypes.filter((id) =>
							activeServerTypes.some((st) => st.id === id) &&
							getLastSeenAvailable(location.id, id) !== null
					  ).length
					: 0;

				totalSupported += activeSupportedCount;
				totalAvailable += activeAvailableCount;

				locationStats.set(location.id, {
					location,
					supported: activeSupportedCount,
					available: activeAvailableCount,
					percentage:
						activeSupportedCount > 0
							? Math.round((activeAvailableCount / activeSupportedCount) * 100)
							: 0
				});
			});

			// Track availability count per server type
			activeServerTypes.forEach((serverType) => {
				let availableInLocations = 0;
				data.statusData!.locations.forEach((location) => {
					if (isAvailable(location.id, serverType.id)) {
						availableInLocations++;
					}
				});
				serverTypeAvailability.set(serverType.id, {
					serverType,
					locations: availableInLocations
				});
			});

			// Find best and worst locations
			const sortedLocations = Array.from(locationStats.values()).sort(
				(a, b) => b.percentage - a.percentage
			);

			// Find most scarce server type
			const sortedServerTypes = Array.from(serverTypeAvailability.values())
				.filter((st) => st.locations > 0)
				.sort((a, b) => a.locations - b.locations);

			return {
				overallPercentage:
					totalSupported > 0 ? Math.round((totalAvailable / totalSupported) * 100) : 0,
				bestLocation: sortedLocations[0],
				worstLocation: sortedLocations[sortedLocations.length - 1],
				mostScarce: sortedServerTypes[0],
				activeTypes: totalActiveTypes,
				totalTypes: data.statusData.serverTypes.length,
				locationStats,
				serverTypeAvailability
			};
		})()
	);

	// Filter server types based on current filters
	const filteredGroupedServerTypes = $derived(
		(() => {
			if (!groupedServerTypes) return new Map();

			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const filtered = new Map();

			groupedServerTypes.forEach((cpuGroups, architecture) => {
				// Apply architecture filter
				if (architectureFilter !== 'all' && architecture !== architectureFilter) {
					return;
				}

				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const filteredCpuGroups = new Map();

				cpuGroups.forEach((serverTypes, cpuType) => {
					// Apply CPU type filter
					if (cpuTypeFilter !== 'all' && cpuType !== cpuTypeFilter) {
						return;
					}

					// Apply search and availability filters
					const filteredServerTypes = serverTypes.filter((serverType) => {
						// Category filter
						if (categoryFilter !== 'all' && serverType.category !== categoryFilter) {
							return false;
						}

						// Search filter
						if (searchQuery && !serverType.name.toLowerCase().includes(searchQuery.toLowerCase())) {
							return false;
						}

						// Availability filter
						if (showAvailableOnly) {
							let hasAvailability = false;
							data.statusData?.locations.forEach((location) => {
								if (isAvailable(location.id, serverType.id)) {
									hasAvailability = true;
								}
							});
							if (!hasAvailability) return false;
						}

						// Recently available filter
						if (showRecentlyAvailable) {
							let hasRecentAvailability = false;
							data.statusData?.locations.forEach((location) => {
								const lastSeen = getLastSeenAvailable(location.id, serverType.id);
								const recency = getAvailabilityRecency(lastSeen);
								if (recency === 'recent') {
									hasRecentAvailability = true;
								}
							});
							if (!hasRecentAvailability) return false;
						}

						return true;
					});

					if (filteredServerTypes.length > 0) {
						filteredCpuGroups.set(cpuType, filteredServerTypes);
					}
				});

				if (filteredCpuGroups.size > 0) {
					filtered.set(architecture, filteredCpuGroups);
				}
			});

			return filtered;
		})()
	);

	function toggleGroup(key: string) {
		if (collapsedGroups.has(key)) {
			collapsedGroups.delete(key);
		} else {
			collapsedGroups.add(key);
		}
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		collapsedGroups = new Set(collapsedGroups);
	}

	function formatCategory(category: string | null | undefined): string {
		if (!category) return 'Unknown';
		return CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
	}

	function expandAll() {
		collapsedGroups.clear();
		collapsedGroups = new Set();
	}

	function collapseAll() {
		filteredGroupedServerTypes.forEach((cpuGroups, architecture) => {
			cpuGroups.forEach((_: unknown, cpuType: string) => {
				collapsedGroups.add(`${architecture}-${cpuType}`);
			});
		});
		collapsedGroups = new Set(collapsedGroups);
	}

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

	function getLastSeenAvailable(locationId: number, serverTypeId: number): string | null {
		if (!data.statusData?.lastSeenAvailable) return null;
		const key = `${locationId}-${serverTypeId}`;
		return data.statusData.lastSeenAvailable[key] || null;
	}

	function formatLastSeen(locationId: number, serverTypeId: number): string {
		const lastSeen = getLastSeenAvailable(locationId, serverTypeId);
		if (!lastSeen) return 'Never';
		return formatRelativeTime(lastSeen);
	}

	function getLastSeenColor(locationId: number, serverTypeId: number): string {
		const lastSeen = getLastSeenAvailable(locationId, serverTypeId);
		const recency = getAvailabilityRecency(lastSeen);

		switch (recency) {
			case 'recent':
				return 'text-green-600 dark:text-green-400';
			case 'old':
				return 'text-yellow-600 dark:text-yellow-400';
			case 'very-old':
				return 'text-red-600 dark:text-red-400';
			default:
				return 'text-gray-500 dark:text-gray-400';
		}
	}

	function isAvailable(locationId: number, serverTypeId: number): boolean {
		if (!data.statusData?.availability) return false;
		const locationAvailability = data.statusData.availability[locationId];
		return locationAvailability ? locationAvailability.includes(serverTypeId) : false;
	}

	function isSupported(locationId: number, serverTypeId: number): boolean {
		if (!data.statusData?.supported) return false;
		const locationSupported = data.statusData.supported[locationId];
		return locationSupported ? locationSupported.includes(serverTypeId) : false;
	}

	function getServerStatus(
		locationId: number,
		serverTypeId: number
	): 'available' | 'supported' | 'unsupported' {
		const available = isAvailable(locationId, serverTypeId);
		const supported = isSupported(locationId, serverTypeId);

		if (available) return 'available';
		if (supported) return 'supported';
		return 'unsupported';
	}

	type LocationStatus = 'all' | 'some' | 'none';

	function getLocationAvailabilityStatus(locationId: number): LocationStatus {
		if (
			!data.statusData?.availability ||
			!data.statusData?.supported ||
			!data.statusData?.serverTypes ||
			data.statusData.serverTypes.length === 0
		)
			return 'none';

		const locationAvailability = data.statusData.availability[locationId];
		const locationSupported = data.statusData.supported[locationId];

		// Consider only non-deprecated server types for status calculation
		const activeServerTypes = data.statusData.serverTypes.filter((st) => !st.deprecated);

		// From active server types, only consider those that are supported in this location
		const supportedActiveTypes = activeServerTypes.filter(
			(st) => locationSupported && locationSupported.includes(st.id)
		);
		const totalSupportedActiveCount = supportedActiveTypes.length;

		if (totalSupportedActiveCount === 0) return 'none'; // No active supported types to check against

		if (!locationAvailability || locationAvailability.length === 0) {
			return 'none'; // No types available for this location
		}

		// Count how many *supported active* server types are available in this location
		const availableSupportedActiveCount = locationAvailability.filter((id) =>
			supportedActiveTypes.some((st) => st.id === id)
		).length;

		if (availableSupportedActiveCount === totalSupportedActiveCount) {
			return 'all'; // All supported active types available
		} else if (availableSupportedActiveCount > 0) {
			return 'some'; // Some supported active types available
		} else {
			return 'none'; // No supported active types available
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
			minZoom: 2 // Prevent zooming out too far
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
				return L_Instance!.divIcon({
					// Use L_Instance
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
										popupText += '<br>Status: All supported server types available';
										break;
									case 'some':
										icon = iconSomeAvailable;
										popupText += '<br>Status: Some supported server types available';
										break;
									case 'none':
									default:
										icon = iconNoneAvailable;
										popupText += '<br>Status: No supported server types available';
										break;
								}

								const marker = L_Instance!
									.marker(latLng, { icon: icon })
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
							for (let mutation of mutationsList) {
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
	<Heading tag="h1" class="mt-4 mb-4 text-center text-3xl font-bold dark:text-gray-100"
		>Cloud Server Availability</Heading
	>
	<P class="mb-4 text-center text-lg text-gray-600 dark:text-gray-400">
		Track the real-time availability of Hetzner Cloud server types across different locations.
	</P>

	{#if data.error}
		<Badge color="red" class="w-full justify-center p-4 text-lg">
			<strong class="mr-2 font-bold">Error:</strong>
			{data.error}
		</Badge>
	{:else if data.statusData}
		<div class="mb-8 text-center text-sm text-gray-500 dark:text-gray-400">
			<span class="cursor-help" title={formatTimestamp(data.statusData.lastUpdated)}>
				Last Updated: {formatRelativeTime(data.statusData.lastUpdated)}
			</span>
		</div>

		<!-- Wrapper for Map and Table -->
		<div class="mx-4 md:mx-8 lg:mx-auto lg:max-w-7xl">
			<!-- Map Container -->
			<div
				class="w-full overflow-hidden rounded-t-lg border bg-white shadow dark:border-gray-700 dark:bg-gray-800"
			>
				{#if browser}
					<div id="map" class="h-96 w-full"></div>
				{:else}
					<div class="flex h-96 w-full items-center justify-center bg-gray-200 dark:bg-gray-700">
						<p class="text-gray-500 dark:text-gray-400">Map loading...</p>
					</div>
				{/if}
			</div>

			<!-- Filters Section -->
			<div class="border-x border-b bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700">
				<div class="flex flex-wrap items-center gap-4">
					<div class="flex items-center gap-2">
						<FilterSolid class="h-5 w-5 text-gray-500 dark:text-gray-400" />
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
					</div>

					<Toggle bind:checked={showAvailableOnly} class="text-sm">Show Available Only</Toggle>

					<Toggle bind:checked={showRecentlyAvailable} class="text-sm">
						Show Recently Available
					</Toggle>

					<Select bind:value={architectureFilter} class="py-2 text-sm" size="sm">
						<option value="all">All Architectures</option>
						<option value="x86">x86</option>
						<option value="arm">ARM</option>
					</Select>

					<Select bind:value={cpuTypeFilter} class="py-2 text-sm" size="sm">
						<option value="all">All CPU Types</option>
						<option value="shared">Shared</option>
						<option value="dedicated">Dedicated</option>
					</Select>

					<Select bind:value={categoryFilter} class="py-2 text-sm" size="sm">
						<option value="all">All Categories</option>
						{#each categoryOptions as option (option.value)}
							<option value={option.value}>{option.name}</option>
						{/each}
					</Select>

					<Input
						bind:value={searchQuery}
						placeholder="Search server types..."
						class="py-2 text-sm"
						size="sm"
					/>

					<div class="ml-auto flex gap-2">
						<Button size="xs" color="light" on:click={expandAll}>Expand All</Button>
						<Button size="xs" color="light" on:click={collapseAll}>Collapse All</Button>
					</div>
				</div>
			</div>

			<!-- Table Container -->
			<div class="overflow-x-auto">
				<div class="inline-block min-w-full align-middle">
					<div class="overflow-hidden rounded-b-lg border-r border-b border-l dark:border-gray-700">
						<Table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
							<TableHead
								class="bg-gray-50 text-xs text-gray-700 uppercase dark:bg-gray-700 dark:text-gray-400"
							>
								<TableHeadCell
									class="sticky left-0 z-10 bg-gray-50 px-4 pt-4 pb-3 align-middle dark:bg-gray-700"
									>Server Type</TableHeadCell
								>
								{#each data.statusData.locations as location (location.id)}
									<TableHeadCell class="px-4 pt-4 pb-3 text-center align-middle whitespace-nowrap">
										<span class="block md:hidden">{location.city}</span>
										<span class="hidden md:block">{location.city}, {location.country}</span>
										<span class="text-xs font-normal text-gray-500 dark:text-gray-400"
											>({location.name})</span
										>
									</TableHeadCell>
								{/each}
								<TableHeadCell
									class="bg-gray-100 px-4 pt-4 pb-3 text-center align-middle whitespace-nowrap dark:bg-gray-600"
								>
									Available In
								</TableHeadCell>
							</TableHead>
							<TableBody class="divide-y dark:divide-gray-700">
								{#each filteredGroupedServerTypes as [architecture, cpuGroups] (architecture)}
									{#each cpuGroups as [cpuType, serverTypes] (`${architecture}-${cpuType}`)}
										{@const groupKey = `${architecture}-${cpuType}`}
										{@const isCollapsed = collapsedGroups.has(groupKey)}
										<TableBodyRow
											class="cursor-pointer border-t border-b bg-gray-200 transition-colors hover:bg-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
											on:click={() => toggleGroup(groupKey)}
										>
											<TableBodyCell
												colspan={data.statusData.locations.length + 2}
												class="px-4 py-3 text-sm font-bold tracking-wider text-gray-600 uppercase dark:text-gray-400"
											>
												<div class="flex items-center gap-2">
													{#if isCollapsed}
														<ChevronRightOutline class="h-4 w-4" />
													{:else}
														<ChevronDownOutline class="h-4 w-4" />
													{/if}
													{architecture.toUpperCase()} / {cpuType.charAt(0).toUpperCase() +
														cpuType.slice(1)} CPU
													<Badge color="dark" class="ml-2">{serverTypes.length}</Badge>
												</div>
											</TableBodyCell>
										</TableBodyRow>

										{#if !isCollapsed}
											{#each serverTypes as serverType (serverType.id)}
												{@const availableCount =
													summaryStats?.serverTypeAvailability.get(serverType.id)?.locations || 0}
												<TableBodyRow class="bg-white text-sm dark:bg-gray-800">
													<TableBodyCell
														class="sticky left-0 z-10 flex items-center bg-white px-4 py-4 font-medium whitespace-nowrap text-gray-900 dark:bg-gray-800 dark:text-white"
													>
														<div class="flex flex-col">
								<div class="flex items-center space-x-2">
									<span class="text-base font-semibold"
										>{serverType.name.toUpperCase()}</span
									>
									{#if serverType.deprecated}
																	<Badge
																		color="yellow"
																		class="inline-flex items-center px-1.5 py-0.5 text-xs"
																		id="deprecated-{serverType.id}"
																	>
																		<ExclamationCircleSolid class="mr-1 h-3 w-3" /> Deprecated
										</Badge>
										<Tooltip triggeredBy="#deprecated-{serverType.id}" class="z-50"
											>This server type is deprecated.</Tooltip
										>
									{/if}

									{#if serverType.category}
										<Badge
											color="purple"
											class="inline-flex items-center px-1.5 py-0.5 text-xs"
										>
											{formatCategory(serverType.category)}
										</Badge>
									{/if}
								</div>
															<span class="mt-1 text-xs text-gray-500 dark:text-gray-400">
																{serverType.cores} Cores / {serverType.memory} GB RAM / {serverType.disk}
																GB Disk
															</span>
														</div>
														<Tooltip triggeredBy="#{serverType.name}-tooltip" class="z-50"
															>{serverType.description}</Tooltip
														>
														<div id="{serverType.name}-tooltip" class="inline-block"></div>
													</TableBodyCell>
													{#each data.statusData.locations as location (location.id)}
														{@const status = getServerStatus(location.id, serverType.id)}
														{@const lastSeenText = formatLastSeen(location.id, serverType.id)}
														{@const lastSeenColor = getLastSeenColor(location.id, serverType.id)}
														<TableBodyCell
															class="px-2 py-4 text-center {status === 'available'
																? 'bg-green-50 dark:bg-green-900/20'
																: status === 'supported'
																	? 'bg-red-50 dark:bg-red-900/20'
																	: 'bg-gray-50 dark:bg-gray-900/20'}"
														>
															<div class="flex flex-col items-center gap-1">
																<div>
																	{#if status === 'available'}
																		<CheckCircleSolid
																			size="lg"
																			color="green"
																			class="inline-block h-5 w-5"
																			id="avail-{location.id}-{serverType.id}"
																		/>
																		<Tooltip
																			triggeredBy="#avail-{location.id}-{serverType.id}"
																			class="z-50">Available in {location.city}</Tooltip
																		>
																	{:else if status === 'supported'}
																		<CloseCircleSolid
																			size="lg"
																			color="red"
																			class="inline-block h-5 w-5"
																			id="notavail-{location.id}-{serverType.id}"
																		/>
																		<Tooltip
																			triggeredBy="#notavail-{location.id}-{serverType.id}"
																			class="z-50"
																			>Supported but currently unavailable in {location.city}</Tooltip
																		>
																	{:else}
																		<QuestionCircleSolid
																			size="lg"
																			color="gray"
																			class="inline-block h-5 w-5"
																			id="unsupported-{location.id}-{serverType.id}"
																		/>
																		<Tooltip
																			triggeredBy="#unsupported-{location.id}-{serverType.id}"
																			class="z-50">Not supported in {location.city}</Tooltip
																		>
																	{/if}
																</div>
																<div
																	class="text-xs {lastSeenColor}"
																	title={getLastSeenAvailable(location.id, serverType.id)
																		? formatTimestamp(
																				getLastSeenAvailable(location.id, serverType.id)
																			)
																		: 'Never seen available'}
																>
																	{lastSeenText}
																</div>
															</div>
														</TableBodyCell>
													{/each}
													<TableBodyCell
														class="bg-gray-100 px-4 py-4 text-center font-medium dark:bg-gray-600"
													>
														{availableCount} / {data.statusData.locations.length}
													</TableBodyCell>
												</TableBodyRow>
											{/each}
										{/if}
									{/each}
								{/each}

								<!-- Location totals row -->
								{#if summaryStats}
									<TableBodyRow
										class="border-t-2 border-gray-300 bg-gray-100 dark:border-gray-500 dark:bg-gray-600"
									>
										<TableBodyCell
											class="sticky left-0 z-10 bg-gray-100 px-4 py-3 text-sm font-bold uppercase dark:bg-gray-600"
										>
											Availability %
										</TableBodyCell>
										{#each data.statusData.locations as location (location.id)}
											{@const stats = summaryStats.locationStats.get(location.id)}
											<TableBodyCell class="px-4 py-3 text-center font-bold">
												{stats?.percentage || 0}%
											</TableBodyCell>
										{/each}
										<TableBodyCell
											class="bg-gray-200 px-4 py-3 text-center font-bold dark:bg-gray-700"
										>
											-
										</TableBodyCell>
									</TableBodyRow>
								{/if}
							</TableBody>
						</Table>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex items-center justify-center p-10">
			<Spinner size="8" />
			<p class="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading availability data...</p>
		</div>
	{/if}

	<!-- Availability Patterns Section -->
	{#if data.statusData && !data.error && enableAvailabilityPatterns}
		<section class="mt-8 mb-8">
			<div class="mx-4 md:mx-8 lg:mx-auto lg:max-w-7xl">
				<Card class="!p-0">
					<div class="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700">
						<div class="flex flex-wrap items-center justify-between gap-4">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
								Availability Patterns
							</h3>
							<Button
								size="sm"
								color={showAvailabilityPatterns ? 'primary' : 'light'}
								on:click={() => showAvailabilityPatterns = !showAvailabilityPatterns}
							>
								{showAvailabilityPatterns ? 'Hide' : 'Show'} Timeline
							</Button>
						</div>
					</div>
					
					{#if showAvailabilityPatterns}
						<div class="p-4">
							<!-- Controls -->
							<div class="mb-4 flex flex-wrap gap-4">
								<!-- View Mode Toggle -->
								<div class="flex items-center gap-2">
									<Label>View by:</Label>
									<ButtonGroup>
										<Button
											size="xs"
											color={availabilityViewMode === 'location' ? 'primary' : 'light'}
											on:click={() => {
												availabilityViewMode = 'location';
												selectedPatternServerTypeId = undefined;
											}}
										>
											Location
										</Button>
										<Button
											size="xs"
											color={availabilityViewMode === 'serverType' ? 'primary' : 'light'}
											on:click={() => {
												availabilityViewMode = 'serverType';
												selectedPatternLocationId = undefined;
											}}
										>
											Server Type
										</Button>
									</ButtonGroup>
								</div>
								
								<!-- Location/Server Type Selector -->
								{#if availabilityViewMode === 'location'}
									<Select
										bind:value={selectedPatternLocationId}
										size="sm"
										class="w-64"
										placeholder="Select a location"
									>
										<option value={undefined} disabled>Select a location</option>
										{#each locationOptions as location (location.value)}
											<option value={location.value}>{location.name}</option>
										{/each}
									</Select>
								{:else}
									<Select
										bind:value={selectedPatternServerTypeId}
										size="sm"
										class="w-64"
										placeholder="Select a server type"
									>
										<option value={undefined} disabled>Select a server type</option>
										{#each serverTypeOptions as serverType (serverType.value)}
											<option value={serverType.value}>{serverType.name}</option>
										{/each}
									</Select>
								{/if}
								
								<!-- Date Range Selector -->
								<div class="flex items-center gap-2">
									<Label>Time range:</Label>
									<ButtonGroup>
										<Button
											size="xs"
											color={patternDateRange === '24h' ? 'primary' : 'light'}
											on:click={() => patternDateRange = '24h'}
										>
											24 Hours
										</Button>
										<Button
											size="xs"
											color={patternDateRange === '7d' ? 'primary' : 'light'}
											on:click={() => patternDateRange = '7d'}
										>
											7 Days
										</Button>
										<Button
											size="xs"
											color={patternDateRange === '30d' ? 'primary' : 'light'}
											on:click={() => patternDateRange = '30d'}
										>
											30 Days
										</Button>
									</ButtonGroup>
								</div>
							</div>
							
							<!-- Chart -->
							{#if (availabilityViewMode === 'location' && selectedPatternLocationId) || (availabilityViewMode === 'serverType' && selectedPatternServerTypeId)}
								<CloudAvailabilityChart
									startDate={patternDateRanges().start}
									endDate={patternDateRanges().end}
									granularity={patternDateRanges().granularity}
									viewMode={availabilityViewMode}
									selectedLocationId={selectedPatternLocationId}
									selectedServerTypeId={selectedPatternServerTypeId}
									serverTypes={data.statusData.serverTypes}
									locations={data.statusData.locations}
								/>
							{:else}
								<div class="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
									<p>
										{#if availabilityViewMode === 'location'}
											Select a location to view availability patterns
										{:else}
											Select a server type to view availability patterns
										{/if}
									</p>
								</div>
							{/if}
						</div>
					{/if}
				</Card>
			</div>
		</section>
	{/if}

	<section class="mt-12 mb-8">
		<div class="mx-4 md:mx-8 lg:mx-auto lg:max-w-7xl">
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="text-center">
					<h3 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
						Stay Ahead of Availability Changes
					</h3>
					<p class="mx-auto mb-4 max-w-2xl text-gray-600 dark:text-gray-400">
						Get instant notifications when your desired server types become available or unavailable
						in specific locations. Set up smart alerts to never miss the perfect server
						configuration for your needs.
					</p>
					<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
						{#if data.user}
							<Button on:click={openCreateAlertModal} color="primary" class="px-6 py-2 font-medium">
								<BellRingSolid class="mr-2 h-4 w-4" />
								Create Availability Alert
							</Button>
							<span class="text-sm text-gray-500 dark:text-gray-400">
								Create alerts instantly or <a
									href="/alerts?tab=cloud-alerts"
									class="underline hover:text-orange-500">manage existing ones</a
								>
							</span>
						{:else}
							<Button href="/auth/login" color="primary" class="px-6 py-2 font-medium">
								<InfoCircleSolid class="mr-2 h-4 w-4" />
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
	on:close={() => {
		showCloudAlertModal = false;
	}}
/>
