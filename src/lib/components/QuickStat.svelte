<script lang="ts">
	import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	interface _$Props {
		icon?: IconDefinition;
		title?: string;
		value?: string | number | null;
		subtitle?: string;
		valueClass?: string;
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		'data-testid'?: string;
	}

	let {
		icon,
		title = '',
		value = null,
		subtitle = '',
		valueClass = 'text-gray-900 dark:text-white',
		size = 'md',
		loading = false,
		'data-testid': testId
	} = $props();

	let formattedValue = $derived(
		typeof value === 'number' ? (Number.isNaN(value) ? 'N/A' : value.toString()) : value
	);
</script>

<div
	class="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 {size === 'sm' ? 'p-3' : size === 'lg' ? 'p-5' : 'p-4'} flex flex-col"
	data-testid={testId}
>
	<div class="flex items-center {size === 'sm' ? 'mb-2' : 'mb-3'}">
		{#if icon}
			<div class="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
				<FontAwesomeIcon
					{icon}
					class="{size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-primary-600 dark:text-primary-400"
				/>
			</div>
		{/if}
		<h3 class="{size === 'sm' ? 'text-xs' : 'text-sm'} font-medium text-gray-600 dark:text-gray-400">
			{title}
		</h3>
	</div>
	{#if value !== null && !loading}
		<p class="{size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl'} font-semibold tabular-nums {valueClass}">
			{formattedValue}
		</p>
		<p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
			{subtitle}
		</p>
	{:else}
		<div class="{size === 'sm' ? 'h-5 w-14' : 'h-6 w-16'} mb-1 mt-1 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800"></div>
		<div class="{size === 'sm' ? 'h-2 w-20' : 'h-3 w-24'} animate-pulse rounded-md bg-gray-100 dark:bg-gray-800"></div>
	{/if}
</div>
