<script lang="ts">
	import {
		Table,
		TableHead,
		TableHeadCell,
		TableBody,
		TableBodyRow,
		TableBodyCell
	} from 'flowbite-svelte';

	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';

	dayjs.extend(relativeTime);

	export let data;
	export let loading;

	function pricePerTB(price: number, capacity: number) {
		return capacity > 0 ? (price / (capacity / 1000)).toFixed(2) : 0;
	}
</script>


<h3
class="px-5 pb-5 text-lg font-semibold text-left text-gray-900 bg-white dark:text-white dark:bg-gray-800"
>
Configurations
<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
    Below is a list of unique server configurations we have observed over time. It includes their minimum prices and the dates the configurations (but not the price) were last seen. Keep in mind that this is not equal to the total number of servers that were offered, which is usually much higher. You can see the bid volume in the chart above.
</p>
</h3>
<Table>
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
			<TableBodyCell colspan="10">Loading data…</TableBodyCell>
		</TableBodyRow>
		{:else if data.length === 0}
        <TableBodyRow>
            <TableBodyCell colspan="10">No servers matching configuration found.</TableBodyCell>
        </TableBodyRow>
        {:else}
        <TableBodyRow>
            <TableBodyCell colspan="10">We have observed {data.length} unique server configurations matching your criteria.</TableBodyCell>
        </TableBodyRow>
        {#each data as device}
			<TableBodyRow>
				<TableBodyCell>€{device.min_price}</TableBodyCell>
				<TableBodyCell>€{(device.min_price / device.ram_size).toFixed(2)}</TableBodyCell>
				<TableBodyCell>€{pricePerTB(device.min_price, device.nvme_size + device.sata_size)}</TableBodyCell>
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
		{/each}
        {/if}
	</TableBody>
</Table>
