<script lang="ts">
	import { Select, ButtonGroup, Button, InputAddon } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowUp, faArrowDown, faSort } from '@fortawesome/free-solid-svg-icons';

	type SortField = 'price' | 'ram' | 'storage';

	let { sortField = $bindable('price'), sortDirection = $bindable('asc') } = $props<{
		sortField?: SortField;
		sortDirection?: 'asc' | 'desc';
	}>();

	const sortFields: { value: SortField; name: string }[] = [
		{ value: 'price', name: 'Price' },
		{ value: 'ram', name: 'RAM' },
		{ value: 'storage', name: 'Storage' }
	];
</script>

<div class="flex items-center">
	<ButtonGroup size="xs" class="divide-x divide-gray-300 dark:divide-gray-600 font-semibold">
		<InputAddon size="sm" class="bg-gray-50 text-gray-900 border-r-0 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
			<FontAwesomeIcon
				icon={faSort}
				class="mr-2"
			/>Sort by
		</InputAddon>
		<Select
			id="sort-field"
			items={sortFields}
			bind:value={sortField}
			class="w-[95px] rounded-none bg-white text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			size="sm"
		/>
		<Button
			size="xs"
			color="light"
			onclick={() => (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')}
			class="px-3"
		>
			{#if sortDirection === 'asc'}
				<FontAwesomeIcon icon={faArrowUp}/>
			{:else}
				<FontAwesomeIcon icon={faArrowDown} />
			{/if}
		</Button>
	</ButtonGroup>
</div>