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
		TableHeadCell
	} from 'flowbite-svelte';

	import type { ServerConfiguration, ServerDetail, ServerPriceStat } from '$lib/dbapi';

	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { slide } from 'svelte/transition';
	import ServerPriceChart from './ServerPriceChart.svelte';
	dayjs.extend(relativeTime);

	export let data: ServerConfiguration[] = [];
	export let serverDetails: null | ServerDetail[] = null;
	export let serverDetailPrices: null | ServerPriceStat[] = null;
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
		<TableHeadCell>RAM Info</TableHeadCell>
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
							{#each JSON.parse(device.ram) as ram}
								<li>{ram}</li>
							{/each}
						</ul>
					</TableBodyCell>
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
					<TableBodyCell>{dayjs.unix(device.last_seen).fromNow()}</TableBodyCell>
				</TableBodyRow>
				{#if openRow === i}
					<TableBodyRow style="background-color: initial; color: inherit">
						<TableBodyCell colspan="10" class="border-l-8 border-l-[5px] p-1">
							<div class="grid grid-cols-[500px_1fr]">
								{#if serverDetails === null}
									<div class="px-2 py-3" transition:slide={{ duration: 300, axis: 'y' }}>
										<ImagePlaceholder />
									</div>
								{:else if serverDetails.length === 0}
									<p><strong>Error:</strong> Could not find server details.</p>
								{:else}
									<div class="height: 200px">
										<ServerPriceChart data={serverDetailPrices} loading={false} />
									</div>
									<div>
										<h3>Details</h3>
										{#each serverDetails as detail}
											{#each JSON.parse(detail.information) as config}
												<p>{config}</p>
												{/each}
											{#if serverDetailAverageVolume < 5}
												<Badge>rare</Badge>
											{/if}
											{#if detail.fixed_price}
												<Badge color="blue">fixed price</Badge>
											{/if}
										{/each}
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
