<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import {
		Badge,
		ImagePlaceholder,
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

	import { faLightbulb, faServer } from '@fortawesome/free-solid-svg-icons';
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
</script>

<h3
	class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
>
	Configurations
	<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
		Below is a list of unique server configurations we have observed over time. It includes their
		minimum prices and the dates the configurations (but not the price) were last seen. Keep in mind
		that this is not equal to the total number of servers that were offered, which is usually much
		higher. You can see the bid volume in the chart above.
	</p>
</h3>
<Table hoverable={true}>
	<TableHead>
		<TableHeadCell>Lowest Price</TableHeadCell>
		<TableHeadCell>per GB RAM</TableHeadCell>
		<TableHeadCell>per TB SSD</TableHeadCell>
		<TableHeadCell>per TB HDD</TableHeadCell>
		<TableHeadCell>CPU</TableHeadCell>
		<TableHeadCell>RAM Size</TableHeadCell>
		<TableHeadCell>Storage</TableHeadCell>
		<TableHeadCell>Extras</TableHeadCell>
		<TableHeadCell>Last Seen</TableHeadCell>
	</TableHead>
	<TableBody>
		{#if loading}
			<TableBodyRow>
				<TableBodyCell colspan="10" style="background-color: initial; color: inherit"
					>Loading data…</TableBodyCell
				>
			</TableBodyRow>
		{:else if data.length === 0}
			<TableBodyRow>
				<TableBodyCell colspan="10" style="background-color: initial; color: inherit"
					>No servers matching configuration found.</TableBodyCell
				>
			</TableBodyRow>
		{:else}
			<TableBodyRow>
				<TableBodyCell colspan="10" style="background-color: initial; color: inherit"
					>We have observed {data.length} unique server configurations matching your criteria.</TableBodyCell
				>
			</TableBodyRow>
			{#each data as device, i}
				<TableBodyRow on:click={() => toggleRow(i)} class="cursor-pointer">
					<TableBodyCell>€{device.min_price}</TableBodyCell>
					<TableBodyCell>€{(device.min_price / device.ram_size).toFixed(2)}</TableBodyCell>
					<TableBodyCell
						>€{pricePerTB(device.min_price, device.nvme_size + device.sata_size)}</TableBodyCell
					>
					<TableBodyCell>€{pricePerTB(device.min_price, device.hdd_size)}</TableBodyCell>
					<TableBodyCell>{device.cpu}</TableBodyCell>
					<TableBodyCell>{device.ram_size}GB</TableBodyCell>
					<TableBodyCell>
						<ul>
							{#each JSON.parse(device.hdd_arr) as drive}
								<li>{drive}</li>
							{/each}
						</ul>
					</TableBodyCell>
					<TableBodyCell>
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
					<TableBodyCell>
						{dayjs.unix(device.last_seen).fromNow()}<br />
						<span class="light-gray text-xs"
							>{dayjs.unix(device.last_seen).format('DD.MM.YYYY HH:mm')}</span
						>
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
												{#each JSON.parse(detail.information) as config}
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
