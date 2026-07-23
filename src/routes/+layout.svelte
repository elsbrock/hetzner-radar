<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import '../app.css';
	import FloatingActionButton from '$lib/components/FloatingActionButton.svelte';
	import SqlConsoleLauncher from '$lib/components/console/SqlConsoleLauncher.svelte';
	import { faArrowUp } from '@fortawesome/free-solid-svg-icons';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';

	import Banner from '$lib/components/Banner.svelte';
	import { session } from '$lib/stores/session';
	import { onDestroy } from 'svelte';
	import { tearDownDB } from '../stores/db';
	import AnimatedBackground from '$lib/components/AnimatedBackground.svelte';

	// FontAwesome injects its CSS at runtime by default, which leaves SSR'd icons
	// unsized until hydration (visible nav reflow). Ship the CSS statically instead.
	import { config as faConfig } from '@fortawesome/fontawesome-svg-core';
	import '@fortawesome/fontawesome-svg-core/styles.css';
	faConfig.autoAddCss = false;

	let { data, children } = $props<
		import('./$types').LayoutData & { children: import('svelte').Snippet }
	>();

	// Reactively update session when data changes
	$effect(() => {
		if (data.session) {
			session.set(data.session);
		}
	});

	let showScrollToTop = $state(false);

	// DuckDB is initialized lazily by the pages/components that query it
	// (analyze, configurations, statistics, server drawer, SQL console).
	onDestroy(async () => {
		await tearDownDB();
	});

	// Effect for scroll-to-top FAB visibility
	$effect(() => {
		if (!browser) return;

		const scrollThreshold = window.innerHeight / 2;
		const handleScroll = () => {
			showScrollToTop = window.scrollY > scrollThreshold;
		};
		window.addEventListener('scroll', handleScroll, { passive: true });
		handleScroll(); // Initial check

		// Cleanup function
		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});
</script>

<svelte:head>
	<!-- Global tags only — title, description, canonical, OG and robots are owned by each page
	     (SvelteKit does not deduplicate meta tags between layout and page heads). -->
	<meta name="author" content="Simon Elsbrock" />

	<!-- Viewport -->
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />

	<!-- Favicon -->
	<link rel="icon" href="/favicon.ico" type="image/x-icon" />

	<!-- Structured Data (JSON-LD) -->
	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "WebSite",
			"name": "Server Radar",
			"url": "https://radar.iodev.org/",
			"description": "Server Radar helps you find the best deals on Hetzner dedicated servers. Track prices, set up email alerts, and make informed purchasing decisions effortlessly.",
			"publisher": {
				"@type": "Person",
				"name": "Simon Elsbrock",
				"url": "https://radar.iodev.org/",
				"sameAs": ["https://github.com/elsbrock"]
			}
		}
	</script>

	<!-- Additional Meta Tags -->
	<meta name="theme-color" content="#FF7F50" />
</svelte:head>

<AnimatedBackground />

<div
	class="flex min-h-screen flex-col"
>
	<div class="grow">
		<Banner version={6} id="standard-servers">
			<strong>New:</strong> <a href={resolve('/cloud-status?timeline=true')}>Availability Timeline</a> — see when Cloud servers come and go across locations 📊
		</Banner>
		<Nav />

		{@render children()}
	</div>

	<Footer />
</div>

<Toast duration={2000} />

<!-- Global Scroll-to-Top FAB -->
<FloatingActionButton
	icon={faArrowUp}
	visible={showScrollToTop}
	priority={100}
	ariaLabel="Scroll to top"
/>

<!-- Global SQL Console launcher (persistent FAB + slide-out) -->
<SqlConsoleLauncher />
