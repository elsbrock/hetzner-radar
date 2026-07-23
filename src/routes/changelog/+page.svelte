<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHero from '$lib/components/PageHero.svelte';

	const canonical = 'https://radar.iodev.org/changelog';
	const ogImage = 'https://radar.iodev.org/images/og-image.webp';
	const description =
		'Release notes for Server Radar: new features, filters, alerts, and data improvements across Hetzner auction and cloud server tracking, in reverse order.';

	type Entry = { headline: string; datePublished: string };
	const entries: Entry[] = [
		{ headline: 'New guide: the Hetzner server auction, explained', datePublished: '2026-07-23' },
		{ headline: 'Run your own SQL with the SQL Console', datePublished: '2026-06-17' },
		{ headline: 'Availability heatmap shows uptime, not just in/out of stock', datePublished: '2026-06-16' },
		{ headline: 'Smarter configuration picks', datePublished: '2026-04-24' },
		{ headline: 'Availability timeline heatmap', datePublished: '2026-03-25' },
		{ headline: 'Cloud alerts that auto-disarm', datePublished: '2026-03-24' },
		{ headline: 'CPU specs and benchmark scores on every listing', datePublished: '2026-03-22' },
		{ headline: 'Standard dedicated server support', datePublished: '2026-01-03' },
		{ headline: 'Cloud status page redesign', datePublished: '2025-11-06' },
		{ headline: 'Cloud availability alerts', datePublished: '2025-06-03' },
		{ headline: 'Discord integration', datePublished: '2025-06-01' },
		{ headline: 'Statistics & sold price tracking', datePublished: '2025-05-06' },
		{ headline: 'Auction alert management', datePublished: '2025-05-02' },
		{ headline: 'Cloud server availability monitoring', datePublished: '2025-04-22' },
		// Older entries only have month-level granularity in the page copy.
		{ headline: 'Advanced filtering', datePublished: '2024-08-01' }
	];

	const blogJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Blog',
		name: 'Server Radar Changelog',
		description,
		url: canonical,
		publisher: {
			'@type': 'Person',
			name: 'Simon Elsbrock',
			url: 'https://radar.iodev.org/'
		},
		blogPost: entries.map((e) => ({
			'@type': 'BlogPosting',
			headline: e.headline,
			datePublished: e.datePublished,
			url: canonical,
			author: {
				'@type': 'Person',
				name: 'Simon Elsbrock'
			}
		}))
	};

	const breadcrumbJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{
				'@type': 'ListItem',
				position: 1,
				name: 'Home',
				item: 'https://radar.iodev.org/'
			},
			{
				'@type': 'ListItem',
				position: 2,
				name: 'Changelog',
				item: canonical
			}
		]
	};
</script>

<svelte:head>
	<title>Changelog | Server Radar</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />

	<!-- Open Graph -->
	<meta property="og:title" content="Changelog | Server Radar" />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={ogImage} />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Changelog | Server Radar" />
	<meta name="twitter:description" content={description} />

	<!-- Structured Data -->
	{@html `<script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</` + `script>`}
	{@html `<script type="application/ld+json">${JSON.stringify(blogJsonLd)}</` + `script>`}
</svelte:head>

<PageHero
	title="Changelog"
	tagline="Noteworthy features and improvements to Server Radar, in reverse chronological order."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Changelog' }
	]}
/>

