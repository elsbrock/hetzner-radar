<script lang="ts">
	import { browser } from '$app/environment'; // Import browser
	import type { ServerConfiguration } from '$lib/api/frontend/filter'; // Corrected import path
	import ServerCard from './ServerCard.svelte';
	import { Alert, Badge } from 'flowbite-svelte'; // Import Badge
	import { InfoCircleSolid } from 'flowbite-svelte-icons';

	// Define the grouped list type locally
	type GroupedServerList = Array<{ groupName: string; servers: ServerConfiguration[] }>;

	interface _$Props {
		groupedList: GroupedServerList;
		timeUnitPrice?: 'perHour' | 'perMonth';
	}

	let { groupedList = [], timeUnitPrice = 'perHour' as const } = $props();

	// Calculate total servers based on the passed groupedList
	let totalServers = $derived(
		groupedList.reduce(
			(sum: number, group: { servers: ServerConfiguration[] }) => sum + group.servers.length,
			0
		)
	);

	// Generate a fast unique key for a server config
	function getConfigKey(config: ServerConfiguration, index: number): string {
		return `${config.cpu}-${config.ram_size}-${config.nvme_size ?? 0}-${config.sata_size ?? 0}-${config.hdd_size ?? 0}-${config.price ?? 0}-${index}`;
	}
</script>

<!-- Only render the list content on the client-side to potentially avoid hydration issues -->
{#if browser}
	{#if totalServers === 0}
		<Alert color="blue" class="mx-5 mb-5">
			<InfoCircleSolid slot="icon" class="h-4 w-4" />
			<span class="font-medium">No Results:</span> No server configurations match your current filter
			criteria. Try adjusting the filters.
		</Alert>
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
