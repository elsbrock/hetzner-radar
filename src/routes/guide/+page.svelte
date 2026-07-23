<script lang="ts">
	import { browser } from '$app/environment';
	import PageHero from '$lib/components/PageHero.svelte';

	const pageTitle = 'Hetzner Server Auction Guide — How It Works — Server Radar';
	const pageDescription =
		'How the Hetzner server auction works, what happened to prices in 2026, and how to use Server Radar to search listings, track availability, and set alerts.';
	const canonical = 'https://radar.iodev.org/guide';
	const ogImage = 'https://radar.iodev.org/images/og-image.webp';
	const datePublished = '2026-07-23T12:00:00+02:00';
	const dateModified = '2026-07-23T12:00:00+02:00';

	const sections = [
		{ id: 'auction', label: 'How the auction works' },
		{ id: 'prices', label: 'What happened to prices' },
		{ id: 'monitoring', label: 'How we monitor the market' },
		{ id: 'search', label: 'Using the auction search' },
		{ id: 'cloud', label: 'Cloud availability' },
		{ id: 'alerts', label: 'Price & availability alerts' }
	];

	let activeId = $state('');

	$effect(() => {
		if (!browser) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeId = entry.target.id;
					}
				}
			},
			{ rootMargin: '-20% 0px -70% 0px' }
		);
		for (const section of sections) {
			const el = document.getElementById(section.id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	});

	const breadcrumbJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://radar.iodev.org/' },
			{ '@type': 'ListItem', position: 2, name: 'Guide', item: canonical }
		]
	};

	const articleJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: 'The Hetzner server auction, explained',
		description: pageDescription,
		mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
		author: {
			'@type': 'Person',
			name: 'Simon Elsbrock',
			url: 'https://github.com/elsbrock'
		},
		datePublished,
		dateModified,
		image: ogImage
	};

	const linkClass = 'text-orange-500 hover:underline';
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<link rel="canonical" href={canonical} />

	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={canonical} />
	<meta property="og:type" content="article" />
	<meta property="og:image" content={ogImage} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
	<meta name="twitter:image" content={ogImage} />

	{@html `<script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</` + `script>`}
	{@html `<script type="application/ld+json">${JSON.stringify(articleJsonLd)}</` + `script>`}
</svelte:head>

<PageHero
	title="The Hetzner server auction, explained"
	tagline="How the auction works, what happened to prices, and how to use Server Radar to find the right server at the right price."
	breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Guide' }]}
/>

