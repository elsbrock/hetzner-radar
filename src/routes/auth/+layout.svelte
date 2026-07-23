<script lang="ts">
	let { children } = $props<{ children: import('svelte').Snippet }>();
</script>

<svelte:head>
	<title>Sign in — Server Radar</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{@render children()}
