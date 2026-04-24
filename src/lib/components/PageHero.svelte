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

<section
	class="relative border-b border-gray-200/70 bg-gradient-to-b from-orange-50/60 via-white to-white dark:border-gray-800 dark:from-orange-950/20 dark:via-gray-900 dark:to-gray-900"
>
	<div class="mx-auto max-w-6xl px-6 py-10 md:py-14">
		{#if breadcrumbs.length > 0}
			<nav class="mb-5 text-sm text-gray-500 dark:text-gray-400">
				{#each breadcrumbs as crumb, i (i)}
					{#if crumb.href}
						<a
							class="transition-colors hover:text-orange-600 dark:hover:text-orange-400"
							href={crumb.href}
						>
							{crumb.label}
						</a>
					{:else}
						<span class="text-gray-700 dark:text-gray-200">{crumb.label}</span>
					{/if}
					{#if i < breadcrumbs.length - 1}
						<span class="mx-2 text-gray-300 dark:text-gray-600">/</span>
					{/if}
				{/each}
			</nav>
		{/if}

		<div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
			<div class="min-w-0 flex-1">
				<h1
					class="mb-3 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-gray-50"
				>
					{title}
				</h1>
				{#if tagline}
					<p class="max-w-2xl text-lg text-gray-600 dark:text-gray-300">
						{tagline}
					</p>
				{/if}
				{#if meta}
					<div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
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
