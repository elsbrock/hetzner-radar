<script lang="ts">
	// Telemetry-style section label: a signal dot + monospace, uppercase, tracked text.
	// `live` swaps the static orange marker for an emerald "online" pulse.
	let { label, live = false }: { label: string; live?: boolean } = $props();
</script>

<span
	class="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.2em] text-orange-600 uppercase dark:text-orange-400"
>
	{#if live}
		<span class="signal-dot" aria-hidden="true"></span>
	{:else}
		<span class="h-1.5 w-1.5 rounded-full bg-orange-500/70" aria-hidden="true"></span>
	{/if}
	{label}
</span>
