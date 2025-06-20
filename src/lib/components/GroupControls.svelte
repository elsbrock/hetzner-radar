<script lang="ts">
	import { Select, ButtonGroup, InputAddon } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faSort } from '@fortawesome/free-solid-svg-icons';

	// Define the type for grouping options
	type GroupByField = 'none' | 'cpu_vendor' | 'cpu_model' | 'best_price'; // Updated type

	// Define the grouping options array
	const groupByFields: { value: GroupByField; name: string }[] = [
		{ value: 'none', name: 'None' },
		{ value: 'cpu_vendor', name: 'CPU Vendor' },
		{ value: 'cpu_model', name: 'CPU Model' },
		{ value: 'best_price', name: 'Best Price' } // Updated option
	];

	// Define the props interface
	interface $$Props {
		groupByField?: GroupByField;
	}

	// Destructure props using $props and $bindable
	let { groupByField = $bindable('none') } = $props();
</script>

<div class="flex items-center">
	<ButtonGroup size="xs" class="divide-x divide-gray-300 font-semibold dark:divide-gray-600">
		<InputAddon
			size="sm"
			class="border-r-0 bg-gray-50 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
		>
			<FontAwesomeIcon icon={faSort} class="mr-2" />Group by
		</InputAddon>
		<Select
			id="group-by-field"
			items={groupByFields}
			bind:value={groupByField}
			class="w-[120px] rounded-none rounded-r-lg bg-white text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
			size="sm"
		/>
		<!-- No direction button needed for grouping -->
	</ButtonGroup>
</div>
