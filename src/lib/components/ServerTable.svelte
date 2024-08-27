<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import {
		Badge,
		Button,
		ImagePlaceholder,
		Indicator,
		Modal,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Timeline,
		TimelineItem
	} from 'flowbite-svelte';

	import type { ServerConfiguration, ServerDetail, ServerPriceStat, ServerLowestPriceStat	} from '$lib/dbapi';

	import { faHardDrive, faLightbulb, faLink, faMemory, faMicrochip, faServer, faShare } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import ServerPriceChart from './ServerPriceChart.svelte';
	dayjs.extend(relativeTime);

	export let data: ServerConfiguration[] = [];
	export let serverDetails: null | ServerDetail[] = null;
	export let serverDetailPrices: null | ServerPriceStat[] = null;
	export let lowestServerDetailPrices: null | ServerLowestPriceStat[] = null;
	export let loading: boolean = true;

	function pricePerTB(price: number, capacity: number) {
		return capacity > 0 ? (price / (capacity / 1000)).toFixed(2) : 0;
	}

	function getAverageSupply(serverDetailPrices: null | ServerPriceStat[]) {
		if (serverDetailPrices === null) {
			return 0;
		}
		return (
			serverDetailPrices.reduce((acc, curr) => acc + curr.count, 0) / serverDetailPrices.length
		);
	}

	function getHetznerLink(device: ServerConfiguration) {
		const minDriveLength = Math.min(
			device.nvme_size ? device.nvme_size / device.nvme_drives.length : Infinity,
			device.sata_size ? device.sata_size / device.sata_drives.length : Infinity,
			device.hdd_size ? device.hdd_size / device.hdd_drives.length : Infinity
		);
		const maxDriveLength = Math.max(
			device.nvme_size ? device.nvme_size / device.nvme_drives.length : 0,
			device.sata_size ? device.sata_size / device.sata_drives.length : 0,
			device.hdd_size ? device.hdd_size / device.hdd_drives.length : 0
		);
		const specials = [];
		if (device.with_inic) {
			specials.push("iNIC");
		}
		if (device.with_hwr) {
			specials.push("HWR");
		}
		if (device.with_gpu) {
			specials.push("GPU");
		}
		if (device.with_rps) {
			specials.push("RPS");
		}

		const filterQ = [
			`search=${encodeURIComponent(device.cpu)}`,
			`ram_from=${device.ram_size}`,
			`ram_to=${device.ram_size}`,
			`drives_count_from=${device.nvme_drives.length + device.sata_drives.length + device.hdd_drives.length}`,
		];

		if (minDriveLength < Infinity) {
			filterQ.push(`drives_size_from=${Math.floor(minDriveLength/500) * 500}`);
		}
		if (maxDriveLength > 0) {
			filterQ.push(`drives_size_to=${Math.floor(minDriveLength/500) * 500}`);
		}
		if (device.is_ecc) {
			filterQ.push("ecc=true");
		}
		if (specials.length > 0) {
			filterQ.push(`additional=${encodeURIComponent(specials.join("+"))}`);
		}

		return `https://www.hetzner.com/sb/#${filterQ.join("&")}`;
	}

	$: serverDetailAverageVolume = getAverageSupply(serverDetailPrices);
	$: if (data) {
		openRow = null;
		serverDetails = null;
		serverDetailPrices = null;
	}

	const dispatch = createEventDispatcher();
	let openRow: number | null = null;
	const toggleRow = (i: number) => {
		openRow = openRow === i ? null : i;
		serverDetails = null;
		dispatch('serverDetails', i);
	};

	// null: no longer open the modal
	let clickOutsideModal: null | boolean = false;
	let forwardUrl: string;
</script>

