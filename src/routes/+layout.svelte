<script>
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';

	import { onMount, onDestroy } from 'svelte';
	import { initializeDB, tearDownDB } from '../stores/db';

	onMount(async () => {
		return initializeDB();
	});

	onDestroy(async () => {
		await tearDownDB();
	});
</script>

<svelte:head>
	<script
		defer
		src="https://cloud.umami.is/script.js"
		data-website-id="896771fd-d90c-4650-b14d-2a0e6218a7aa"
	></script>
	<script defer src="https://wa.iodev.org/pa.js"
		id="pianjs"
		data-code="R5X9PYTQxsNNMIjmLKGTsfFKf4il1nGW"
		data-hit-endpoint="https://wa.iodev.org/hit"
		data-event-endpoint="https://wa.iodev.org/event"
		data-session-endpoint="https://wa.iodev.org/session"
	></script>
</svelte:head>

<Nav />
<slot></slot>
<Footer />
