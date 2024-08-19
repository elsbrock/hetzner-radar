<script lang="ts">
	import type { NameValuePair, ServerFilter } from '$lib/dbapi';
	import { faShareNodes } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { filesize, type FileSizeOptions } from 'filesize';
	import { Label, Tooltip } from 'flowbite-svelte';
	import { Range } from 'flowbite-svelte';
	import { MultiSelect } from 'flowbite-svelte';
	import { Toggle } from 'flowbite-svelte';
	import { ButtonGroup, Button } from 'flowbite-svelte';
	import queryString from 'query-string';

	const filesizeOptions: FileSizeOptions = {
		base: 2,
		round: 0
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
		Math.pow(2, filter.ramInternalSizeLower) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ramSizeUpper = filesize(
		Math.pow(2, filter.ramInternalSizeUpper) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ssdNvmeSizeLower = filesize(
		Math.pow(2, filter.ssdNvmeInternalSizeLower) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ssdNvmeSizeUpper = filesize(
		Math.pow(2, filter.ssdNvmeInternalSizeUpper) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ssdSataSizeLower = filesize(
		Math.pow(2, filter.ssdSataInternalSizeLower) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: ssdSataSizeUpper = filesize(
		Math.pow(2, filter.ssdSataInternalSizeUpper) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: hddSizeLower = filesize(
		Math.pow(2, filter.hddInternalSizeLower) * Math.pow(1024, 3),
		filesizeOptions
	);
	$: hddSizeUpper = filesize(
		Math.pow(2, filter.hddInternalSizeUpper) * Math.pow(1024, 3),
		filesizeOptions
	);
</script>

<aside
	class="border-r border-gray-200 dark:border-gray-700 dark:bg-gray-800 overflow-y-auto"
>
	<div class="h-full bg-white px-3 py-2 dark:bg-gray-800">
		<!-- float right-->
		<ul class="space-y-2 font-medium">
			<li class="flex justify-between items-center">
				<h2>Location</h2>
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
			<li><h2>Datacenter</h2></li>
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
				<h2>CPU</h2>
			</li>
			<li><Label>Vendor</Label></li>
			<li>
				<Toggle bind:checked={filter.cpuIntel} value={filter.cpuIntel ? 'on' : 'off'}>Intel</Toggle>
			</li>
			<li>
				<Toggle bind:checked={filter.cpuAMD} value={filter.cpuAMD ? 'on' : 'off'}>AMD</Toggle>
			</li>
			<!-- <li class="flex justify-between">
            <Label>Count</Label>
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
				<h2>Memory</h2>
			</li>
			<li class="flex justify-between">
				<Label>Size</Label>
				<span class="ml-2 text-right">{ramSizeLower} – {ramSizeUpper}</span>
			</li>
			<li>
				<Range min="4" max="10" bind:value={filter.ramInternalSizeLower} />
				<Range min="4" max="10" bind:value={filter.ramInternalSizeUpper} />
			</li>
			<li>
				<div class="flex items-center justify-between">
					<Label>ECC</Label>
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
				<h2>Disks</h2>
			</li>
			<li>
				<h3>SSDs (NVMe)</h3>
			</li>
			<li class="flex justify-between">
				<Label>Devices</Label>
				<span class="ml-2 text-right">{filter.ssdNvmeCountLower} – {filter.ssdNvmeCountUpper}</span>
			</li>
			<li>
				<Range min="0" max="5" bind:value={filter.ssdNvmeCountLower} step="1" />
				<Range min="0" max="5" bind:value={filter.ssdNvmeCountUpper} step="1" />
			</li>
			<li class="flex justify-between">
				<Label>Size</Label>
				<span class="ml-2 text-right">{ssdNvmeSizeLower} – {ssdNvmeSizeUpper}</span>
			</li>
			<li>
				<Range min="8" max="14" bind:value={filter.ssdNvmeInternalSizeLower} step="1" />
				<Range min="8" max="14" bind:value={filter.ssdNvmeInternalSizeUpper} step="1" />
			</li>
			<li>
				<h3>SSDs (SATA)</h3>
			</li>
			<li class="flex justify-between">
				<Label>Devices</Label>
				<span class="ml-2 text-right">{filter.ssdSataCountLower} – {filter.ssdSataCountUpper}</span>
			</li>
			<li>
				<Range min="0" max="5" bind:value={filter.ssdSataCountLower} step="1" />
				<Range min="0" max="5" bind:value={filter.ssdSataCountUpper} step="1" />
			</li>
			<li class="flex justify-between">
				<Label>Size</Label>
				<span class="ml-2 text-right">{ssdSataSizeLower} – {ssdSataSizeUpper}</span>
			</li>
			<li>
				<Range min="8" max="14" bind:value={filter.ssdSataInternalSizeLower} step="1" />
				<Range min="8" max="14" bind:value={filter.ssdSataInternalSizeUpper} step="1" />
			</li>
			<li>
				<h3>HDDs</h3>
			</li>
			<li class="flex justify-between">
				<Label>Devices</Label>
				<span class="ml-2 text-right">{filter.hddCountLower} – {filter.hddCountUpper}</span>
			</li>
			<li>
				<Range min="0" max="5" bind:value={filter.hddCountLower} step="1" />
				<Range min="0" max="5" bind:value={filter.hddCountUpper} step="1" />
			</li>
			<li class="flex justify-between">
				<Label>HDD Size</Label>
				<span class="ml-2 text-right">{hddSizeLower} – {hddSizeUpper}</span>
			</li>
			<li>
				<Range min="8" max="15" bind:value={filter.hddInternalSizeLower} step="1" />
				<Range min="8" max="15" bind:value={filter.hddInternalSizeUpper} step="1" />
			</li>
			<li>
				<hr />
			</li>
			<li>
				<h2>Extras</h2>
			</li>
			<li>
				<div class="flex items-center justify-between">
					<Label>Intel NIC</Label>
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
					<Label>Hardware RAID</Label>
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
					<Label>GPU</Label>
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
		</ul>
	</div>
</aside>
