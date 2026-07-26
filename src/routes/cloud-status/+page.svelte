<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import 'leaflet/dist/leaflet.css';
	import type L from 'leaflet';
	import CloudAlertModal from '$lib/components/CloudAlertModal.svelte';
	import type { CloudAvailabilityAlert } from '$lib/api/backend/cloud-alerts';
	import CloudAvailabilityChart from '$lib/components/CloudAvailabilityChart.svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	// import QuickStat from '$lib/components/QuickStat.svelte';
	import { formatRelativeTime, getAvailabilityRecency, jsonLdSafe } from '$lib/util';
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
		Button,
		Input,
		Select,
		Toggle,
		ButtonGroup
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
		CloseOutline,
		FilterSolid
	} from 'flowbite-svelte-icons';
	import PageHero from '$lib/components/PageHero.svelte';
	import PageInsights from '$lib/components/PageInsights.svelte';
	import { SUPPORTED_VS_AVAILABLE_NOTE } from './insights';

	const { data }: { data: PageData } = $props();

	// Cloud alert modal state
	let showCloudAlertModal = $state(false);
	let editingCloudAlert = $state<CloudAvailabilityAlert | null>(null);

	// Get initial filter values from URL query parameters
	const params = $page.url.searchParams;
	const initialShowAvailableOnly = params.get('available') === 'true';
	const initialShowRecentlyAvailable = params.get('recent') === 'true';
	const initialArchitectureFilter = params.get('arch') || 'all';
	const initialCpuTypeFilter = params.get('cpu') || 'all';
	const initialCategoryFilter = params.get('category') || 'all';
	const initialSearchQuery = params.get('search') || '';

	// Which slice of the grid the historic heatmap below the table is showing.
	// Set by clicking a server-type row, a location column, or a single cell.
	type HistScope =
		| { kind: 'location'; locationId: number }
		| { kind: 'serverType'; serverTypeId: number }
		| { kind: 'pair'; serverTypeId: number; locationId: number };

	// `hist` is serialised as `st:<id>`, `loc:<id>`, or `st:<id>,loc:<id>`.
	function parseHistScope(raw: string | null): HistScope | null {
		if (!raw) return null;
		let serverTypeId: number | undefined;
		let locationId: number | undefined;
		for (const part of raw.split(',')) {
			const [key, value] = part.split(':');
			const id = Number(value);
			if (!Number.isFinite(id)) continue;
			if (key === 'st') serverTypeId = id;
			if (key === 'loc') locationId = id;
		}
		if (serverTypeId !== undefined && locationId !== undefined) {
			return { kind: 'pair', serverTypeId, locationId };
		}
		if (serverTypeId !== undefined) return { kind: 'serverType', serverTypeId };
		if (locationId !== undefined) return { kind: 'location', locationId };
		return null;
	}

	function serialiseHistScope(scope: HistScope): string {
		switch (scope.kind) {
			case 'location':
				return `loc:${scope.locationId}`;
			case 'serverType':
				return `st:${scope.serverTypeId}`;
			case 'pair':
				return `st:${scope.serverTypeId},loc:${scope.locationId}`;
		}
	}

	const initialHistScope = parseHistScope(params.get('hist'));
	const rawInitialRange = params.get('range');
	const initialRange: '24h' | '7d' | '30d' =
		rawInitialRange === '24h' || rawInitialRange === '30d' ? rawInitialRange : '7d';

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

	// Historic heatmap state
	let histScope = $state<HistScope | null>(initialHistScope);
	let patternDateRange = $state<'24h' | '7d' | '30d'>(initialRange);
	let histPanelElement = $state<HTMLElement | null>(null);

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
		if (histScope) params.set('hist', serialiseHistScope(histScope));
		if (histScope && patternDateRange !== '7d') params.set('range', patternDateRange);
		if (histScope && effectiveHistOffset > 0) params.set('off', String(effectiveHistOffset));

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
	
	const RANGE_SPANS = {
		'24h': { ms: 24 * 60 * 60 * 1000, granularity: 'hour' as const },
		'7d': { ms: 7 * 24 * 60 * 60 * 1000, granularity: 'hour' as const },
		'30d': { ms: 30 * 24 * 60 * 60 * 1000, granularity: 'day' as const }
	};

	// Analytics Engine only retains ~30 days of transitions, so stepping further
	// back than that would just render empty windows.
	const RETAINED_MS = 30 * 24 * 60 * 60 * 1000;

	// How many whole windows back from now we are currently showing. 0 = live.
	let histOffset = $state(Math.max(0, Number(params.get('off')) || 0));

	const maxHistOffset = $derived(
		Math.max(0, Math.floor(RETAINED_MS / RANGE_SPANS[patternDateRange].ms) - 1)
	);

	// Clamped here rather than on assignment, so a hand-edited `off=` in the URL
	// (or one left over from a wider range) can't point outside retained history.
	const effectiveHistOffset = $derived(Math.min(Math.max(0, histOffset), maxHistOffset));

	// One object per (range, offset) change — not a function, so the three template
	// reads can't each land on a slightly different `now`.
	const patternRange = $derived.by(() => {
		const { ms, granularity } = RANGE_SPANS[patternDateRange];
		const end = new Date(Date.now() - effectiveHistOffset * ms);
		return { start: new Date(end.getTime() - ms), end, granularity };
	});

	function stepHistWindow(direction: -1 | 1) {
		// -1 goes further into the past, so it increases the offset.
		histOffset = Math.min(maxHistOffset, Math.max(0, histOffset - direction));
	}

	// Changing the window size or the selection invalidates the current offset.
	function selectRange(range: '24h' | '7d' | '30d') {
		patternDateRange = range;
		histOffset = 0;
	}

	// The grid axes the current historic scope touches: used both to pass ids down
	// to the chart and to highlight the active row/column/cell in the table.
	const histServerTypeId = $derived(
		histScope && histScope.kind !== 'location' ? histScope.serverTypeId : undefined
	);
	const histLocationId = $derived(
		histScope && histScope.kind !== 'serverType' ? histScope.locationId : undefined
	);

	const histScopeLabel = $derived.by(() => {
		if (!histScope) return '';
		const st = data.statusData?.serverTypes.find((s) => s.id === histServerTypeId);
		const loc = data.statusData?.locations.find((l) => l.id === histLocationId);
		const stLabel = st ? st.name.toUpperCase() : null;
		const locLabel = loc ? `${loc.city}, ${loc.country}` : null;
		switch (histScope.kind) {
			case 'location':
				return locLabel ?? 'Location';
			case 'serverType':
				return stLabel ?? 'Server type';
			case 'pair':
				return [stLabel, locLabel].filter(Boolean).join(' in ');
		}
	});

	// Clicking the active target again turns the historic view back off.
	function setHistScope(next: HistScope) {
		const same =
			histScope?.kind === next.kind &&
			histServerTypeId === (next.kind === 'location' ? undefined : next.serverTypeId) &&
			histLocationId === (next.kind === 'serverType' ? undefined : next.locationId);
		histScope = same ? null : next;
		histOffset = 0;
		if (histScope) {
			// No-op when the panel is already on screen, which it usually is since it
			// sits directly under the table.
			requestAnimationFrame(() =>
				histPanelElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
			);
		}
	}

	function highlightClass(locationId?: number, serverTypeId?: number): string {
		if (!histScope) return '';
		const rowMatch = serverTypeId === undefined || histServerTypeId === serverTypeId;
		const colMatch = locationId === undefined || histLocationId === locationId;
		// A cell only lights up when both axes match; a header when its own axis does.
		if (!rowMatch || !colMatch) return '';
		if (histScope.kind === 'pair' && locationId !== undefined && serverTypeId !== undefined) {
			return 'ring-2 ring-inset ring-orange-500 dark:ring-orange-400';
		}
		const ownAxisSelected =
			(serverTypeId !== undefined && histServerTypeId === serverTypeId) ||
			(locationId !== undefined && histLocationId === locationId);
		return ownAxisSelected ? 'ring-1 ring-inset ring-orange-400/60' : '';
	}

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
				const availableTypes = data.statusData!.availability[location.id] || [];

				// Only count active (non-deprecated) types
				const activeSupportedCount = supportedTypes.filter((id) =>
					activeServerTypes.some((st) => st.id === id)
				).length;
				// Only count as available if it's active AND has been seen available at least once
				// Check only the types that are marked as available by the API
				const activeAvailableCount = availableTypes.filter(
					(id: number) =>
						activeServerTypes.some((st) => st.id === id) &&
						getLastSeenAvailable(location.id, id) !== null
				).length;

				totalAvailable += activeAvailableCount;

				locationStats.set(location.id, {
					location,
					supported: activeSupportedCount,
					available: activeAvailableCount,
					percentage:
						totalActiveTypes > 0
							? Math.round((activeAvailableCount / totalActiveTypes) * 100)
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
					totalActiveTypes > 0 && data.statusData.locations.length > 0
						? Math.round((totalAvailable / (totalActiveTypes * data.statusData.locations.length)) * 100)
						: 0,
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
			minZoom: 2, // Prevent zooming out too far
			referrerPolicy: 'strict-origin-when-cross-origin' // Required by OSM tile usage policy
		}).addTo(map);
	}

	onMount(async () => {
		if (browser) {
			L_Instance = await import('leaflet'); // Store L instance

			// Leaflet's private _getIconUrl isn't in its public type definitions
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

	// JSON-LD: BreadcrumbList + Dataset describing what the page actually shows.
	const locationCount = $derived(data.statusData?.locations?.length ?? 0);
	const serverTypeCount = $derived(data.statusData?.serverTypes?.length ?? 0);

	const breadcrumbJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{
				'@type': 'ListItem',
				position: 1,
				name: 'Home',
				item: 'https://radar.iodev.org/'
			},
			{
				'@type': 'ListItem',
				position: 2,
				name: 'Cloud Status',
				item: 'https://radar.iodev.org/cloud-status'
			}
		]
	};

	const datasetJsonLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'Dataset',
		name: 'Hetzner Cloud Server Availability',
		description:
			'Live availability of Hetzner Cloud server types across every Hetzner Cloud location, polled directly from the public Hetzner Cloud API once per minute. Tracks which server types are supported per location, which are currently in stock, and how availability changes over the past 24 hours, 7 days, and 30 days.',
		url: 'https://radar.iodev.org/cloud-status',
		isAccessibleForFree: true,
		keywords: [
			'Hetzner Cloud',
			'cloud server availability',
			'cloud server stock',
			'Hetzner availability',
			'cloud datacenter status'
		],
		creator: {
			'@type': 'Person',
			name: 'Simon Elsbrock',
			url: 'https://radar.iodev.org/about'
		},
		temporalCoverage: 'P30D',
		variableMeasured: [
			{
				'@type': 'PropertyValue',
				name: 'Availability',
				description:
					'Whether a given server type is currently in stock at a given Hetzner Cloud location.'
			},
			{
				'@type': 'PropertyValue',
				name: 'Support',
				description:
					'Whether a given server type is offered at a given location, regardless of current stock.'
			},
			{
				'@type': 'PropertyValue',
				name: 'Last seen available',
				description:
					'Timestamp of the most recent observation showing a given location/server-type as in stock.'
			},
			{
				'@type': 'PropertyValue',
				name: 'Availability pattern over time',
				description:
					'Hourly or daily availability history per location or per server type over 24h, 7d, or 30d windows.'
			}
		]
	});
