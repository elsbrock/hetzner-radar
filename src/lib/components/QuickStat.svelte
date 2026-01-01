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

	// Format the value if it's a number
	let formattedValue = $derived(
		typeof value === 'number' ? (Number.isNaN(value) ? 'N/A' : value.toString()) : value
	);
</script>

<div
	class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 {size ===
	'sm'
		? 'p-2'
		: size === 'lg'
			? 'p-4'
			: 'p-3'} flex flex-col"
	data-testid={testId}
>
	<div class="flex items-center {size === 'sm' ? 'mb-1' : 'mb-2'}">
		{#if icon}
			<FontAwesomeIcon
				{icon}
				class="{size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} icon mr-2 text-orange-500"
			/>
		{/if}
		<h3
			class="{size === 'sm' ? 'text-xs' : 'text-sm'} font-semibold text-gray-700 dark:text-gray-300"
		>
			{title}
		</h3>
	</div>
	{#if value !== null && !loading}
		<p
			class="{size === 'sm'
				? 'text-lg'
				: size === 'lg'
					? 'text-3xl'
					: 'text-2xl'} font-bold {valueClass} value"
		>
			{formattedValue}
		</p>
		<p
			class="text-xs text-gray-500 dark:text-gray-400 {size === 'sm' ? 'mt-0.5' : 'mt-1'} subtitle"
		>
			{subtitle}
		</p>
	{:else}
		<div
			class="{size === 'sm'
				? 'h-5 w-14'
				: 'h-6 w-16'} mt-1 mb-1 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
		></div>
		<div
			class="{size === 'sm'
				? 'h-2 w-20'
				: 'h-3 w-24'} animate-pulse rounded bg-gray-200 dark:bg-gray-700"
		></div>
	{/if}
</div>
