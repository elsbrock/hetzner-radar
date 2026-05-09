<script lang="ts">
	import type { Snippet } from 'svelte';

	type Crumb = { label: string; href?: string };

	let {
		title,
		tagline,
		breadcrumbs = [],
		meta,
		actions
	}: {
		title: string;
		tagline?: string;
		breadcrumbs?: Crumb[];
		meta?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<section class="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
	<div class="mx-auto max-w-6xl px-6 py-10 md:py-14">
		{#if breadcrumbs.length > 0}
			<nav class="mb-5 flex items-center gap-2 text-sm">
				{#each breadcrumbs as crumb, i (i)}
					{#if crumb.href}
						<a
							class="text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							href={crumb.href}
						>
							{crumb.label}
						</a>
					{:else}
						<span class="font-medium text-gray-900 dark:text-white">{crumb.label}</span>
					{/if}
					{#if i < breadcrumbs.length - 1}
						<span class="text-gray-300 dark:text-gray-700">/</span>
					{/if}
				{/each}
			</nav>
		{/if}

		<div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
			<div class="min-w-0 flex-1">
				<h1 class="mb-3 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl dark:text-white">
					{title}
				</h1>
				{#if tagline}
					<p class="max-w-2xl text-base leading-relaxed text-gray-600 dark:text-gray-400">
						{tagline}
					</p>
				{/if}
				{#if meta}
					<div class="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
						{@render meta()}
					</div>
				{/if}
			</div>

			{#if actions}
				<div class="flex flex-wrap items-center gap-3 md:justify-end">
					{@render actions()}
				</div>
			{/if}
		</div>
	</div>
</section>
