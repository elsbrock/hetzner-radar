<script lang="ts">
	import { page } from '$app/stores';
	import FloatingActionButton from '$lib/components/FloatingActionButton.svelte';
	import SqlConsoleDrawer from './SqlConsoleDrawer.svelte';
	import { faTerminal } from '@fortawesome/free-solid-svg-icons';

	// The console only makes sense on the DuckDB-backed data pages.
	const ALLOWED_ROUTES = new Set(['/configurations', '/statistics', '/analyze']);

	let hidden = $state(true);
	let visible = $derived(ALLOWED_ROUTES.has($page.url.pathname.replace(/\/+$/, '') || '/'));

	// If we navigate off an allowed route while the console is open, close it.
	$effect(() => {
		if (!visible) hidden = true;
	});
</script>

<FloatingActionButton
	icon={faTerminal}
	onClick={() => (hidden = false)}
	{visible}
	priority={200}
	ariaLabel="Open SQL console"
/>

<SqlConsoleDrawer bind:hidden />
