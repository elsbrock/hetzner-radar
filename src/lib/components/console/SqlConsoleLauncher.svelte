<script lang="ts">
	import { page } from '$app/stores';
	import FloatingActionButton from '$lib/components/FloatingActionButton.svelte';
	import { faTerminal } from '@fortawesome/free-solid-svg-icons';
	import type SqlConsoleDrawerType from './SqlConsoleDrawer.svelte';

	// The console only makes sense on the DuckDB-backed data pages.
	const ALLOWED_ROUTES = new Set(['/configurations', '/statistics', '/analyze']);

	let open = $state(false);
	let visible = $derived(ALLOWED_ROUTES.has($page.url.pathname.replace(/\/+$/, '') || '/'));

	// The drawer pulls in CodeMirror — load it only on first use so it stays
	// out of the layout bundle shipped to every page.
	let SqlConsoleDrawer = $state<typeof SqlConsoleDrawerType | null>(null);

	async function openConsole() {
		if (!SqlConsoleDrawer) {
			SqlConsoleDrawer = (await import('./SqlConsoleDrawer.svelte')).default;
		}
		open = true;
	}

	// If we navigate off an allowed route while the console is open, close it.
	$effect(() => {
		if (!visible) open = false;
	});
</script>

<FloatingActionButton
	icon={faTerminal}
	onClick={openConsole}
	{visible}
	priority={200}
	ariaLabel="Open SQL console"
/>

{#if SqlConsoleDrawer}
	<SqlConsoleDrawer bind:open />
{/if}
