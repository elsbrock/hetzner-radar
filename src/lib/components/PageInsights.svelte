<script lang="ts">
	/**
	 * A short block of statements computed from the page's own data.
	 *
	 * Deliberately dumb: it renders what it is given and nothing when given
	 * nothing. Every sentence must be derived from live data by the caller — this
	 * component exists so that no page is tempted to hand-write filler prose here.
	 */
	interface Props {
		/** Computed statements. Renders nothing when empty. */
		insights: string[];
		/** Optional definition/caveat line, shown smaller beneath the statements. */
		note?: string;
		/** Heading text; omit to render the block without a heading. */
		heading?: string;
	}

	const { insights, note, heading = 'What the data shows' }: Props = $props();
</script>

{#if insights.length > 0}
	<section
		class="mx-auto mt-10 w-full max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400"
	>
		{#if heading}
			<h2 class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-500">
				{heading}
			</h2>
		{/if}
		<p>
			{#each insights as insight, i (insight)}
				{insight}{i < insights.length - 1 ? ' ' : ''}
			{/each}
		</p>
		{#if note}
			<p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{note}</p>
		{/if}
	</section>
{/if}
