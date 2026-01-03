<script lang="ts">
type SliderSizeType = string | number | FilesizeArray | FilesizeObject;

	import { replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { getFormattedDiskSize, getFormattedMemorySize } from '$lib/disksize';
	import {
		decodeFilterString,
		createDefaultFilter,
		encodeFilter,
		getFilterFromURL,
		loadFilter,
		type ServerFilter
	} from '$lib/filter';
	import { filter as filterStore } from '$lib/stores/filter';
	import { addToast } from '$lib/stores/toast';
	import { debounce } from '$lib/util';
	import {
		faBoxesStacked,
		faChevronDown,
		faChevronLeft,
		faChevronRight,
		faChevronUp,
		faClockRotateLeft,
		faGlobe,
		faHardDrive,
		faMemory,
		faMicrochip,
		faRotateLeft,
		faStopwatch,
		faTags
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
import type { FilesizeArray, FilesizeObject } from 'filesize';
	import { Button, ButtonGroup, Label, MultiSelect, Toggle } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import { RangeSlider } from 'svelte-range-slider-pips';
	import dayjs from 'dayjs';

	// Make collapsed state bindable for the parent
	let {
		datacenters,
		cpuModels,
		isFilterCollapsed = $bindable(false),
		lastUpdate,
		queryTime,
		loading = false
	} = $props();

	const springValues = {
		stiffness: 1,
		damping: 1
	};

	// Collapsible section states (collapsed by default for less common filters)
	let nvmeCollapsed = $state(true);
	let sataCollapsed = $state(true);
	let hddCollapsed = $state(true);
	let extrasCollapsed = $state(true);

	// Per-disk size slider max values
	const NVME_PER_DISK_MAX = 18;
	const SATA_PER_DISK_MAX = 14;
	const HDD_PER_DISK_MAX = 44;

	// Max device counts
	const NVME_MAX_DEVICES = 8;
	const SATA_MAX_DEVICES = 4;
	const HDD_MAX_DEVICES = 15;

	let filter = $state(createDefaultFilter());
	let _hasStoredFilter = false;

	// Dynamic slider max based on size mode
	let nvmeSizeMax = $derived(
		filter.ssdNvmeSizeMode === 'total' ? NVME_PER_DISK_MAX * NVME_MAX_DEVICES : NVME_PER_DISK_MAX
	);
	let sataSizeMax = $derived(
		filter.ssdSataSizeMode === 'total' ? SATA_PER_DISK_MAX * SATA_MAX_DEVICES : SATA_PER_DISK_MAX
	);
	let hddSizeMax = $derived(
		filter.hddSizeMode === 'total' ? HDD_PER_DISK_MAX * HDD_MAX_DEVICES : HDD_PER_DISK_MAX
	);

	// Track previous size modes to detect changes and clamp values
	let prevNvmeSizeMode = $state<string | undefined>(undefined);
	let prevSataSizeMode = $state<string | undefined>(undefined);
	let prevHddSizeMode = $state<string | undefined>(undefined);

	// Clamp slider values when switching from total to per-disk mode
	$effect(() => {
		const currentMode = filter.ssdNvmeSizeMode;
		if (prevNvmeSizeMode !== undefined && prevNvmeSizeMode === 'total' && currentMode !== 'total') {
			// Switching from total to per-disk - clamp values
			const clamped = filter.ssdNvmeInternalSize.map((v) =>
				Math.min(v, NVME_PER_DISK_MAX)
			) as [number, number];
			if (
				clamped[0] !== filter.ssdNvmeInternalSize[0] ||
				clamped[1] !== filter.ssdNvmeInternalSize[1]
			) {
				filter = { ...filter, ssdNvmeInternalSize: clamped };
			}
		}
		prevNvmeSizeMode = currentMode;
	});

	$effect(() => {
		const currentMode = filter.ssdSataSizeMode;
		if (prevSataSizeMode !== undefined && prevSataSizeMode === 'total' && currentMode !== 'total') {
			const clamped = filter.ssdSataInternalSize.map((v) =>
				Math.min(v, SATA_PER_DISK_MAX)
			) as [number, number];
			if (
				clamped[0] !== filter.ssdSataInternalSize[0] ||
				clamped[1] !== filter.ssdSataInternalSize[1]
			) {
				filter = { ...filter, ssdSataInternalSize: clamped };
			}
		}
		prevSataSizeMode = currentMode;
	});

	$effect(() => {
		const currentMode = filter.hddSizeMode;
		if (prevHddSizeMode !== undefined && prevHddSizeMode === 'total' && currentMode !== 'total') {
			const clamped = filter.hddInternalSize.map((v) =>
				Math.min(v, HDD_PER_DISK_MAX)
			) as [number, number];
			if (clamped[0] !== filter.hddInternalSize[0] || clamped[1] !== filter.hddInternalSize[1]) {
				filter = { ...filter, hddInternalSize: clamped };
			}
		}
		prevHddSizeMode = currentMode;
	});

	// Initialize the filter store immediately with default values if it's null
	if ($filterStore === null) {
		filterStore.set(createDefaultFilter());
	}

	// Parse collapsed state from URL param (format: "nvme,sata,hdd,extras" for expanded sections)
	function parseExpandedSections(param: string | null): void {
		if (!param) return; // Keep defaults if no param
		const expanded = param.split(',');
		nvmeCollapsed = !expanded.includes('nvme');
		sataCollapsed = !expanded.includes('sata');
		hddCollapsed = !expanded.includes('hdd');
		extrasCollapsed = !expanded.includes('extras');
	}

	// Build expanded sections param
	function getExpandedSectionsParam(): string | null {
		const expanded: string[] = [];
		if (!nvmeCollapsed) expanded.push('nvme');
		if (!sataCollapsed) expanded.push('sata');
		if (!hddCollapsed) expanded.push('hdd');
		if (!extrasCollapsed) expanded.push('extras');
		return expanded.length > 0 ? expanded.join(',') : null;
	}

	onMount(() => {
		const urlFilter = getFilterFromURL($page.url.searchParams);
		const storedFilterValue = loadFilter();
		const base = createDefaultFilter();

		// Load collapsed state from URL
		parseExpandedSections($page.url.searchParams.get('expanded'));

		Object.assign(filter, base);

		if (urlFilter) {
			Object.assign(filter, urlFilter);
			addToast({
				color: 'green',
				message: 'Using filter from URL',
				icon: 'success'
			});
		} else if (storedFilterValue) {
			_hasStoredFilter = true;
			Object.assign(filter, storedFilterValue);
			addToast({
				color: 'green',
				message: 'Using stored filter settings',
				icon: 'success'
			});
		}
	});

	function updateUrl(newFilter: ServerFilter | null) {
		if (newFilter && typeof window !== 'undefined') {
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.set('filter', encodeFilter(newFilter));

			// Save expanded sections state
			const expandedParam = getExpandedSectionsParam();
			if (expandedParam) {
				newUrl.searchParams.set('expanded', expandedParam);
			} else {
				newUrl.searchParams.delete('expanded');
			}

			 
			replaceState(newUrl.pathname + newUrl.search, window.history.state);
		}
	}

	function resetFilter() {
		const base = createDefaultFilter();
		filter = { ...base };
		addToast({
			color: 'green',
			message: 'Filter reset to defaults',
			icon: 'success'
		});
	}

	const debouncedUpdateUrl = debounce(updateUrl, 500); // 500ms delay

	// Create a deep copy of the filter to track changes
	let previousFilterState = $state('');

	// This effect triggers whenever 'filter' changes
	$effect(() => {
		const currentFilterState = JSON.stringify(filter);

		// Update if the filter has actually changed
		// Also update on first load (when previousFilterState is empty) to sync URL filter to store
		const isFirstLoad = previousFilterState === '';
		const hasChanged = currentFilterState !== previousFilterState;

		if (hasChanged) {
			// Update the store immediately for reactivity elsewhere (like data fetching)
			filterStore.set({ ...filter });

			// Only update URL after user changes (not on initial load from URL)
			if (!isFirstLoad) {
				debouncedUpdateUrl({ ...filter });
			}
		}

		previousFilterState = currentFilterState;
	});

	// Track collapsed state and update URL when it changes
	let previousExpandedState = $state('');
	$effect(() => {
		const currentExpandedState = getExpandedSectionsParam() ?? '';
		if (previousExpandedState !== '' && currentExpandedState !== previousExpandedState) {
			debouncedUpdateUrl({ ...filter });
		}
		previousExpandedState = currentExpandedState;
	});

function updateFilterFromUrl(newFilter: ServerFilter | null) {
	if (!newFilter) {
		return;
	}

	const base = createDefaultFilter();
	Object.assign(filter, base, newFilter);
}

	// Track the last URL filter string to detect ACTUAL URL changes (not just filter state changes)
	let lastUrlFilterString = $state<string | null>(null);

	$effect(() => {
		const filterString = $page.url.searchParams.get('filter');

		// Only update if the URL filter string ACTUALLY changed
		// This prevents the effect from reverting user changes when they modify the filter
		// (since the URL won't be updated until the debounced updateUrl runs)
		if (filterString !== lastUrlFilterString) {
			lastUrlFilterString = filterString;

			if (filterString) {
				console.log('ServerFilter: URL filter changed to:', filterString);
				const decodedFilter = decodeFilterString(filterString);
				if (decodedFilter) {
					console.log('ServerFilter: Updating filter from URL with:', decodedFilter);
					updateFilterFromUrl(decodedFilter);
				}
			}
		}
	});

	// Variables for displaying formatted sizes - using $state to satisfy linter/reactivity tracking
	let ramSizeLower = $state<SliderSizeType>('');
	let ramSizeUpper = $state<SliderSizeType>('');
	let ssdNvmeSizeLower = $state<SliderSizeType>('');
	let ssdNvmeSizeUpper = $state<SliderSizeType>('');
	let ssdSataSizeLower = $state<SliderSizeType>('');
	let ssdSataSizeUpper = $state<SliderSizeType>('');
	let hddSizeLower = $state<SliderSizeType>('');
	let hddSizeUpper = $state<SliderSizeType>('');

	$effect(() => {
		// Update formatted sizes when filter changes
		ramSizeLower = getFormattedMemorySize(filter.ramInternalSize[0]);
		ramSizeUpper = getFormattedMemorySize(filter.ramInternalSize[1]);
		ssdNvmeSizeLower = getFormattedDiskSize(filter.ssdNvmeInternalSize[0], 500);
		ssdNvmeSizeUpper = getFormattedDiskSize(filter.ssdNvmeInternalSize[1], 500);
		ssdSataSizeLower = getFormattedDiskSize(filter.ssdSataInternalSize[0], 500);
		ssdSataSizeUpper = getFormattedDiskSize(filter.ssdSataInternalSize[1], 500);
		hddSizeLower = getFormattedDiskSize(filter.hddInternalSize[0], 500);
		hddSizeUpper = getFormattedDiskSize(filter.hddInternalSize[1], 500);
	});
</script>

<!-- Header and Toggle Button - Always Render -->
<div class="flex w-full flex-col sm:w-auto">
	<!-- Regular Layout - Hidden when collapsed on desktop but visible on mobile -->
	<div class="flex items-center justify-between py-2 {isFilterCollapsed ? 'sm:hidden' : ''}">
		<h1 class="text-xl font-semibold dark:text-white">Filter Settings</h1>
		<div class="flex gap-1">
			<Button
				color="alternative"
				size="sm"
				class="p-2!"
				onclick={resetFilter}
				aria-label="Reset filter to defaults"
			>
				<FontAwesomeIcon icon={faRotateLeft} />
			</Button>
			<Button
				color="alternative"
				size="sm"
				class="p-2!"
				onclick={() => (isFilterCollapsed = !isFilterCollapsed)}
				aria-label={isFilterCollapsed ? 'Expand filter' : 'Collapse filter'}
			>
				{#if isFilterCollapsed}
					<span class="block sm:hidden"><FontAwesomeIcon icon={faChevronDown} /></span>
					<span class="hidden sm:block"><FontAwesomeIcon icon={faChevronRight} /></span>
				{:else}
					<span class="block sm:hidden"><FontAwesomeIcon icon={faChevronUp} /></span>
					<span class="hidden sm:block"><FontAwesomeIcon icon={faChevronLeft} /></span>
				{/if}
			</Button>
		</div>
	</div>

	<!-- Collapsed Desktop View - Only visible when collapsed on desktop -->
	{#if isFilterCollapsed}
		<div class="mt-1 hidden flex-col items-center py-2 sm:flex">
			<Button
				color="alternative"
				size="sm"
				class="mb-4 p-2!"
				onclick={() => (isFilterCollapsed = !isFilterCollapsed)}
				aria-label="Expand filter"
			>
				<FontAwesomeIcon icon={faChevronRight} />
			</Button>
			<span class="vertical-text text-lg font-semibold text-gray-700 dark:text-gray-300"
				>Filter Settings</span
			>
		</div>
	{/if}

	<!-- Filter List - Visibility controlled by isFilterCollapsed -->
	<ul class="space-y-2 font-medium {isFilterCollapsed ? 'hidden' : ''}" data-testid="server-filter">
		<!-- Location Filters -->
		<li class="flex items-center justify-between">
			<h2 class="flex items-center text-base font-semibold dark:text-white">
				<FontAwesomeIcon class="me-1 h-4 w-4" icon={faGlobe} /> Location
			</h2>
		</li>
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">Germany</Label>
				<Toggle
					size="small"
					checked={filter.locationGermany}
					onchange={(e: Event) => {
						const target = e.target as HTMLInputElement;
						filter = { ...filter, locationGermany: target.checked };
					}}
				/>
			</div>
		</li>
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">Finland</Label>
				<Toggle
					size="small"
					checked={filter.locationFinland}
					onchange={(e: Event) => {
						const target = e.target as HTMLInputElement;
						filter = { ...filter, locationFinland: target.checked };
					}}
				/>
			</div>
		</li>

		<!-- Server Type Filters -->
		<li class="flex items-center justify-between">
			<h2 class="flex items-center text-base font-semibold dark:text-white">
				<FontAwesomeIcon class="me-1 h-4 w-4" icon={faTags} /> Server Type
			</h2>
		</li>
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">Auction</Label>
				<Toggle
					size="small"
					checked={filter.showAuction}
					onchange={(e: Event) => {
						const target = e.target as HTMLInputElement;
						filter = { ...filter, showAuction: target.checked };
					}}
				/>
			</div>
		</li>
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">Standard</Label>
				<Toggle
					size="small"
					checked={filter.showStandard}
					onchange={(e: Event) => {
						const target = e.target as HTMLInputElement;
						filter = { ...filter, showStandard: target.checked };
					}}
				/>
			</div>
		</li>

		<!-- Datacenter Filters -->
		<li>
			<h2 class="text-base font-semibold dark:text-white">
				<FontAwesomeIcon class="me-2 h-4 w-4" icon={faBoxesStacked} />Datacenter
			</h2>
		</li>
		<li>
			<MultiSelect
				class="text-sm"
				items={datacenters}
				bind:value={filter.selectedDatacenters}
				size="sm"
			/>
		</li>

		<!-- CPU Filters -->
		<li>
			<h2 class="text-base font-semibold dark:text-white">
				<FontAwesomeIcon class="me-2 h-4 w-4" icon={faMicrochip} />CPU
			</h2>
		</li>
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">Intel</Label>
				<Toggle
					size="small"
					checked={filter.cpuIntel}
					onchange={(e: Event) => {
						const target = e.target as HTMLInputElement;
						filter = { ...filter, cpuIntel: target.checked };
					}}
				/>
			</div>
		</li>
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">AMD</Label>
				<Toggle
					size="small"
					checked={filter.cpuAMD}
					onchange={(e: Event) => {
						const target = e.target as HTMLInputElement;
						filter = { ...filter, cpuAMD: target.checked };
					}}
				/>
			</div>
		</li>
		<li><h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">Model</h3></li>
		<li>
			<MultiSelect
				class="text-sm"
				items={cpuModels}
				bind:value={filter.selectedCpuModels}
				size="sm"
			/>
		</li>

		<!-- Memory Filters -->
		<li>
			<h2 class="text-base font-semibold dark:text-white">
				<FontAwesomeIcon class="me-2 h-4 w-4" icon={faMemory} />Memory
			</h2>
		</li>
		<li class="flex justify-between">
			<Label class="text-sm">Size</Label>
			<span class="ml-2 text-right dark:text-gray-400">
				{#if ramSizeLower === ramSizeUpper}
					{ramSizeLower}
				{:else}
					{ramSizeLower} – {ramSizeUpper}
				{/if}
			</span>
		</li>
		<li>
			<RangeSlider
				bind:values={filter.ramInternalSize}
				min={4}
				max={10}
				hoverable={false}
				{springValues}
				pips
				range
				pushy
				on:change={() => {
					filter = { ...filter };
				}}
			/>
		</li>
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">ECC</Label>
				<div>
					<ButtonGroup size="xs">
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasECC: true };
							}}
							checked={filter.extrasECC === true}>yes</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasECC: false };
							}}
							checked={filter.extrasECC === false}>no</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasECC: null };
							}}
							checked={filter.extrasECC === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</div>
		</li>

		<!-- Disk Filters -->
		<li>
			<h2 class="text-base font-semibold dark:text-white">
				<FontAwesomeIcon class="me-2 h-4 w-4" icon={faHardDrive} />Disks
			</h2>
		</li>

		<!-- SSD (NVMe) Filters -->
		<li class="border-l-2 border-gray-200 pl-3 dark:border-gray-600">
			<div class="space-y-3">
				<button
					type="button"
					class="flex w-full items-center justify-between text-left"
					onclick={() => (nvmeCollapsed = !nvmeCollapsed)}
				>
					<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">SSDs (NVMe)</h3>
					<FontAwesomeIcon
						icon={nvmeCollapsed ? faChevronDown : faChevronUp}
						class="h-3 w-3 text-gray-500"
					/>
				</button>
				{#if !nvmeCollapsed}
					<div class="flex justify-between">
						<Label class="text-sm">Devices</Label>
						<span class="ml-2 text-right dark:text-gray-400">
							{#if filter.ssdNvmeCount[0] === filter.ssdNvmeCount[1]}
								{filter.ssdNvmeCount[0] === 0 ? 'none' : filter.ssdNvmeCount[0]}
							{:else}
								{filter.ssdNvmeCount[0]} – {filter.ssdNvmeCount[1]}
							{/if}
						</span>
					</div>
					<RangeSlider
						bind:values={filter.ssdNvmeCount}
						min={0}
						max={8}
						hoverable={false}
						{springValues}
						pips
						range
						pushy
						on:change={() => {
							filter = { ...filter };
						}}
					/>
					<div class="flex justify-between">
						<Label class="text-sm"
							>{filter.ssdNvmeSizeMode === 'total' ? 'Total Size' : 'Size/Disk'}</Label
						>
						<span class="ml-2 text-right dark:text-gray-400">
							{#if ssdNvmeSizeLower === ssdNvmeSizeUpper}
								{ssdNvmeSizeLower}
							{:else}
								{ssdNvmeSizeLower} – {ssdNvmeSizeUpper}
							{/if}
						</span>
					</div>
					<RangeSlider
						bind:values={filter.ssdNvmeInternalSize}
						min={0}
						max={nvmeSizeMax}
						hoverable={false}
						{springValues}
						pips
						range
						pushy
						on:change={() => {
							filter = { ...filter };
						}}
					/>
					<div class="flex items-center justify-between">
						<Label class="text-sm">Filter by</Label>
						<ButtonGroup size="xs">
							<Button
								size="xs"
								onclick={() => {
									filter = { ...filter, ssdNvmeSizeMode: 'per-disk' };
								}}
								checked={filter.ssdNvmeSizeMode !== 'total'}>per disk</Button
							>
							<Button
								size="xs"
								onclick={() => {
									filter = { ...filter, ssdNvmeSizeMode: 'total' };
								}}
								checked={filter.ssdNvmeSizeMode === 'total'}>total</Button
							>
						</ButtonGroup>
					</div>
				{/if}
			</div>
		</li>

		<!-- SSD (SATA) Filters -->
		<li class="border-l-2 border-gray-200 pl-3 dark:border-gray-600">
			<div class="space-y-3">
				<button
					type="button"
					class="flex w-full items-center justify-between text-left"
					onclick={() => (sataCollapsed = !sataCollapsed)}
				>
					<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">SSDs (SATA)</h3>
					<FontAwesomeIcon
						icon={sataCollapsed ? faChevronDown : faChevronUp}
						class="h-3 w-3 text-gray-500"
					/>
				</button>
				{#if !sataCollapsed}
					<div class="flex justify-between">
						<Label class="text-sm">Devices</Label>
						<span class="ml-2 text-right dark:text-gray-400">
							{#if filter.ssdSataCount[0] === filter.ssdSataCount[1]}
								{filter.ssdSataCount[0] === 0 ? 'none' : filter.ssdSataCount[0]}
							{:else}
								{filter.ssdSataCount[0]} – {filter.ssdSataCount[1]}
							{/if}
						</span>
					</div>
					<RangeSlider
						bind:values={filter.ssdSataCount}
						min={0}
						max={4}
						hoverable={false}
						{springValues}
						pips
						range
						pushy
						on:change={() => {
							filter = { ...filter };
						}}
					/>
					<div class="flex justify-between">
						<Label class="text-sm"
							>{filter.ssdSataSizeMode === 'total' ? 'Total Size' : 'Size/Disk'}</Label
						>
						<span class="ml-2 text-right dark:text-gray-400">
							{#if ssdSataSizeLower === ssdSataSizeUpper}
								{ssdSataSizeLower}
							{:else}
								{ssdSataSizeLower} – {ssdSataSizeUpper}
							{/if}
						</span>
					</div>
					<RangeSlider
						bind:values={filter.ssdSataInternalSize}
						min={0}
						max={sataSizeMax}
						hoverable={false}
						{springValues}
						pips
						range
						pushy
						on:change={() => {
							filter = { ...filter };
						}}
					/>
					<div class="flex items-center justify-between">
						<Label class="text-sm">Filter by</Label>
						<ButtonGroup size="xs">
							<Button
								size="xs"
								onclick={() => {
									filter = { ...filter, ssdSataSizeMode: 'per-disk' };
								}}
								checked={filter.ssdSataSizeMode !== 'total'}>per disk</Button
							>
							<Button
								size="xs"
								onclick={() => {
									filter = { ...filter, ssdSataSizeMode: 'total' };
								}}
								checked={filter.ssdSataSizeMode === 'total'}>total</Button
							>
						</ButtonGroup>
					</div>
				{/if}
			</div>
		</li>

		<!-- HDD Filters -->
		<li class="border-l-2 border-gray-200 pl-3 dark:border-gray-600">
			<div class="space-y-3">
				<button
					type="button"
					class="flex w-full items-center justify-between text-left"
					onclick={() => (hddCollapsed = !hddCollapsed)}
				>
					<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">HDDs</h3>
					<FontAwesomeIcon
						icon={hddCollapsed ? faChevronDown : faChevronUp}
						class="h-3 w-3 text-gray-500"
					/>
				</button>
				{#if !hddCollapsed}
					<div class="flex justify-between">
						<Label class="text-sm">Devices</Label>
						<span class="ml-2 text-right dark:text-gray-400">
							{#if filter.hddCount[0] === filter.hddCount[1]}
								{filter.hddCount[0] === 0 ? 'none' : filter.hddCount[0]}
							{:else}
								{filter.hddCount[0]} – {filter.hddCount[1]}
							{/if}
						</span>
					</div>
					<RangeSlider
						bind:values={filter.hddCount}
						min={0}
						max={15}
						hoverable={false}
						{springValues}
						pips
						range
						pushy
						on:change={() => {
							filter = { ...filter };
						}}
					/>
					<div class="flex justify-between">
						<Label class="text-sm"
							>{filter.hddSizeMode === 'total' ? 'Total Size' : 'Size/Disk'}</Label
						>
						<span class="ml-2 text-right dark:text-gray-400">
							{#if hddSizeLower === hddSizeUpper}
								{hddSizeLower}
							{:else}
								{hddSizeLower} – {hddSizeUpper}
							{/if}
						</span>
					</div>
					<RangeSlider
						bind:values={filter.hddInternalSize}
						min={4}
						max={hddSizeMax}
						hoverable={false}
						{springValues}
						pips
						range
						pushy
						on:change={() => {
							filter = { ...filter };
						}}
					/>
					<div class="flex items-center justify-between">
						<Label class="text-sm">Filter by</Label>
						<ButtonGroup size="xs">
							<Button
								size="xs"
								onclick={() => {
									filter = { ...filter, hddSizeMode: 'per-disk' };
								}}
								checked={filter.hddSizeMode !== 'total'}>per disk</Button
							>
							<Button
								size="xs"
								onclick={() => {
									filter = { ...filter, hddSizeMode: 'total' };
								}}
								checked={filter.hddSizeMode === 'total'}>total</Button
							>
						</ButtonGroup>
					</div>
				{/if}
			</div>
		</li>

		<!-- Extras Filters -->
		<li>
			<button
				type="button"
				class="flex w-full items-center justify-between text-left"
				onclick={() => (extrasCollapsed = !extrasCollapsed)}
			>
				<h2 class="text-base font-semibold dark:text-white">
					<FontAwesomeIcon class="me-2 h-4 w-4" icon={faTags} />Extras
				</h2>
				<FontAwesomeIcon
					icon={extrasCollapsed ? faChevronDown : faChevronUp}
					class="h-3 w-3 text-gray-500"
				/>
			</button>
		</li>
		{#if !extrasCollapsed}
			<!-- Intel NIC -->
			<li>
				<div class="flex items-center justify-between">
					<Label class="text-sm">Intel NIC</Label>
					<ButtonGroup size="xs">
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasINIC: true };
							}}
							checked={filter.extrasINIC === true}>yes</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasINIC: false };
							}}
							checked={filter.extrasINIC === false}>no</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasINIC: null };
							}}
							checked={filter.extrasINIC === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</li>
			<!-- Hardware RAID -->
			<li>
				<div class="flex items-center justify-between">
					<Label class="text-sm">Hardware RAID</Label>
					<ButtonGroup size="xs">
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasHWR: true };
							}}
							checked={filter.extrasHWR === true}>yes</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasHWR: false };
							}}
							checked={filter.extrasHWR === false}>no</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasHWR: null };
							}}
							checked={filter.extrasHWR === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</li>
			<!-- GPU -->
			<li>
				<div class="flex items-center justify-between">
					<Label class="text-sm">GPU</Label>
					<ButtonGroup size="xs">
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasGPU: true };
							}}
							checked={filter.extrasGPU === true}>yes</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasGPU: false };
							}}
							checked={filter.extrasGPU === false}>no</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasGPU: null };
							}}
							checked={filter.extrasGPU === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</li>
			<!-- Redundant Power Supply -->
			<li>
				<div class="flex items-center justify-between">
					<Label class="text-sm">Redundant PSU</Label>
					<ButtonGroup size="xs">
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasRPS: true };
							}}
							checked={filter.extrasRPS === true}>yes</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasRPS: false };
							}}
							checked={filter.extrasRPS === false}>no</Button
						>
						<Button
							size="xs"
							onclick={() => {
								filter = { ...filter, extrasRPS: null };
							}}
							checked={filter.extrasRPS === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</li>
		{/if}
		<!-- Recently Seen -->
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">Recently Seen</Label>
				<Toggle
					size="small"
					checked={filter.recentlySeen}
					onchange={(e: Event) => {
						const target = e.target as HTMLInputElement;
						filter = { ...filter, recentlySeen: target.checked };
					}}
				/>
			</div>
		</li>
	</ul>

	<!-- Timestamp/Loading Info - Directly after filter options -->
	{#if !isFilterCollapsed}
		<div class="px-0 py-2">
			<hr class="mb-2 border-gray-200 dark:border-gray-700" />
			<div class="my-1">
				{#if lastUpdate}
					<p class="mt-2 text-center text-sm text-gray-400 dark:text-gray-400">
						<FontAwesomeIcon icon={faClockRotateLeft} class="me-1" />
						{dayjs.unix(lastUpdate).format('DD.MM.YYYY HH:mm')}
					</p>
				{/if}
				{#if queryTime}
					<p class="mt-2 text-center text-sm text-gray-400 dark:text-gray-400">
						{#if loading}
							<span
								class="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-gray-500 border-t-transparent"
								aria-hidden="true"
							></span>
						{:else}
							<FontAwesomeIcon icon={faStopwatch} class="me-1" />
							completed in {queryTime.toFixed(0)}ms
						{/if}
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Close responsive container -->

<style>
	:root {
		--range-handle: var(--color-primary-600);
		--range-range: var(--color-primary-600);
		--range-range-inactive: var(--color-primary-400);
		--range-slider: rgb(237, 237, 237); /* Default light mode: light gray */
		--range-handle-inactive: var(--color-primary-600);
		--range-handle-focus: var(--color-primary-600);
	}

	:root.dark {
		--range-slider: rgb(55, 65, 81); /* Dark mode: dark gray (gray-700) */
	}

	/* Vertical text for collapsed filter */
	.vertical-text {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		transform: rotate(180deg);
		white-space: nowrap;
		letter-spacing: 1px;
	}

	/* Make range sliders smaller */
	:global(.rangeSlider) {
		font-size: 12px;
	}
</style>
