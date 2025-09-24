<script lang="ts">
	type SliderSizeType = string | number | FileSizeReturnArray | FileSizeReturnObject;

	import { replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { getFormattedDiskSize, getFormattedMemorySize } from '$lib/disksize';
	import {
		decodeFilterString,
		defaultFilter,
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
		faStopwatch,
		faTags
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import type { FileSizeReturnArray, FileSizeReturnObject } from 'filesize';
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

	let filter = $state({ ...defaultFilter });
	let _hasStoredFilter = false;

	// Log initial state for debugging
	console.log('ServerFilter: Initial filter state created with defaultFilter', () => filter);
	console.log('ServerFilter: Initial filterStore value', $filterStore);

	// Initialize the filter store immediately with default values if it's null
	// This ensures consistent state between server and client rendering
	if ($filterStore === null) {
		console.log('ServerFilter: Initializing filter store with default values');
		filterStore.set({ ...defaultFilter });
	}

	onMount(() => {
		const urlFilter = getFilterFromURL($page.url.searchParams);
		const storedFilterValue = loadFilter();

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
		// No 'else' needed as filter is already initialized with default
	});

	function updateUrl(newFilter: ServerFilter | null) {
		if (newFilter && typeof window !== 'undefined') {
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.set('filter', encodeFilter(newFilter));
			// Use SvelteKit's replaceState to update URL without navigation
			replaceState(newUrl, window.history.state);
		}
	}

	const debouncedUpdateUrl = debounce(updateUrl, 500); // 500ms delay

	// Create a deep copy of the filter to track changes
	let previousFilterState = $state('');

	// This effect triggers whenever 'filter' changes
	$effect(() => {
		const currentFilterState = JSON.stringify(filter);

		// Only update if the filter has actually changed and we have a previous state
		if (previousFilterState && currentFilterState !== previousFilterState) {
			console.log('ServerFilter: Filter changed, updating store with:', filter);
			console.log('ServerFilter: Previous filterStore value:', $filterStore);

			// Update the store immediately for reactivity elsewhere (like data fetching)
			filterStore.set({ ...filter });

			// Update the URL only after a delay
			debouncedUpdateUrl({ ...filter });
		}

		previousFilterState = currentFilterState;

		console.log('ServerFilter: New filterStore value after update:', $filterStore);
	});

	function updateFilterFromUrl(newFilter: ServerFilter | null) {
		if (newFilter) {
			// Reassign the state object to ensure reactivity update
			filter = { ...filter, ...newFilter };
		}
	}

	$effect(() => {
		const filterString = $page.url.searchParams.get('filter');
		if (filterString) {
			console.log('ServerFilter: Found filter in URL:', filterString);
			const decodedFilter = decodeFilterString(filterString);
			// Avoid infinite loop by checking if filter actually changed
			if (JSON.stringify(decodedFilter) !== JSON.stringify(filter)) {
				console.log('ServerFilter: Updating filter from URL with:', decodedFilter);
				updateFilterFromUrl(decodedFilter);
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
		<Button
			color="alternative"
			size="sm"
			class="!p-2"
			onclick={() => (isFilterCollapsed = !isFilterCollapsed)}
			aria-label={isFilterCollapsed ? 'Expand filter' : 'Collapse filter'}
		>
			{#if isFilterCollapsed}
				<FontAwesomeIcon class="block sm:hidden" icon={faChevronDown} />
				<!-- Corrected: Down when collapsed -->
				<FontAwesomeIcon class="hidden sm:block" icon={faChevronRight} />
			{:else}
				<FontAwesomeIcon class="block sm:hidden" icon={faChevronUp} />
				<!-- Corrected: Up when expanded -->
				<FontAwesomeIcon class="hidden sm:block" icon={faChevronLeft} />
			{/if}
		</Button>
	</div>

	<!-- Collapsed Desktop View - Only visible when collapsed on desktop -->
	{#if isFilterCollapsed}
		<div class="mt-1 hidden flex-col items-center py-2 sm:flex">
			<Button
				color="alternative"
				size="sm"
				class="mb-4 !p-2"
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
			<h2 class="flex items-center dark:text-white">
				<FontAwesomeIcon class="me-1 h-4 w-4" icon={faGlobe} /> Location
			</h2>
		</li>
		<li>
			<Toggle
				size="small"
				checked={filter.locationGermany}
				onchange={(e: Event) => {
					const target = e.target as HTMLInputElement;
					console.log('Germany toggle changed:', target.checked);
					filter = { ...filter, locationGermany: target.checked };
				}}>Germany</Toggle
			>
		</li>
		<li>
			<Toggle
				size="small"
				checked={filter.locationFinland}
				onchange={(e: Event) => {
					const target = e.target as HTMLInputElement;
					console.log('Finland toggle changed:', target.checked);
					filter = { ...filter, locationFinland: target.checked };
				}}>Finland</Toggle
			>
		</li>

		<!-- Datacenter Filters -->
		<li>
			<h2 class="dark:text-white">
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
			<h2 class="dark:text-white">
				<FontAwesomeIcon class="me-2 h-4 w-4" icon={faMicrochip} />CPU
			</h2>
		</li>
		<li><Label class="text-sm">Vendor</Label></li>
		<li>
			<Toggle
				size="small"
				checked={filter.cpuIntel}
				onchange={(e: Event) => {
					const target = e.target as HTMLInputElement;
					console.log('Intel CPU toggle changed:', target.checked);
					filter = { ...filter, cpuIntel: target.checked };
				}}>Intel</Toggle
			>
		</li>
		<li>
			<Toggle
				size="small"
				checked={filter.cpuAMD}
				onchange={(e: Event) => {
					const target = e.target as HTMLInputElement;
					console.log('AMD CPU toggle changed:', target.checked);
					filter = { ...filter, cpuAMD: target.checked };
				}}>AMD</Toggle
			>
		</li>
		<li><h2 class="dark:text-white">Model</h2></li>
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
			<h2 class="dark:text-white">
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
				on:change={(e) => {
					console.log('RAM size slider changed:', e.detail);
					// Force a filter update by creating a new object
					filter = { ...filter };
				}}
			/>
		</li>
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">ECC</Label>
				<div>
					<ButtonGroup class="flex">
						<Button
							size="sm"
							onclick={() => {
								console.log('ECC button clicked: true');
								// Create a new object to ensure reactivity
								filter = { ...filter, extrasECC: true };
								console.log('Filter after update:', filter);
							}}
							checked={filter.extrasECC === true}>yes</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('ECC button clicked: false');
								// Create a new object to ensure reactivity
								filter = { ...filter, extrasECC: false };
								console.log('Filter after update:', filter);
							}}
							checked={filter.extrasECC === false}>no</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('ECC button clicked: null');
								// Create a new object to ensure reactivity
								filter = { ...filter, extrasECC: null };
								console.log('Filter after update:', filter);
							}}
							checked={filter.extrasECC === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</div>
		</li>

		<!-- Disk Filters -->
		<li>
			<h2 class="dark:text-white">
				<FontAwesomeIcon class="me-2 h-4 w-4" icon={faHardDrive} />Disks
			</h2>
		</li>

		<!-- SSD (NVMe) Filters -->
		<li>
			<h3 class="dark:text-white">SSDs (NVMe)</h3>
		</li>
		<li class="flex justify-between">
			<Label class="text-sm">Devices</Label>
			<span class="ml-2 text-right dark:text-gray-400">
				{#if filter.ssdNvmeCount[0] === filter.ssdNvmeCount[1]}
					{filter.ssdNvmeCount[0] === 0 ? 'none' : filter.ssdNvmeCount[0]}
				{:else}
					{filter.ssdNvmeCount[0]} – {filter.ssdNvmeCount[1]}
				{/if}
			</span>
		</li>
		<li>
			<RangeSlider
				bind:values={filter.ssdNvmeCount}
				min={0}
				max={8}
				hoverable={false}
				{springValues}
				pips
				range
				pushy
				on:change={(e) => {
					console.log('SSD NVMe count slider changed:', e.detail);
					// Force a filter update by creating a new object
					filter = { ...filter };
				}}
			/>
		</li>
		<li class="flex justify-between">
			<Label class="text-sm">Size</Label>
			<span class="ml-2 text-right dark:text-gray-400">
				{#if ssdNvmeSizeLower === ssdNvmeSizeUpper}
					{ssdNvmeSizeLower}
				{:else}
					{ssdNvmeSizeLower} – {ssdNvmeSizeUpper}
				{/if}
			</span>
		</li>
		<li>
			<RangeSlider
				bind:values={filter.ssdNvmeInternalSize}
				min={0}
				max={18}
				hoverable={false}
				{springValues}
				pips
				range
				pushy
				on:change={(e) => {
					console.log('SSD NVMe size slider changed:', e.detail);
					// Force a filter update by creating a new object
					filter = { ...filter };
				}}
			/>
		</li>

		<!-- SSD (SATA) Filters -->
		<li>
			<h3 class="dark:text-white">SSDs (SATA)</h3>
		</li>
		<li class="flex justify-between">
			<Label class="text-sm">Devices</Label>
			<span class="ml-2 text-right dark:text-gray-400">
				{#if filter.ssdSataCount[0] === filter.ssdSataCount[1]}
					{filter.ssdSataCount[0] === 0 ? 'none' : filter.ssdSataCount[0]}
				{:else}
					{filter.ssdSataCount[0]} – {filter.ssdSataCount[1]}
				{/if}
			</span>
		</li>
		<li>
			<RangeSlider
				bind:values={filter.ssdSataCount}
				min={0}
				max={4}
				hoverable={false}
				{springValues}
				pips
				range
				pushy
				on:change={(e) => {
					console.log('SSD SATA count slider changed:', e.detail);
					// Force a filter update by creating a new object
					filter = { ...filter };
				}}
			/>
		</li>
		<li class="flex justify-between">
			<Label class="text-sm">Size</Label>
			<span class="ml-2 text-right dark:text-gray-400">
				{#if ssdSataSizeLower === ssdSataSizeUpper}
					{ssdSataSizeLower}
				{:else}
					{ssdSataSizeLower} – {ssdSataSizeUpper}
				{/if}
			</span>
		</li>
		<li>
			<RangeSlider
				bind:values={filter.ssdSataInternalSize}
				min={0}
				max={14}
				hoverable={false}
				{springValues}
				pips
				range
				pushy
				on:change={(e) => {
					console.log('SSD SATA size slider changed:', e.detail);
					// Force a filter update by creating a new object
					filter = { ...filter };
				}}
			/>
		</li>

		<!-- HDD Filters -->
		<li>
			<h3 class="dark:text-white">HDDs</h3>
		</li>
		<li class="flex justify-between">
			<Label class="text-sm">Devices</Label>
			<span class="ml-2 text-right dark:text-gray-400">
				{#if filter.hddCount[0] === filter.hddCount[1]}
					{filter.hddCount[0] === 0 ? 'none' : filter.hddCount[0]}
				{:else}
					{filter.hddCount[0]} – {filter.hddCount[1]}
				{/if}
			</span>
		</li>
		<li>
			<RangeSlider
				bind:values={filter.hddCount}
				min={0}
				max={15}
				hoverable={false}
				{springValues}
				pips
				range
				pushy
				on:change={(e) => {
					console.log('HDD count slider changed:', e.detail);
					// Force a filter update by creating a new object
					filter = { ...filter };
				}}
			/>
		</li>
		<li class="flex justify-between">
			<Label class="text-sm">HDD Size</Label>
			<span class="ml-2 text-right dark:text-gray-400">
				{#if hddSizeLower === hddSizeUpper}
					{hddSizeLower}
				{:else}
					{hddSizeLower} – {hddSizeUpper}
				{/if}
			</span>
		</li>
		<li>
			<RangeSlider
				bind:values={filter.hddInternalSize}
				min={4}
				max={44}
				hoverable={false}
				{springValues}
				pips
				range
				pushy
				on:change={(e) => {
					console.log('HDD size slider changed:', e.detail);
					// Force a filter update by creating a new object
					filter = { ...filter };
				}}
			/>
		</li>

		<!-- Extras Filters -->
		<li>
			<h2 class="dark:text-white">
				<FontAwesomeIcon class="me-2 h-4 w-4" icon={faTags} />Extras
			</h2>
		</li>
		<!-- Intel NIC -->
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">Intel NIC</Label>
				<div>
					<ButtonGroup class="flex">
						<Button
							size="sm"
							onclick={() => {
								console.log('INIC button clicked: true');
								filter = { ...filter, extrasINIC: true };
							}}
							checked={filter.extrasINIC === true}>yes</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('INIC button clicked: false');
								filter = { ...filter, extrasINIC: false };
							}}
							checked={filter.extrasINIC === false}>no</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('INIC button clicked: null');
								filter = { ...filter, extrasINIC: null };
							}}
							checked={filter.extrasINIC === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</div>
		</li>
		<!-- Hardware RAID -->
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">Hardware RAID</Label>
				<div>
					<ButtonGroup class="flex">
						<Button
							size="sm"
							onclick={() => {
								console.log('HWR button clicked: true');
								filter = { ...filter, extrasHWR: true };
							}}
							checked={filter.extrasHWR === true}>yes</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('HWR button clicked: false');
								filter = { ...filter, extrasHWR: false };
							}}
							checked={filter.extrasHWR === false}>no</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('HWR button clicked: null');
								filter = { ...filter, extrasHWR: null };
							}}
							checked={filter.extrasHWR === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</div>
		</li>
		<!-- GPU -->
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">GPU</Label>
				<div>
					<ButtonGroup class="flex">
						<Button
							size="sm"
							onclick={() => {
								console.log('GPU button clicked: true');
								filter = { ...filter, extrasGPU: true };
							}}
							checked={filter.extrasGPU === true}>yes</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('GPU button clicked: false');
								filter = { ...filter, extrasGPU: false };
							}}
							checked={filter.extrasGPU === false}>no</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('GPU button clicked: null');
								filter = { ...filter, extrasGPU: null };
							}}
							checked={filter.extrasGPU === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</div>
		</li>
		<!-- Redundant Power Supply -->
		<li>
			<div class="flex items-center justify-between">
				<Label class="text-sm">Redundant Power Supply</Label>
				<div>
					<ButtonGroup class="flex">
						<Button
							size="sm"
							onclick={() => {
								console.log('RPS button clicked: true');
								filter = { ...filter, extrasRPS: true };
							}}
							checked={filter.extrasRPS === true}>yes</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('RPS button clicked: false');
								filter = { ...filter, extrasRPS: false };
							}}
							checked={filter.extrasRPS === false}>no</Button
						>
						<Button
							size="sm"
							onclick={() => {
								console.log('RPS button clicked: null');
								filter = { ...filter, extrasRPS: null };
							}}
							checked={filter.extrasRPS === null}>any</Button
						>
					</ButtonGroup>
				</div>
			</div>
		</li>
		<!-- Recently Seen -->
		<li>
			<div class="my-3">
				<Toggle
					size="small"
					checked={filter.recentlySeen}
					onchange={(e: Event) => {
						const target = e.target as HTMLInputElement;
						console.log('Recently Seen toggle changed:', target.checked);
						filter = { ...filter, recentlySeen: target.checked };
					}}>Recently Seen</Toggle
				>
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
		--tw-primary-600: theme('colors.primary.600');
		--tw-primary-400: theme('colors.primary.400');
	}

	:root {
		--range-handle: var(--tw-primary-600);
		--range-range: var(--tw-primary-600);
		--range-range-inactive: var(--tw-primary-400);
		--range-slider: rgb(237, 237, 237); /* Default light mode: light gray */
		--range-handle-inactive: var(--tw-primary-600);
		--range-handle-focus: var(--tw-primary-600);
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
