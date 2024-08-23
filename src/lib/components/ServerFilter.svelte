<script lang="ts">
	import type { NameValuePair, ServerFilter } from '$lib/dbapi';
	import RangeSlider from "svelte-range-slider-pips";
	import { faBoxesStacked, faGlobe, faHardDrive, faMemory, faMicrochip, faShareNodes, faTags } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { filesize, type FileSizeOptions } from 'filesize';
	import { Label, Tooltip } from 'flowbite-svelte';
	import { MultiSelect } from 'flowbite-svelte';
	import { Toggle } from 'flowbite-svelte';
	import { ButtonGroup, Button } from 'flowbite-svelte';
	import queryString from 'query-string';

	const filesizeOptions: FileSizeOptions = {
		base: 2,
		round: 0
	};

	const springValues = {
		stiffness: 1,
		damping: 1,
	};

	export let filter: ServerFilter;
	export let datacenters: NameValuePair[];
	export let cpuModels: NameValuePair[];

	function generateShareLink(filter: ServerFilter) {
		console.log("click")
		const queryStringified = queryString.stringify(filter, {
			arrayFormat: "bracket",
			skipNull: true,
		});
		// copy to clipboard
		console.log(queryStringified);
		navigator.clipboard.writeText(window.location.origin + window.location.pathname + '#' + queryStringified);
	}

	$: ramSizeLower = filesize(
		Math.pow(2, filter.ramInternalSize[0]) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ramSizeUpper = filesize(
		Math.pow(2, filter.ramInternalSize[1]) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ssdNvmeSizeLower = filesize(
		Math.pow(2, filter.ssdNvmeInternalSize[0]) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ssdNvmeSizeUpper = filesize(
		Math.pow(2, filter.ssdNvmeInternalSize[1]) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ssdSataSizeLower = filesize(
		Math.pow(2, filter.ssdSataInternalSize[0]) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ssdSataSizeUpper = filesize(
		Math.pow(2, filter.ssdSataInternalSize[1]) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: hddSizeLower = filesize(
		Math.pow(2, filter.hddInternalSize[0]) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: hddSizeUpper = filesize(
		Math.pow(2, filter.hddInternalSize[1]) * Math.pow(1024, 3),
		filesizeOptions
	);
</script>

<style>
	:root {
	  --tw-primary-600: theme('colors.primary.600');
	}

	:root {
	  --range-handle-inactive: var(--tw-primary-600);
	  --range-handle: var(--tw-primary-600);
	  --range-handle-focus: var(--tw-primary-600);
	  --range-handle-border: var(--tw-primary-600);
	}
</style>

<aside
	class="border-r border-gray-200 dark:border-gray-700 dark:bg-gray-800 overflow-y-auto"
>
	<div class="h-full bg-white px-3 py-2 dark:bg-gray-800">
		<!-- float right-->
		<ul class="space-y-2 font-medium">
			<li class="flex justify-between items-center">
				<h2><FontAwesomeIcon
					class="w-4 h-4 me-1"
					icon={faGlobe}
				/> Location</h2>
				<Tooltip triggeredBy="#share-filter" placement="bottom" trigger="hover">Copy link to clipboard</Tooltip>
				<button
					id="share-filter"
					class="ml-2 text-right p-2 rounded cursor-pointer hover:scale-110 active:scale-95 transition transform duration-150 ease-in-out"
					on:click={() => generateShareLink(filter)}
					aria-label="Share Filter"
				>
					<FontAwesomeIcon
						class="w-5 h-5 text-black dark:text-white transition-colors duration-150 ease-in-out"
						icon={faShareNodes}
					/>
				</button>
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
				<span class="ml-2 text-right">{ramSizeLower} – {ramSizeUpper}</span>
			</li>
			<li>
				<RangeSlider bind:values={filter.ramInternalSize} min={4} max={10} hoverable={false} {springValues} pips />
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
				<span class="ml-2 text-right">{filter.ssdNvmeCount[0]} – {filter.ssdNvmeCount[1]}</span>
			</li>
			<li>
				<RangeSlider bind:values={filter.ssdNvmeCount} min={0} max={5} hoverable={false} {springValues} pips />
			</li>
			<li class="flex justify-between">
				<Label class="text-sm">Size</Label>
				<span class="ml-2 text-right">{ssdNvmeSizeLower} – {ssdNvmeSizeUpper}</span>
			</li>
			<li>
				<RangeSlider bind:values={filter.ssdNvmeInternalSize} min={8} max={14} hoverable={false} {springValues} pips />
			</li>
			<li>
				<h3>SSDs (SATA)</h3>
			</li>
			<li class="flex justify-between">
				<Label class="text-sm">Devices</Label>
				<span class="ml-2 text-right">{filter.ssdSataCount[0]} – {filter.ssdSataCount[1]}</span>
			</li>
			<li>
				<RangeSlider bind:values={filter.ssdSataCount} min={0} max={5} hoverable={false} {springValues} pips />
			</li>
			<li class="flex justify-between">
				<Label class="text-sm">Size</Label>
				<span class="ml-2 text-right">{ssdSataSizeLower} – {ssdSataSizeUpper}</span>
			</li>
			<li>
				<RangeSlider bind:values={filter.ssdSataInternalSize} min={8} max={14} hoverable={false} {springValues} pips />
			</li>
			<li>
				<h3>HDDs</h3>
			</li>
			<li class="flex justify-between">
				<Label class="text-sm">Devices</Label>
				<span class="ml-2 text-right">{filter.hddCount[0]} – {filter.hddCount[1]}</span>
			</li>
			<li>
				<RangeSlider bind:values={filter.hddCount} min={0} max={5} hoverable={false} {springValues} pips />
			</li>
			<li class="flex justify-between">
				<Label class="text-sm">HDD Size</Label>
				<span class="ml-2 text-right">{hddSizeLower} – {hddSizeUpper}</span>
			</li>
			<li>
				<RangeSlider bind:values={filter.hddInternalSize} min={8} max={14} hoverable={false} {springValues} pips />
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
		</ul>
	</div>
</aside>