<div class="container mx-auto max-w-4xl px-6 py-10">
	<!-- 2026 -->
	<section class="mb-12">
		<h2
			class="mb-6 border-b border-gray-200 pb-2 text-sm font-semibold tracking-widest text-gray-400 uppercase dark:border-gray-700 dark:text-gray-500"
		>
			2026
		</h2>
		<div class="space-y-10">
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Jul 23</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						New guide: the Hetzner server auction, explained
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						A new <a href="/guide" class="text-orange-500 hover:underline">guide page</a> covers how
						the Hetzner server auction works, what happened to prices in 2026, and how to get the most
						out of Server Radar — from the auction search and cloud availability tracking to price alerts.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Jun 17</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Run your own SQL with the SQL Console
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Query the auction dataset right from the data pages: a floating button opens a SQL
						console with syntax highlighting, schema-aware autocomplete, and CSV/JSON export.
						Ready-made views cover current listings and price history, with IPv4, VAT, and currency
						already applied. Everything runs in your browser — instant and private.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Jun 16</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Availability heatmap shows uptime, not just in/out of stock
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Cells in the Cloud Status availability chart are now shaded by how much of the period a
						server type was actually in stock — so a day with one brief restock no longer reads the
						same as a fully available one.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Apr 24</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Smarter configuration picks
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						The Configurations page now ranks deals by what actually matters instead of absolute
						price alone: best price/performance (€ per Geekbench 5 multicore point), cheapest
						absolute with ancient hardware filtered out, and best € per core, GB of RAM, and TB of
						NVMe or bulk storage.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Mar 25</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Availability timeline heatmap
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						The Cloud Status page shows exactly when each server type was in and out of stock across
						every location over the past 24 hours, 7 days, or 30 days — good for spotting the
						windows when your target type usually frees up.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Mar 24</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Cloud alerts that auto-disarm
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						When a cloud availability alert fires it switches itself off, so you aren't pinged
						repeatedly while the server is still available. Re-arm it whenever you want to watch
						again.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Mar 22</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						CPU specs and benchmark scores on every listing
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Every server card shows cores, threads, CPU generation, and Geekbench 5 scores. Sort by
						CPU score to find the strongest processor within your budget.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Jan 3</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Standard dedicated server support
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Browse Hetzner's standard dedicated servers alongside auction listings in one filterable
						view, with badges to tell them apart and direct links to Hetzner's product pages.
					</p>
				</div>
			</article>
		</div>
	</section>

	<!-- 2025 -->
	<section class="mb-12">
		<h2
			class="mb-6 border-b border-gray-200 pb-2 text-sm font-semibold tracking-widest text-gray-400 uppercase dark:border-gray-700 dark:text-gray-500"
		>
			2025
		</h2>
		<div class="space-y-10">
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Nov 6</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Cloud status page redesign
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Summary cards for overall availability and scarcest types, interactive filters,
						collapsible server groups, and a mobile-friendly availability matrix.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Jun 3</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Cloud availability alerts
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Get notified when your preferred cloud server type becomes available in a specific
						location.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Jun 1</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Discord integration
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Receive auction and cloud availability alerts directly in your Discord server via
						webhooks, alongside or instead of email.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>May 6</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Statistics & sold price tracking
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Sold auction prices are now tracked and shown on the statistics page, with price trends
						and volume comparisons — what servers actually sell for, not just asking prices.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>May 2</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Auction alert management
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Track and manage your auction alerts with a detailed history of which servers matched
						and when.
					</p>
				</div>
			</article>
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Apr 22</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Cloud server availability monitoring
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Live monitoring of Hetzner cloud server availability across all locations, with
						color-coded indicators designed to work for color-blind users too.
					</p>
				</div>
			</article>
		</div>
	</section>

	<!-- 2024 -->
	<section>
		<h2
			class="mb-6 border-b border-gray-200 pb-2 text-sm font-semibold tracking-widest text-gray-400 uppercase dark:border-gray-700 dark:text-gray-500"
		>
			2024
		</h2>
		<div class="space-y-10">
			<article class="sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-6">
				<time class="mb-1 block text-sm text-gray-400 sm:pt-0.5 sm:text-right dark:text-gray-500"
					>Aug</time
				>
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
						Advanced filtering
					</h3>
					<p class="text-base text-gray-500 dark:text-gray-400">
						Where it all started: dual range sliders, a recently-seen filter, and shareable filter
						URLs for the auction search.
					</p>
				</div>
			</article>
		</div>
	</section>

	<div class="mt-12 text-center">
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Want to suggest a feature or report a bug?
			<a href={resolve('/contact')} class="text-orange-500 hover:underline">Get in touch</a>
		</p>
	</div>
</div>
