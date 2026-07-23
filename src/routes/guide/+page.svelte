<script lang="ts">
	import PageHero from '$lib/components/PageHero.svelte';

	const pageTitle = 'Hetzner Server Auction Guide — How It Works — Server Radar';
	const pageDescription =
		'How the Hetzner server auction works, what happened to prices in 2026, and how to use Server Radar to search listings, track availability, and set alerts.';
	const canonical = 'https://radar.iodev.org/guide';
	const ogImage = 'https://radar.iodev.org/images/og-image.webp';
	const datePublished = '2026-07-23T12:00:00+02:00';
	const dateModified = '2026-07-23T12:00:00+02:00';

	const faqItems = [
		{
			question: 'Do Hetzner auction prices keep dropping until the server is sold?',
			answer:
				'Prices decrease at randomized intervals while a server is listed and stop the moment someone orders it. Hetzner does not publish a minimum price or how long a server stays listed, so if a configuration is acceptable now, waiting is a gamble — someone else can take it. Price history on Server Radar shows how similar configurations have behaved.'
		},
		{
			question: 'Are auction servers used hardware?',
			answer:
				'Yes. Auction servers are dedicated servers from earlier product lines that previous customers cancelled. Hetzner runs a hardware test and wipes the disks before relisting, and replaces defective hardware free of charge during the contract.'
		},
		{
			question: 'Can I order an auction server without an IPv4 address?',
			answer:
				'Yes. The primary IPv4 is a removable add-on (€1.70/month). Ordering IPv6-only lowers the monthly price, but some setups (e.g. Windows) require IPv4.'
		},
		{
			question: 'Why did auction prices go up in 2026?',
			answer:
				'Hetzner raised prices across its portfolio effective April 1, 2026 — auction listings by roughly 3% — citing higher infrastructure and hardware costs, driven mainly by the sharp rise in DRAM and NAND prices that started in late 2025.'
		},
		{
			question: 'How fast is an auction server provisioned?',
			answer:
				'Hetzner states auction servers are usually deployed within one business day; in practice it is often much faster since the hardware is already racked.'
		}
	];

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

	const faqJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqItems.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: { '@type': 'Answer', text: item.answer }
		}))
	};
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
	{@html `<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</` + `script>`}
</svelte:head>

<PageHero
	title="The Hetzner server auction, explained"
	tagline="How the auction works, what happened to prices, and how to use Server Radar to find the right server at the right price."
	breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Guide' }]}
/>

