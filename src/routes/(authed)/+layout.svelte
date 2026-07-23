<script lang="ts">
	let { children } = $props<{ children: import('svelte').Snippet }>();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{@render children()}