<main class="mx-auto max-w-6xl px-6 py-10">
	<!-- Mobile: "On this page" quick nav -->
	<nav
		class="mb-8 rounded-lg border border-gray-200 bg-white p-4 lg:hidden dark:border-gray-700 dark:bg-gray-800"
		aria-label="On this page"
	>
		<p class="mb-2 text-xs font-semibold text-gray-900 uppercase dark:text-white">On this page</p>
		<ul class="space-y-1">
			{#each sections as section (section.id)}
				<li>
					<a
						href="#{section.id}"
						class="text-sm text-gray-500 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400"
						>{section.label}</a
					>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
		<!-- Desktop: sticky side navigation -->
		<aside class="hidden lg:block">
			<nav class="sticky top-24" aria-label="On this page">
				<p class="mb-3 text-xs font-semibold text-gray-900 uppercase dark:text-white">
					On this page
				</p>
				<ul class="space-y-2 border-l border-gray-200 dark:border-gray-700">
					{#each sections as section (section.id)}
						<li>
							<a
								href="#{section.id}"
								class="-ml-px block border-l-2 py-0.5 pl-3 text-sm transition-colors {activeId ===
								section.id
									? 'border-orange-500 font-medium text-orange-600 dark:text-orange-400'
									: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
								>{section.label}</a
							>
						</li>
					{/each}
				</ul>
			</nav>
		</aside>

		<article class="min-w-0 pb-8 text-gray-600 dark:text-gray-400">
			<!-- How the auction works -->
			<section id="auction" class="mb-12 scroll-mt-24">
				<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
					How the Hetzner server auction works
				</h2>
				<p class="mb-4">
					The <a href="https://www.hetzner.com/sb/" class={linkClass} rel="noopener"
						>Hetzner server auction</a
					>
					(also known as Server-Bidding or Serverbörse) sells dedicated servers that previous
					customers have cancelled — typically machines from earlier product lines. Before a server
					is listed, Hetzner
					<a
						href="https://docs.hetzner.com/robot/general/server-auction-faqs/"
						class={linkClass}
						rel="noopener">tests the hardware and wipes the disks</a
					>. Defective hardware is replaced free of charge during the contract.
				</p>
				<p class="mb-4">
					Despite the name, there is no bidding. Each listing starts at a fixed price for its model
					and the price then drops at randomized intervals until someone orders the server. Once
					it's ordered, it's gone — identical configurations may reappear later, but there is no way
					to predict when. Hetzner does not document a minimum price or a maximum listing duration,
					so waiting for a lower price is always a gamble against other buyers watching the same
					listing.
				</p>
				<p class="mb-4">
					The terms are the same as for regular dedicated servers: monthly pricing with no setup fee
					and no minimum contract term, a dedicated 1 Gbit/s uplink with unlimited traffic, and
					provisioning usually within one business day — often much faster, since the hardware is
					already racked. Auction servers are located in Hetzner's Falkenstein and Helsinki data
					centers. The primary IPv4 address is a removable add-on (€1.70/month) — ordering IPv6-only
					shaves that off the monthly price, though some setups (e.g. Windows) require IPv4.
				</p>
				<p>
					Because hardware, location, and price vary per listing, the auction rewards patience and
					comparison: the same money buys very different machines depending on the day. That's the
					gap Server Radar fills with <a href="/analyze" class={linkClass}>searchable listings</a>,
					price history, and <a href="/alerts" class={linkClass}>alerts</a>.
				</p>
			</section>

			<!-- What happened to prices -->
			<section id="prices" class="mb-12 scroll-mt-24">
				<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
					What happened to auction prices
				</h2>
				<p class="mb-4">
					For years the auction was a reliable source of cheap compute, but 2026 changed the
					baseline. In February 2026 Hetzner
					<a
						href="https://www.hetzner.com/pressroom/statement-price-adjustment/"
						class={linkClass}
						rel="noopener">announced price increases</a
					>
					across its portfolio, effective April 1, 2026 — including roughly 3% on auction listings,
					applied to new orders and existing contracts alike. Setup fees for regular dedicated
					servers rose in April (the auction has none), and in June 2026 Hetzner restructured its
					dedicated line-up with new names and prices while leaving the auction untouched.
				</p>
				<p class="mb-4">
					The main driver is hardware cost: server DRAM contract prices rose over 40% in late 2025,
					with further steep increases through 2026. Memory-heavy configurations are affected the
					most — across the industry, not just at Hetzner. That also changes the auction's role:
					when new hardware gets more expensive, refurbished machines with lots of RAM become
					relatively better deals, and sought-after configurations sell faster.
				</p>
				<p>
					The practical takeaway: individual listings still get cheaper the longer they sit, but the
					overall price level has shifted upward. Our <a href="/statistics" class={linkClass}
						>statistics page</a
					> shows how auction prices, volume, and hardware mix have developed, and the
					<a href="/servers/cpu" class={linkClass}>per-CPU pages</a> show price ranges for specific models.
				</p>
			</section>

			<!-- How we monitor -->
			<section id="monitoring" class="mb-12 scroll-mt-24">
				<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
					How we monitor the market
				</h2>
				<p class="mb-4">
					Every few minutes, Server Radar takes a snapshot of the entire auction: every listing with
					its current price, CPU, RAM, disks, location, and add-ons. The same happens for Hetzner's
					standard dedicated servers and for cloud availability across all locations. No account or
					special access is involved — it's the same public data you see on Hetzner's own pages,
					just recorded continuously instead of glanced at once.
				</p>
				<p class="mb-4">
					Stringing those snapshots together is what turns a price tag into a story. We keep three
					months of history, so for any configuration you can see what it sold for last week, how
					low identical machines have gone before, and whether the current price is an outlier or
					business as usual. When a listing disappears between two snapshots, we know it was taken —
					that's how the <a href="/statistics" class={linkClass}>sold-price statistics</a> are built,
					and it's a far better signal of what a server is <em>actually</em> worth than asking
					prices alone.
				</p>
				<p>
					The snapshots also power everything else on the site: the
					<a href="/analyze" class={linkClass}>search</a> works on the latest snapshot,
					<a href="/configurations" class={linkClass}>configurations</a> ranks notable current
					offers, and <a href="/alerts" class={linkClass}>alerts</a> compare each new snapshot against
					your targets — so a matching server triggers a notification within minutes of appearing, not
					whenever you happen to check. Server Radar is
					<a href="https://github.com/elsbrock/hetzner-radar" class={linkClass} rel="noopener"
						>open source</a
					>, free, and not affiliated with Hetzner.
				</p>
			</section>

			<!-- Using the auction search -->
			<section id="search" class="mb-12 scroll-mt-24">
				<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
					Using the auction search
				</h2>
				<p class="mb-4">
					The <a href="/analyze" class={linkClass}>server search</a> lists live auction and standard
					dedicated servers in one view. Filter by CPU model or vendor, RAM size and ECC support,
					disk type and capacity, datacenter location, IPv4/GPU add-ons, and price. Every
					configuration comes with its price history, so you can see whether the current price is a
					deal or the usual level.
				</p>
				<ul class="mb-4 ml-5 list-disc space-y-2">
					<li>
						<strong>Start from the price chart, not the list.</strong> A €45 listing can be
						expensive if the same configuration regularly hits €38. Three months of history tells
						you what's normal.
					</li>
					<li>
						<strong>Save your filter.</strong> A saved filter is reusable and is the basis for a
						price alert.
					</li>
					<li>
						<strong>Compare by CPU.</strong> The <a href="/servers/cpu" class={linkClass}
							>CPU pages</a
						> summarize live listings and price ranges per processor model, and
						<a href="/configurations" class={linkClass}>configurations</a> highlights notable current
						offers.
					</li>
				</ul>
			</section>

			<!-- Cloud availability -->
			<section id="cloud" class="mb-12 scroll-mt-24">
				<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
					Cloud availability — and why it's a problem
				</h2>
				<p class="mb-4">
					Hetzner Cloud has finite capacity per location, and popular server types regularly sell
					out — especially newer generations and specific locations. When a type is sold out, the
					order simply fails: there is no waitlist, no restock announcement, and no way to see from
					Hetzner's site whether a type has been gone for an hour or a month. If your setup needs a
					specific type in a specific location — say, to match existing servers in a project — your
					options are to take a pricier type, switch location, or keep re-checking the order page by
					hand.
				</p>
				<p class="mb-4">
					That last part is what we automate. The
					<a href="/cloud-status" class={linkClass}>cloud status page</a> shows which server types are
					available in which locations right now, and the availability timeline shows how that looked
					over the past weeks: whether a sold-out type blips back several times a day, returns in bursts,
					or has been gone for a month. That history is the difference between "wait an hour" and "pick
					a different plan" being the right call.
				</p>
				<p>
					And if waiting is the right call, you don't have to do it manually:
					<a href="/alerts" class={linkClass}>cloud alerts</a> notify you the moment a type becomes available
					in a location you care about.
				</p>
			</section>

			<!-- Alerts -->
			<section id="alerts" class="mb-12 scroll-mt-24">
				<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
					Price & availability alerts
				</h2>
				<p class="mb-4">
					Auction listings disappear when someone buys them, so checking manually means being lucky
					or being late. <a href="/alerts" class={linkClass}>Alerts</a> watch the market for you:
					define a filter, set a target price, and Server Radar notifies you by email or Discord
					webhook as soon as a matching server is listed at or below your target. Because alerts are
					evaluated against every snapshot, you hear about a match within minutes — usually early
					enough to actually get the server.
				</p>
				<p>
					The same works for cloud capacity: cloud alerts notify you when a server type becomes
					available in a location you care about, and can disarm themselves after firing so you
					aren't spammed. All alert features are free — you only need an account so we know where to
					send the notification.
				</p>
			</section>
		</article>
	</div>
</main>
