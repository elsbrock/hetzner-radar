<script lang="ts">
	import type { NameValuePair, ServerFilter } from '$lib/dbapi';
	import { RangeSlider } from "svelte-range-slider-pips";
	import { faBoxesStacked, faFloppyDisk, faTrash, faGlobe, faHardDrive, faMemory, faMicrochip, faTags } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { filesize, type FileSizeOptions } from 'filesize';
	import { Label, Tooltip } from 'flowbite-svelte';
	import { MultiSelect } from 'flowbite-svelte';
	import { Toggle } from 'flowbite-svelte';
	import { ButtonGroup, Button } from 'flowbite-svelte';
	import queryString from 'query-string';
	import { createEventDispatcher } from 'svelte';

	// used for filter persistence events
	const dispatch = createEventDispatcher();

	const fileSizeOptions: FileSizeOptions = {
		base: 10,
		round: 0,
		standard: "si",
	};

	const diskSizeOptions: FileSizeOptions = {
		base: 10,
		round: 2,
		standard: "si",
	};

	const springValues = {
		stiffness: 1,
		damping: 1,
	};

	export let filter: ServerFilter;
	export let datacenters: NameValuePair[];
	export let cpuModels: NameValuePair[];
	export let hasStoredFilter: boolean;

	function getFilterString(filter: ServerFilter) {
		const filterString = queryString.stringify(filter, {
			arrayFormat: "bracket",
			skipNull: false,
			sort: false,
		});
		return filterString;
	}

	function getFormattedSize(exp: number) {
		return filesize(
			Math.pow(2, exp) * Math.pow(1000, 3),
			fileSizeOptions
		);
	}

	function getFormattedDiskSize(base: number, step: number = 250) {
		return filesize(
			base * step * Math.pow(1000, 3),
			diskSizeOptions
		);
	}

	$: ramSizeLower = getFormattedSize(filter.ramInternalSize[0]);
	$: ramSizeUpper = getFormattedSize(filter.ramInternalSize[1]);
	$: ssdNvmeSizeLower = getFormattedDiskSize(filter.ssdNvmeInternalSize[0]);
	$: ssdNvmeSizeUpper = getFormattedDiskSize(filter.ssdNvmeInternalSize[1]);
	$: ssdSataSizeLower = getFormattedDiskSize(filter.ssdSataInternalSize[0]);
	$: ssdSataSizeUpper = getFormattedDiskSize(filter.ssdSataInternalSize[1]);
	$: hddSizeLower = getFormattedDiskSize(filter.hddInternalSize[0], 500);
	$: hddSizeUpper = getFormattedDiskSize(filter.hddInternalSize[1], 500);
	$: window.location.hash = "filter.v1:" + getFilterString(filter);
</script>

<style>
	:root {
	  --tw-primary-600: theme('colors.primary.600');
	  --tw-primary-400: theme('colors.primary.400');
	}

	:root {
	  --range-handle: var(--tw-primary-600);
	  --range-range: var(--tw-primary-600);
	  --range-range-inactive: var(--tw-primary-400);
	  --range-slider: rgb(237, 237, 237);
	  --range-handle-inactive: var(--tw-primary-600);
	  --range-handle-focus: var(--tw-primary-600);
	}
</style>

