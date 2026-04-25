<script lang="ts">
	import { browser } from '$app/environment';
	import type { ServerConfiguration } from '$lib/api/frontend/filter';
	import ServerCard from './ServerCard.svelte';
	import ServerListRow from './ServerListRow.svelte';
	import { Alert, Badge } from 'flowbite-svelte';
	import { InfoCircleSolid } from 'flowbite-svelte-icons';

	type GroupedServerList = Array<{ groupName: string; servers: ServerConfiguration[] }>;

	interface _$Props {
		groupedList: GroupedServerList;
		timeUnitPrice?: 'perHour' | 'perMonth';
		viewMode?: 'grid' | 'list';
	}

	let {
		groupedList = [],
		timeUnitPrice = 'perHour' as const,
		viewMode = 'grid'
	} = $props();

	let totalServers = $derived(
		groupedList.reduce(
			(sum: number, group: { servers: ServerConfiguration[] }) => sum + group.servers.length,
			0
		)
	);

	function getConfigKey(config: ServerConfiguration, index: number): string {
		return `${config.cpu}-${config.ram_size}-${config.nvme_size ?? 0}-${config.sata_size ?? 0}-${config.hdd_size ?? 0}-${config.price ?? 0}-${index}`;
	}
</script>

{#if browser}
	{#if totalServers === 0}
		<Alert color="blue" class="mx-5 mb-5">
			<InfoCircleSolid slot="icon" class="h-4 w-4" />
			<span class="font-medium">No Results:</span> No server configurations match your current filter
			criteria. Try adjusting the filters.
		</Alert>
	{:else if viewMode === 'list'}
		<!-- Single grid for ALL groups so columns align across the entire list (subgrid). Below xl, fall back to per-group card grids since the table would overflow. -->
		<div
			class="mb-5 hidden w-full gap-x-6 gap-y-1.5 px-5 xl:grid"
			style="grid-template-columns: max-content 76px 84px 150px 96px auto 1fr 116px;"
		>
			{#each groupedList as group (group.groupName)}
				{#if group.servers.length > 0}
					<h2
						class="sticky top-0 z-10 -mx-5 mt-3 mb-1 flex items-center gap-2 bg-white px-5 py-2 text-lg font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300"
						style="grid-column: 1 / -1;"
					>
						<span>{group.groupName}</span>
						<Badge color="dark" rounded class="text-xs">{group.servers.length}</Badge>
					</h2>
					{#each group.servers.slice(0, 100) as config, index (getConfigKey(config, index))}
						<ServerListRow {config} {timeUnitPrice} />
					{/each}
				{/if}
			{/each}
		</div>
		<!-- Card-grid fallback for viewports too narrow to fit the list -->
		<div class="xl:hidden">
			{#each groupedList as group (group.groupName)}
				{#if group.servers.length > 0}
					<div class="mb-5 px-5">
						<h2
							class="sticky top-0 z-10 -mx-5 mb-3 flex items-center gap-2 bg-white px-5 py-2 text-lg font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300"
						>
							<span>{group.groupName}</span>
							<Badge color="dark" rounded class="text-xs">{group.servers.length}</Badge>
						</h2>
						<div
							class="grid w-full grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-stretch gap-4"
						>
							{#each group.servers.slice(0, 100) as config, index (getConfigKey(config, index))}
								<ServerCard
									{config}
									loading={false}
									{timeUnitPrice}
									displayStoragePrice={undefined}
									displayRamPrice={undefined}
								/>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{:else}
		{#each groupedList as group (group.groupName)}
			{#if group.servers.length > 0}
				<div class="mb-5 px-5">
					<h2
						class="sticky top-0 z-10 -mx-5 mb-3 flex items-center gap-2 bg-white px-5 py-2 text-lg font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300"
					>
						<span>{group.groupName}</span>
						<Badge color="dark" rounded class="text-xs">{group.servers.length}</Badge>
					</h2>
					<div
						class="grid w-full grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-stretch gap-4"
					>
						{#each group.servers.slice(0, 100) as config, index (getConfigKey(config, index))}
							<ServerCard
								{config}
								loading={false}
								{timeUnitPrice}
								displayStoragePrice={undefined}
								displayRamPrice={undefined}
							/>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{/if}
{/if}