</script>

<svelte:head>
	<title>Hetzner Cloud Availability & Stock Tracker — Server Radar</title>
	<meta
		name="description"
		content="Live Hetzner Cloud server availability across every location. See which CPX, CCX, CAX and other types are in stock right now, plus 30-day patterns."
	/>
	<link rel="canonical" href="https://radar.iodev.org/cloud-status" />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://radar.iodev.org/cloud-status" />
	<meta property="og:title" content="Hetzner Cloud Availability & Stock Tracker — Server Radar" />
	<meta
		property="og:description"
		content="Live Hetzner Cloud server availability across every location. See which CPX, CCX, CAX and other types are in stock right now, plus 30-day patterns."
	/>
	<meta property="og:image" content="https://radar.iodev.org/og-image.webp" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Hetzner Cloud Availability & Stock Tracker — Server Radar" />
	<meta
		name="twitter:description"
		content="Live Hetzner Cloud server availability across every location. See which CPX, CCX, CAX and other types are in stock right now, plus 30-day patterns."
	/>
	<meta name="twitter:image" content="https://radar.iodev.org/og-image.webp" />

	{@html `<script type="application/ld+json">${jsonLdSafe(breadcrumbJsonLd)}<` + `/script>`}
	{@html `<script type="application/ld+json">${jsonLdSafe(datasetJsonLd)}<` + `/script>`}
