<script lang="ts">
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		height = 'h-80',
		children
	}: {
		title: string;
		description: string;
		/** Tailwind height class for the chart area. */
		height?: string;
		children: Snippet;
	} = $props();

	let card: HTMLElement | null = $state(null);
	// Building a Chart.js canvas is synchronous main-thread work, and a stacked
	// area with two dozen series is not cheap. Only pay for the cards the reader
	// can actually see, so switching tabs stays responsive.
	let visible = $state(!browser);

	$effect(() => {
		if (!card || visible) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					visible = true;
					observer.disconnect();
				}
			},
			{ rootMargin: '300px 0px' }
		);
		observer.observe(card);

		return () => observer.disconnect();
	});
</script>

<div
	bind:this={card}
	class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700 dark:bg-gray-800"
>
	<div class="p-5 pb-3">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
		<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
	</div>
	<div class="{height} w-full px-3 pb-4">
		{#if visible}
			{@render children()}
		{:else}
			<div class="h-full w-full animate-pulse bg-gray-100 dark:bg-gray-700/40"></div>
		{/if}
	</div>
</div>