<ul class="space-y-2 font-medium">
	<li class="flex items-center justify-between">
		<h2 class="flex items-center">
			<FontAwesomeIcon
				class="w-4 h-4 me-1"
				icon={faGlobe}
			/> Location
		</h2>
		<div class="flex items-center ml-auto">
			<Tooltip triggeredBy="#save-filter" placement="bottom" trigger="hover">Save filter to local storage</Tooltip>
			<button
				id="save-filter"
				class="ml-2 text-right p-2 rounded cursor-pointer hover:scale-110 active:scale-95 transition transform duration-150 ease-in-out"
				on:click={() => dispatch('saveFilter')}
				aria-label="Save Filter"
			>
				<FontAwesomeIcon
					class="w-5 h-5 text-black dark:text-white transition-colors duration-150 ease-in-out"
					icon={faFloppyDisk}
				/>
			</button>
			{#if hasStoredFilter}
				<Tooltip triggeredBy="#clear-filter" placement="bottom" trigger="hover">Delete filter from local storage</Tooltip>
				<button
					id="clear-filter"
					class="ml-2 text-right p-2 rounded cursor-pointer hover:scale-110 active:scale-95 transition transform duration-150 ease-in-out"
					on:click={() => dispatch('clearFilter')}
					aria-label="Clear Filter"
				>
					<FontAwesomeIcon
						class="w-5 h-5 text-black dark:text-white transition-colors duration-150 ease-in-out"
						icon={faTrash}
					/>
				</button>
			{/if}
		</div>
	</li>	
	<li>
		<Toggle bind:checked={filter.locationGermany} value={filter.locationGermany ? 'on' : 'off'}
			>Germany</Toggle
		>
	</li>
	<li>
		<Toggle bind:checked={filter.locationFinland} value={filter.locationFinland ? 'on' : 'off'}
			>Finland</Toggle
		>
	</li>
	<li><h2><FontAwesomeIcon
		class="w-4 h-4 me-2"
		icon={faBoxesStacked}
	/>Datacenter</h2></li>
	<li>
		<MultiSelect
			class="text-sm"
			items={datacenters}
			bind:value={filter.selectedDatacenters}
			size="sm"
		/>
	</li>
	<li>
		<hr />
	</li>
	<li>
		<h2><FontAwesomeIcon
			class="w-4 h-4 me-2"
			icon={faMicrochip}
		/>CPU</h2>
	</li>
	<li><Label class="text-sm">Vendor</Label></li>
	<li>
		<Toggle bind:checked={filter.cpuIntel} value={filter.cpuIntel ? 'on' : 'off'}>Intel</Toggle>
	</li>
	<li>
		<Toggle bind:checked={filter.cpuAMD} value={filter.cpuAMD ? 'on' : 'off'}>AMD</Toggle>
	</li>
	<!-- <li class="flex justify-between">
	<Label class="text-sm">Count</Label>
	<span class="ml-2 text-right">{filter.cpuCount}</span>
</li>
<li>
	<Range min="1" max="1" bind:value={filter.cpuCount} />
</li> -->
	<li><h2>Model</h2></li>
	<li>
		<MultiSelect
			class="text-sm"
			items={cpuModels}
			bind:value={filter.selectedCpuModels}
			size="sm"
		/>
	</li>
	<li>
		<hr />
	</li>
	<li>
		<h2><FontAwesomeIcon
			class="w-4 h-4 me-2"
			icon={faMemory}
		/>Memory</h2>
	</li>
	<li class="flex justify-between">
		<Label class="text-sm">Size</Label>
		<span class="ml-2 text-right">
			{#if (ramSizeLower === ramSizeUpper)}
				{ramSizeLower}
			{:else}
				{ramSizeLower} – {ramSizeUpper}
			{/if}
		</span>
	</li>
	<li>
		<RangeSlider bind:values={filter.ramInternalSize} min={4} max={10} hoverable={false} {springValues} pips range pushy />
	</li>
	<li>
		<div class="flex items-center justify-between">
			<Label class="text-sm">ECC</Label>
			<div>
				<ButtonGroup class="flex">
					<Button
						size="xs"
						on:click={() => (filter.extrasECC = true)}
						checked={filter.extrasECC === true}>yes</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasECC = false)}
						checked={filter.extrasECC === false}>no</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasECC = null)}
						checked={filter.extrasECC === null}>any</Button
					>
				</ButtonGroup>
			</div>
		</div>
	</li>
	<li>
		<hr />
	</li>
	<li>
		<h2><FontAwesomeIcon
			class="w-4 h-4 me-2"
			icon={faHardDrive}
		/>Disks</h2>
	</li>
	<li>
		<h3>SSDs (NVMe)</h3>
	</li>
	<li class="flex justify-between">
		<Label class="text-sm">Devices</Label>
		<span class="ml-2 text-right">
			{#if (filter.ssdNvmeCount[0] === filter.ssdNvmeCount[1])}
				{filter.ssdNvmeCount[0] === 0 ? 'none' : filter.ssdNvmeCount[0]}
			{:else}
				{filter.ssdNvmeCount[0]} – {filter.ssdNvmeCount[1]}
			{/if}
		</span>
	</li>
	<li>
		<RangeSlider bind:values={filter.ssdNvmeCount} min={0} max={8} hoverable={false} {springValues} pips range pushy />
	</li>
	<li class="flex justify-between">
		<Label class="text-sm">Size</Label>
		<span class="ml-2 text-right">
			{#if (ssdNvmeSizeLower === ssdNvmeSizeUpper)}
				{ramSizeLower}
			{:else}
				{ssdNvmeSizeLower} – {ssdNvmeSizeUpper}
			{/if}
		</span>
	</li>
	<li>
		<RangeSlider bind:values={filter.ssdNvmeInternalSize} min={1} max={18} hoverable={false} {springValues} pips range pushy />
	</li>
	<li>
		<h3>SSDs (SATA)</h3>
	</li>
	<li class="flex justify-between">
		<Label class="text-sm">Devices</Label>
		<span class="ml-2 text-right">
			{#if (filter.ssdSataCount[0] === filter.ssdSataCount[1])}
				{filter.ssdSataCount[0] === 0 ? 'none' : filter.ssdSataCount[0]}
			{:else}
				{filter.ssdSataCount[0]} – {filter.ssdSataCount[1]}
			{/if}
		</span>
	</li>
	<li>
		<RangeSlider bind:values={filter.ssdSataCount} min={0} max={4} hoverable={false} {springValues} pips range pushy />
	</li>
	<li class="flex justify-between">
		<Label class="text-sm">Size</Label>
		<span class="ml-2 text-right">
			{#if (ssdSataSizeLower === ssdSataSizeUpper)}
				{ssdSataSizeLower}
			{:else}
				{ssdSataSizeLower} – {ssdSataSizeUpper}
			{/if}
		</span>
	</li>
	<li>
		<RangeSlider bind:values={filter.ssdSataInternalSize} min={1} max={14} hoverable={false} {springValues} pips range pushy />
	</li>
	<li>
		<h3>HDDs</h3>
	</li>
	<li class="flex justify-between">
		<Label class="text-sm">Devices</Label>
		<span class="ml-2 text-right">
			{#if (filter.hddCount[0] === filter.hddCount[1])}
				{filter.hddCount[0] === 0 ? 'none' : filter.hddCount[0]}
			{:else}
				{filter.hddCount[0]} – {filter.hddCount[1]}
			{/if}
		</span>
	</li>
	<li>
		<RangeSlider bind:values={filter.hddCount} min={0} max={5} hoverable={false} {springValues} pips range pushy />
	</li>
	<li class="flex justify-between">
		<Label class="text-sm">HDD Size</Label>
		<span class="ml-2 text-right">
			{#if (hddSizeLower === hddSizeUpper)}
				{hddSizeLower}
			{:else}
				{hddSizeLower} – {hddSizeUpper}
			{/if}
		</span>
	</li>
	<li>
		<RangeSlider bind:values={filter.hddInternalSize} min={4} max={44} hoverable={false} {springValues} pips range pushy />
	</li>
	<li>
		<hr />
	</li>
	<li>
		<h2><FontAwesomeIcon
			class="w-4 h-4 me-2"
			icon={faTags}
		/>Extras</h2>
	</li>
	<li>
		<div class="flex items-center justify-between">
			<Label class="text-sm">Intel NIC</Label>
			<div>
				<ButtonGroup class="flex">
					<Button
						size="xs"
						on:click={() => (filter.extrasINIC = true)}
						checked={filter.extrasINIC === true}>yes</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasINIC = false)}
						checked={filter.extrasINIC === false}>no</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasINIC = null)}
						checked={filter.extrasINIC === null}>any</Button
					>
				</ButtonGroup>
			</div>
		</div>
	</li>
	<li>
		<div class="flex items-center justify-between">
			<Label class="text-sm">Hardware RAID</Label>
			<div>
				<ButtonGroup class="flex">
					<Button
						size="xs"
						on:click={() => (filter.extrasHWR = true)}
						checked={filter.extrasHWR === true}>yes</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasHWR = false)}
						checked={filter.extrasHWR === false}>no</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasHWR = null)}
						checked={filter.extrasHWR === null}>any</Button
					>
				</ButtonGroup>
			</div>
		</div>
	</li>
	<li>
		<div class="flex items-center justify-between">
			<Label class="text-sm">GPU</Label>
			<div>
				<ButtonGroup class="flex">
					<Button
						size="xs"
						on:click={() => (filter.extrasGPU = true)}
						checked={filter.extrasGPU === true}>yes</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasGPU = false)}
						checked={filter.extrasGPU === false}>no</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasGPU = null)}
						checked={filter.extrasGPU === null}>any</Button
					>
				</ButtonGroup>
			</div>
		</div>
	</li>
	<li>
		<div class="flex items-center justify-between">
			<Label class="text-sm">Redundant Power Supply</Label>
			<div>
				<ButtonGroup class="flex">
					<Button
						size="xs"
						on:click={() => (filter.extrasRPS = true)}
						checked={filter.extrasRPS === true}>yes</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasRPS = false)}
						checked={filter.extrasRPS === false}>no</Button
					>
					<Button
						size="xs"
						on:click={() => (filter.extrasRPS = null)}
						checked={filter.extrasRPS === null}>any</Button
					>
				</ButtonGroup>
			</div>
		</div>
	</li>

	<li>
		<hr />
	</li>
	<li>
			<div class="my-3">
				<Toggle bind:checked={filter.recentlySeen} value={filter.recentlySeen ? 'on' : 'off'}
				>Recently Seen</Toggle>
			</div>
	</li>
	<li>
</ul>