<main class="mx-auto max-w-4xl px-6 py-10">
	<article class="pb-8 text-gray-600 dark:text-gray-400">
		<!-- How the auction works -->
		<section class="mb-12">
			<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
				How the Hetzner server auction works
			</h2>
			<p class="mb-4">
				The <a
					href="https://www.hetzner.com/sb/"
					class="text-orange-500 hover:underline"
					rel="noopener">Hetzner server auction</a
				>
				(also known as Server-Bidding or Serverbörse) sells dedicated servers that previous customers
				have cancelled — typically machines from earlier product lines. Before a server is listed,
				Hetzner
				<a
					href="https://docs.hetzner.com/robot/general/server-auction-faqs/"
					class="text-orange-500 hover:underline"
					rel="noopener">tests the hardware and wipes the disks</a
				>. Defective hardware is replaced free of charge during the contract.
			</p>
			<p class="mb-4">
				Despite the name, there is no bidding. Each listing starts at a fixed price for its model
				and the price then drops at randomized intervals until someone orders the server. Once
				it's ordered, it's gone — identical configurations may reappear later, but there is no
				way to predict when. Hetzner does not document a minimum price or a maximum listing
				duration.
			</p>
			<p class="mb-4">
				The terms are the same as for regular dedicated servers: monthly pricing with no setup fee
				and no minimum contract term, a dedicated 1 Gbit/s uplink with unlimited traffic, and
				provisioning usually within one business day. Auction servers are located in Hetzner's
				Falkenstein and Helsinki data centers. The primary IPv4 address is a removable add-on
				(€1.70/month) — ordering IPv6-only shaves that off the monthly price.
			</p>
			<p>
				Because hardware, location, and price vary per listing, the auction rewards patience and
				comparison: the same money buys very different machines depending on the day. That's the
				gap Server Radar fills with <a href="/analyze" class="text-orange-500 hover:underline"
					>searchable listings</a
				>, price history, and <a href="/alerts" class="text-orange-500 hover:underline">alerts</a>.
			</p>
		</section>

		<!-- What happened to prices -->
		<section class="mb-12">
			<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
				What happened to auction prices
			</h2>
			<p class="mb-4">
				For years the auction was a reliable source of cheap compute, but 2026 changed the
				baseline. In February 2026 Hetzner
				<a
					href="https://www.hetzner.com/pressroom/statement-price-adjustment/"
					class="text-orange-500 hover:underline"
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
				most — across the industry, not just at Hetzner.
			</p>
			<p>
				The practical takeaway: individual listings still get cheaper the longer they sit, but the
				overall price level has shifted upward. Our <a
					href="/statistics"
					class="text-orange-500 hover:underline">statistics page</a
				> shows how auction prices, volume, and hardware mix have developed, and the
				<a href="/servers/cpu" class="text-orange-500 hover:underline">per-CPU pages</a> show price ranges
				for specific models.
			</p>
		</section>

		<!-- How Server Radar works -->
		<section class="mb-12">
			<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
				How Server Radar works
			</h2>
			<p class="mb-4">
				Server Radar polls the Hetzner auction and cloud availability every few minutes and keeps
				three months of price history. Server searches run entirely in your browser using an
				embedded database — your filters never leave your device. Accounts are only needed for
				alerts.
			</p>
			<p>
				The project is <a
					href="https://github.com/elsbrock/hetzner-radar"
					class="text-orange-500 hover:underline"
					rel="noopener">open source</a
				>, free to use, and not affiliated with Hetzner. See
				<a href="/about" class="text-orange-500 hover:underline">about</a> for the background.
			</p>
		</section>

		<!-- Using the auction search -->
		<section class="mb-12">
			<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
				Using the auction search
			</h2>
			<p class="mb-4">
				The <a href="/analyze" class="text-orange-500 hover:underline">server search</a> lists live
				auction and standard dedicated servers in one view. Filter by CPU model or vendor, RAM
				size and ECC support, disk type and capacity, datacenter location, IPv4/GPU add-ons, and
				price. Every configuration comes with its price history, so you can see whether the
				current price is a deal or the usual level.
			</p>
			<ul class="mb-4 ml-5 list-disc space-y-2">
				<li>
					<strong>Start from the price chart, not the list.</strong> A €45 listing can be expensive
					if the same configuration regularly hits €38. Three months of history tells you what's
					normal.
				</li>
				<li>
					<strong>Save your filter.</strong> A saved filter is reusable and is the basis for a
					price alert.
				</li>
				<li>
					<strong>Compare by CPU.</strong> The <a
						href="/servers/cpu"
						class="text-orange-500 hover:underline">CPU pages</a
					> summarize live listings and price ranges per processor model, and
					<a href="/configurations" class="text-orange-500 hover:underline">configurations</a> highlights
					notable current offers.
				</li>
			</ul>
		</section>

		<!-- Tracking availability -->
		<section class="mb-12">
			<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
				Tracking cloud resource availability
			</h2>
			<p>
				Hetzner Cloud servers are regularly sold out in specific locations. The
				<a href="/cloud-status" class="text-orange-500 hover:underline">cloud status page</a> shows
				which server types are currently available in which locations, and the availability
				timeline shows when types came and went — useful for picking a location where the plan you
				want is actually in stock, or for catching a sold-out type the moment it returns.
			</p>
		</section>

		<!-- Alerts -->
		<section class="mb-12">
			<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">Price alerts</h2>
			<p class="mb-4">
				Auction listings disappear when someone buys them, so checking manually means being lucky
				or being late. <a href="/alerts" class="text-orange-500 hover:underline">Alerts</a> watch the
				market for you: define a filter, set a target price, and Server Radar notifies you by email
				or Discord webhook as soon as a matching server is listed at or below your target.
			</p>
			<p>
				The same works for cloud capacity: cloud alerts notify you when a server type becomes
				available in a location you care about. All alert features are free — you only need an
				account so we know where to send the notification.
			</p>
		</section>

		<!-- FAQ -->
		<section>
			<h2 class="mb-6 text-3xl font-semibold text-gray-800 dark:text-gray-100">
				Frequently asked questions
			</h2>
			<div class="space-y-6">
				{#each faqItems as item (item.question)}
					<div>
						<h3 class="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
							{item.question}
						</h3>
						<p>{item.answer}</p>
					</div>
				{/each}
			</div>
		</section>
	</article>
</main>