<Modal title="Before You Go…" bind:open={clickOutsideModal} autoclose outsideclose>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		You will be forwarded to a preconfigured Hetzner Server Auction search.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		Please note that this search may return multiple results or none, depending
		on availability. Ensure that the server specifications meet your needs.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400 font-semibold">
		Also, prices shown on Server Radar exclude VAT, which varies by country.
		Hetzner typically includes VAT automatically, so the final price will be
		higher if you're within the European Union.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		This disclaimer will only show once per session.
	</p>
	<svelte:fragment slot="footer">
		<Button on:click={() => {
			clickOutsideModal = null;
		}} href={forwardUrl}>
			I understand, take me there
		</Button>
	</svelte:fragment>
</Modal>

<Table hoverable={true}>
	<TableHead>
		<TableHeadCell padding="px-2 py-3">Last Price</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">Lowest Price</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">per GB RAM</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">per TB SSD</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">per TB HDD</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">CPU</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">RAM Size</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">Storage</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">Extras</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">Last Seen</TableHeadCell>
		<TableHeadCell padding="px-2 py-3">Link</TableHeadCell>
	</TableHead>
	<TableBody>
		{#if loading}
			<TableBodyRow>
				<TableBodyCell colspan="11" style="background-color: initial; color: inherit"
					>Loading data…</TableBodyCell
				>
			</TableBodyRow>
		{:else if data.length === 0}
			<TableBodyRow>
				<TableBodyCell colspan="11" style="background-color: initial; color: inherit"
					>No servers matching configuration found.</TableBodyCell
				>
			</TableBodyRow>
		{:else}
			<TableBodyRow>
				<TableBodyCell colspan="11" style="background-color: initial; color: inherit"
					>We have observed {data.length} unique server configurations matching your criteria.</TableBodyCell
				>
			</TableBodyRow>
			{#each data as device, i}
				<TableBodyRow on:click={() => toggleRow(i)} class="cursor-pointer">
					<TableBodyCell padding="px-2 py-3">
						{#if device.markup_percentage > 0}
						<div class="font-medium items-center text-center justify-center px-2.5 py-0.5 bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 rounded text-sm">
							{device.last_price}€<br/>
							<span 
							  class="light-gray text-xs"
							  style={`color: hsl(${Math.max(0, Math.min(120, 120 * (10 - device.markup_percentage) / 10))}, 70%, 50%);`}
							>
							  {device.markup_percentage > 0 ? '+' : ''}{device.markup_percentage}%
							</span>
						  </div>
						{:else}
							{#if dayjs.unix(device.last_seen) > dayjs().subtract(1, 'day')}
							<div class="font-medium items-center text-center justify-center px-2.5 py-0.5 bg-green-100 dark:bg-green-900 rounded text-sm">
								{device.last_price}€<br/>
								<span class="light-gray text-xs">best</span>
							</div>
							{:else}
							<div class="font-medium items-center text-center justify-center px-2.5 py-0.5 border-yellow-800 bg-yellow-100 dark:bg-neutral-900 rounded text-sm">
								{device.last_price}€<br/>
								<span class="light-gray text-xs">gone</span>
							</div>
							{/if}
						{/if}
					</TableBodyCell>
					<TableBodyCell padding="px-2 py-3">
						{device.min_price}€<br/>
					</TableBodyCell>
					<TableBodyCell padding="px-2 py-3">€{(device.min_price / device.ram_size).toFixed(2)}</TableBodyCell>
					<TableBodyCell
						>€{pricePerTB(device.min_price, device.nvme_size + device.sata_size)}</TableBodyCell
					>
					<TableBodyCell padding="px-2 py-3">€{pricePerTB(device.min_price, device.hdd_size)}</TableBodyCell>
					<TableBodyCell padding="px-2 py-3"><FontAwesomeIcon icon={faMicrochip} class="me-1" />{device.cpu}</TableBodyCell>
					<TableBodyCell padding="px-2 py-3"><FontAwesomeIcon icon={faMemory} class="me-1" />{device.ram_size} GB</TableBodyCell>
					<TableBodyCell padding="px-2 py-3">
						<ul>
							{#each device.hdd_arr as drive}
								<li><FontAwesomeIcon icon={faHardDrive} class="me-1" />{drive}</li>
							{/each}
						</ul>
					</TableBodyCell>
					<TableBodyCell padding="px-2 py-3">
						<ul>
							{#if device.with_inic}
								<li>Intel NIC</li>
							{/if}
							{#if device.with_hwr}
								<li>Hardware RAID</li>
							{/if}
							{#if device.with_gpu}
								<li>GPU</li>
							{/if}
						</ul>
					</TableBodyCell>
					<TableBodyCell padding="px-2 py-3">
						<span class="inline-flex items-center">
							{#if dayjs.unix(device.last_seen) > dayjs().subtract(1, 'day')}
								<Indicator color="green" class="mr-2" />
							{:else}
								<Indicator color="red" class="mr-2" />
							{/if}
							{dayjs.unix(device.last_seen).fromNow()}
						</span>
						<br />
						<span class="light-gray text-xs">
							{dayjs.unix(device.last_seen).format('DD.MM.YYYY HH:mm')}
						</span>
					</TableBodyCell>
					<TableBodyCell padding="px-2 py-3">
						<Button
							on:click={() => {
								forwardUrl = getHetznerLink(device);
								if (clickOutsideModal === false) {
									clickOutsideModal = true;
								} else {
									window.location.href = forwardUrl;
								}
							}}
							size="sm" variant="primary"
						>
							<FontAwesomeIcon icon={faLink} class="me-2" />Find
						</Button>
					</TableBodyCell>
				</TableBodyRow>
				{#if openRow === i}
					<TableBodyRow style="background-color: initial; color: inherit">
						<TableBodyCell colspan="9" class="border-l-8 border-l-[5px] p-1">
							<div
								class="y-overflow grid grid-cols-[1fr_2fr_2fr] gap-3 p-3 pr-3 md:grid-cols-[1fr_2fr_3fr]"
							>
								{#if serverDetails === null}
									<div class="px-2 py-3">
										<ImagePlaceholder />
									</div>
								{:else if serverDetails.length === 0}
									<p><strong>Error:</strong> Could not find server details.</p>
								{:else}
									<div>
										<div class="mb-2 text-base">
											<FontAwesomeIcon class="h-4 w-4" icon={faLightbulb} />
											Smart Price Insights
										</div>
										<Timeline>
											{#each lowestServerDetailPrices as lowestPrice}
												<TimelineItem
													classLi="text-base mb-2"
													title="{lowestPrice.price} €"
													date={dayjs.unix(lowestPrice.seen).format('YYYY-MM-DD HH:mm')}
												/>
											{/each}
											{#if lowestServerDetailPrices.length === 0}
												<TimelineItem
													classLi="text-base mb-2"
													title="{device.min_price} €"
													date={dayjs.unix(device.last_seen).format('YYYY-MM-DD HH:mm')}
												/>
											{/if}
										</Timeline>
									</div>
									<div>
										{#each serverDetails as detail, i}
											<p class="flex items-center justify-between">
												<span class="mb-2 text-base">
													<FontAwesomeIcon class="me-1 h-4 w-4" icon={faServer} />
													Configuration #{i + 1}
												</span>
												<span class="flex space-x-2">
													{#if serverDetailAverageVolume < 5}
														<Badge>rare</Badge>
													{/if}
												</span>
											</p>
											<ul class="ml-4 list-inside list-disc pb-4">
												{#each detail.information as config}
													<li>{config}</li>
												{/each}
											</ul>
										{/each}
									</div>
									<div>
										<ServerPriceChart data={serverDetailPrices} loading={false} />
									</div>
								{/if}
							</div>
						</TableBodyCell>
					</TableBodyRow>
				{/if}
			{/each}
		{/if}
	</TableBody>
</Table>