</svelte:head>

{#snippet statusCell(
	status: 'available' | 'supported' | 'unsupported',
	lastSeenText: string,
	lastSeenColor: string,
	city: string,
	lastSeenTitle: string
)}
	{#if status === 'available'}
		<CheckCircleSolid size="lg" color="green" class="h-5 w-5" aria-label="Available in {city}" />
	{:else if status === 'supported'}
		<CloseCircleSolid size="lg" color="red" class="h-5 w-5" aria-label="Unavailable in {city}" />
	{:else}
		<QuestionCircleSolid size="lg" color="gray" class="h-5 w-5" aria-label="Not supported in {city}" />
	{/if}
	<span class="text-xs {lastSeenColor}" title={lastSeenTitle}>{lastSeenText}</span>
{/snippet}

<PageHero
	title="Hetzner Cloud availability"
	tagline="Live stock for every Hetzner Cloud server type in every location, refreshed once a minute. Click any type, location or cell for its availability history."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Cloud Status' }
	]}
>
	{#snippet meta()}
		<span>
			Tracking <strong class="text-gray-700 dark:text-gray-200">{serverTypeCount}</strong> server
			types ×
			<strong class="text-gray-700 dark:text-gray-200">{locationCount}</strong> locations
		</span>
		<span>·</span>
		<a
			class="text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
			href="/configurations"
		>
			Shopping for raw hardware?
		</a>
	{/snippet}
</PageHero>

<div class="w-full px-4 py-10 sm:px-6 dark:text-gray-100">

	{#if data.error}
		<Badge color="red" class="w-full justify-center p-4 text-lg">
			<strong class="mr-2 font-bold">Error:</strong>
			{data.error}
		</Badge>
	{:else if data.statusData}
		<div class="mx-auto mb-8 max-w-6xl text-center text-sm text-gray-500 dark:text-gray-400">
			<span class="cursor-help" title={formatTimestamp(data.statusData.lastUpdated)}>
				Last Updated: {formatRelativeTime(data.statusData.lastUpdated)}
			</span>
		</div>

		<!-- Frameless: map, filters, grid and history sit straight on the page,
		     separated by hairlines rather than boxed in a card. -->
		<div class="mx-auto w-full max-w-[110rem]">
			<!-- Map Container -->
			<div class="w-full overflow-hidden rounded-lg">
				{#if browser}
					<div id="map" class="h-80 w-full"></div>
				{:else}
					<div class="flex h-80 w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
						<p class="text-gray-500 dark:text-gray-400">Map loading...</p>
					</div>
				{/if}
			</div>

			<!-- Filters Section -->
			<div class="mt-6 border-b border-gray-200 pb-3 dark:border-gray-700">
				<div class="flex flex-wrap items-center gap-x-4 gap-y-3 xl:flex-nowrap">
					<FilterSolid class="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />

					<Toggle bind:checked={showAvailableOnly} class="shrink-0 text-sm">Available only</Toggle>

					<Toggle bind:checked={showRecentlyAvailable} class="shrink-0 text-sm">
						Recently available
					</Toggle>

					<Select
						bind:value={architectureFilter}
						class="w-auto shrink-0 py-1.5 text-sm"
						size="sm"
					>
						<option value="all">All architectures</option>
						<option value="x86">x86</option>
						<option value="arm">ARM</option>
					</Select>

					<Select bind:value={cpuTypeFilter} class="w-auto shrink-0 py-1.5 text-sm" size="sm">
						<option value="all">All CPU types</option>
						<option value="shared">Shared</option>
						<option value="dedicated">Dedicated</option>
					</Select>

					<Select bind:value={categoryFilter} class="w-auto shrink-0 py-1.5 text-sm" size="sm">
						<option value="all">All categories</option>
						{#each categoryOptions as option (option.value)}
							<option value={option.value}>{option.name}</option>
						{/each}
					</Select>

					<Input
						bind:value={searchQuery}
						placeholder="Search server types..."
						class="min-w-36 py-1.5 text-sm"
						size="sm"
					/>

					<div class="ml-auto flex gap-2">
						<Button size="xs" color="light" onclick={expandAll}>Expand All</Button>
						<Button size="xs" color="light" onclick={collapseAll}>Collapse All</Button>
					</div>
				</div>
			</div>

			<!-- Table Container -->
			<div class="w-full overflow-x-auto">
				<Table class="w-full min-w-full divide-y divide-gray-200 dark:divide-gray-600">
							<TableHead
								class="bg-gray-50 text-xs text-gray-700 uppercase dark:bg-gray-700 dark:text-gray-400"
							>
								<TableHeadCell
									class="sticky left-0 z-10 bg-gray-50 px-4 pt-4 pb-3 align-middle dark:bg-gray-700"
									>Server Type</TableHeadCell
								>
								{#each data.statusData.locations as location (location.id)}
									<TableHeadCell
										class="px-1 pt-2 pb-1 text-center align-middle whitespace-nowrap {highlightClass(
											location.id,
											undefined
										)}"
									>
										<button
											type="button"
											class="w-full cursor-pointer rounded-sm px-3 py-2 uppercase transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 {histLocationId ===
											location.id
												? 'text-orange-600 dark:text-orange-400'
												: ''}"
											title="Show availability history for {location.city}"
											onclick={() => setHistScope({ kind: 'location', locationId: location.id })}
										>
											<span class="block md:hidden">{location.city}</span>
											<span class="hidden md:block">{location.city}, {location.country}</span>
											<span class="text-xs font-normal text-gray-500 dark:text-gray-400"
												>({location.name})</span
											>
										</button>
									</TableHeadCell>
								{/each}
								<TableHeadCell
									class="bg-gray-100 px-4 pt-4 pb-3 text-center align-middle whitespace-nowrap dark:bg-gray-700"
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
											onclick={() => toggleGroup(groupKey)}
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
													<Badge color="gray" class="ml-2">{serverTypes.length}</Badge>
												</div>
											</TableBodyCell>
										</TableBodyRow>

										{#if !isCollapsed}
											{#each serverTypes as serverType (serverType.id)}
												{@const availableCount =
													summaryStats?.serverTypeAvailability.get(serverType.id)?.locations || 0}
												<TableBodyRow class="bg-white text-sm dark:bg-gray-800">
													<TableBodyCell
														class="sticky left-0 z-10 flex items-center bg-white px-2 py-2 font-medium whitespace-nowrap text-gray-900 dark:bg-gray-800 dark:text-white {highlightClass(
															undefined,
															serverType.id
														)}"
													>
														<button
															type="button"
															class="flex w-full cursor-pointer flex-col rounded-sm px-2 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
															title="Show availability history for {serverType.name.toUpperCase()} across all locations"
															onclick={() =>
																setHistScope({ kind: 'serverType', serverTypeId: serverType.id })}
														>
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
															<span
																class="mt-1 text-xs font-normal text-gray-500 dark:text-gray-400"
															>
																{serverType.cores} Cores / {serverType.memory} GB RAM / {serverType.disk}
																GB Disk
															</span>
														</button>
														<Tooltip triggeredBy="#{serverType.name}-tooltip" class="z-50"
															>{serverType.description}</Tooltip
														>
														<div id="{serverType.name}-tooltip" class="inline-block"></div>
													</TableBodyCell>
													{#each data.statusData.locations as location (location.id)}
														{@const status = getServerStatus(location.id, serverType.id)}
														{@const lastSeenText = formatLastSeen(location.id, serverType.id)}
														{@const lastSeenColor = getLastSeenColor(location.id, serverType.id)}
														{@const clickable = status !== 'unsupported'}
														{@const lastSeenTitle = getLastSeenAvailable(location.id, serverType.id)
															? formatTimestamp(getLastSeenAvailable(location.id, serverType.id))
															: 'Never seen available'}
														{@const cellId = `cell-${location.id}-${serverType.id}`}
														{@const cellTip =
															status === 'available'
																? `Available in ${location.city}`
																: status === 'supported'
																	? `Supported but currently unavailable in ${location.city}`
																	: `Not supported in ${location.city}`}
														<TableBodyCell
															class="p-1 text-center {status === 'available'
																? 'bg-green-50 dark:bg-green-900/20'
																: status === 'supported'
																	? 'bg-red-50 dark:bg-red-900/20'
																	: 'bg-gray-50 dark:bg-gray-900/20'} {highlightClass(location.id, serverType.id)}"
														>
															{#if clickable}
																<button
																	type="button"
																	id={cellId}
																	class="flex w-full cursor-pointer flex-col items-center gap-1 rounded-sm px-1 py-3 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
																	onclick={() =>
																		setHistScope({
																			kind: 'pair',
																			serverTypeId: serverType.id,
																			locationId: location.id
																		})}
																>
																	{@render statusCell(status, lastSeenText, lastSeenColor, location.city, lastSeenTitle)}
																</button>
															{:else}
																<div id={cellId} class="flex flex-col items-center gap-1 px-1 py-3">
																	{@render statusCell(status, lastSeenText, lastSeenColor, location.city, lastSeenTitle)}
																</div>
															{/if}
															<Tooltip triggeredBy="#{cellId}" class="z-50">
																{cellTip}{clickable ? ' · click for history' : ''}
															</Tooltip>
														</TableBodyCell>
													{/each}
													<TableBodyCell
														class="bg-gray-100 px-4 py-4 text-center font-medium dark:bg-gray-700"
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
										class="border-t-2 border-gray-300 bg-gray-100 dark:border-gray-500 dark:bg-gray-700"
									>
										<TableBodyCell
											class="sticky left-0 z-10 bg-gray-100 px-4 py-3 text-sm font-bold uppercase dark:bg-gray-700"
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

			<!-- Historic view: scope comes from clicking the grid above -->
			{#if histScope}
				<div bind:this={histPanelElement} class="bg-white p-4 dark:bg-gray-800">
					<div class="mb-3 flex flex-wrap items-start justify-between gap-3">
						<div>
							<h3 class="text-sm font-semibold text-gray-900 dark:text-white">
								{histScopeLabel} · availability history
							</h3>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{#if histScope.kind === 'location'}
									One row per server type offered here.
								{:else if histScope.kind === 'serverType'}
									One row per location offering this type.
								{:else}
									Shaded by how much of each interval it was in stock.
								{/if}
							</p>
						</div>
						<div class="flex items-center gap-2">
							<ButtonGroup>
								{#each ['24h', '7d', '30d'] as const as range (range)}
									<Button
										size="xs"
										color={patternDateRange === range ? 'primary' : 'light'}
										onclick={() => selectRange(range)}
									>
										{range}
									</Button>
								{/each}
							</ButtonGroup>
							<Button
								size="xs"
								color="light"
								title="Close historic view"
								onclick={() => (histScope = null)}
							>
								<CloseOutline class="h-4 w-4" />
							</Button>
						</div>
					</div>

					<CloudAvailabilityChart
						startDate={patternRange.start}
						endDate={patternRange.end}
						granularity={patternRange.granularity}
						onNavigate={stepHistWindow}
						canGoBack={effectiveHistOffset < maxHistOffset}
						canGoForward={effectiveHistOffset > 0}
						viewMode={histScope.kind}
						selectedLocationId={histLocationId}
						selectedServerTypeId={histServerTypeId}
						serverTypes={data.statusData.serverTypes}
						locations={data.statusData.locations}
						supported={data.statusData.supported}
						availability={data.statusData.availability}
					/>
				</div>
			{:else}
				<p class="bg-gray-50/80 px-4 py-3 text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
					Click a server type, a location column, or a single cell to see its availability history.
				</p>
			{/if}
		</div>
	{:else}
		<div class="flex items-center justify-center p-10">
			<Spinner size="8" />
			<p class="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading availability data...</p>
		</div>
	{/if}

	<PageInsights insights={data.insights ?? []} note={SUPPORTED_VS_AVAILABLE_NOTE} />

	<section class="mt-12 mb-8">
		<div class="mx-auto max-w-4xl">
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-700 dark:bg-gray-800"
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
							<Button onclick={openCreateAlertModal} color="primary" class="px-6 py-2 font-medium">
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
