<script>
	import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import PageHero from '$lib/components/PageHero.svelte';

	const pageTitle = 'Why I run Server Radar — a spare-time Hetzner auction tracker';
	const pageDescription =
		'Server Radar is a free, open-source Hetzner auction price tracker built and run by one person in his spare time. Why it exists and how it is maintained.';
	const canonical = 'https://radar.iodev.org/about';
	const ogImage = 'https://radar.iodev.org/images/og-image.webp';
	const datePublished = '2024-08-18T12:12:01+02:00';
	const dateModified = '2026-07-23T12:00:00+02:00';

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
				name: 'About',
				item: canonical
			}
		]
	};

	const articleJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: 'Why I run Server Radar',
		description: pageDescription,
		mainEntityOfPage: {
			'@type': 'WebPage',
			'@id': canonical
		},
		author: {
			'@type': 'Person',
			name: 'Simon Elsbrock',
			url: 'https://github.com/elsbrock'
		},
		datePublished,
		dateModified,
		image: ogImage
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
</svelte:head>

<PageHero
	title="Why I run Server Radar"
	tagline="A spare-time project that watches Hetzner's server market so you don't have to."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'About' }
	]}
/>

<main class="mx-auto max-w-4xl px-6 py-10">
	<div class="pb-8 text-gray-600 dark:text-gray-400">
		<!-- The story -->
		<section class="mb-12">
			<p class="mb-5 text-lg">
				Server Radar exists because I wanted a Hetzner auction server myself. The auction is a great
				place to find cheap dedicated hardware — but the official interface only shows the current
				price of what's listed right now. Is €45 a good deal for that machine? Was it cheaper last
				week? Will something better show up tomorrow? There was no way to tell, and refreshing the
				page all day is not a hobby.
			</p>
			<p class="mb-5 text-lg">
				So I wrote a small script that recorded auction prices. The script grew charts, the charts
				grew filters, the filters grew alerts — and at some point it was a proper application that
				seemed too useful to keep to myself. Today Server Radar tracks the auction, standard
				dedicated servers, and cloud availability around the clock, and the
				<a href="/guide" class="text-orange-500 hover:underline">guide</a> explains how it all works.
			</p>
		</section>

		<!-- Spare-time project -->
		<section class="mb-12">
			<h2 class="mb-6 text-3xl font-semibold text-gray-800 dark:text-gray-100">
				A spare-time project, and that's the point
			</h2>
			<div
				class="rounded-lg border-l-4 border-orange-500 bg-white p-6 shadow-md dark:bg-gray-800"
			>
				<p class="mb-4">
					There is no company behind Server Radar. I build and run it in my spare time — evenings,
					weekends, and the occasional lunch break. It's free to use, the code is
					<a
						href="https://github.com/elsbrock/hetzner-radar"
						class="text-orange-500 hover:underline"
						rel="noopener">open source</a
					>, and it's not affiliated with Hetzner.
				</p>
				<p>
					That cuts both ways. There's no SLA and no support team — fixes happen when I'm at the
					keyboard. But it also means there's nothing to sell you: no upsells and no plans to
					monetize your data. The best ways to support the project are a star on GitHub, a bug
					report, a pull request, or simply telling the next person who's hunting for a server deal.
				</p>
			</div>
		</section>

		<!-- Author -->
		<section class="mb-12">
			<h2 class="mb-6 text-3xl font-semibold text-gray-800 dark:text-gray-100">Who's behind it</h2>
			<div
				class="flex flex-col items-center rounded-lg bg-white p-6 shadow-md md:flex-row md:space-x-8 dark:bg-gray-800"
			>
				<img
					src="/images/operator.webp"
					alt="Simon"
					class="mb-6 h-48 w-48 rounded-full drop-shadow-lg md:mb-0"
				/>
				<div>
					<p class="mb-4">
						I'm Simon, a software engineer based in Germany. By day I build software for other
						people; Server Radar is what happens by night when an engineer gets annoyed by a
						missing feature in a pricing page.
					</p>
					<p>
						If Server Radar found you a good deal, told you when your cloud type was back in stock,
						or just saved you some refreshing — that's exactly what it's for. Come say hi on
						Discord or GitHub.
					</p>
				</div>
			</div>
		</section>

		<!-- Links -->
		<section class="text-center">
			<div class="flex flex-wrap justify-center gap-4">
				<Button href="https://github.com/elsbrock/hetzner-radar" class="shadow-xs">
					<FontAwesomeIcon icon={faGithub} class="mr-2" />
					GitHub
				</Button>
				<Button href="https://discord.gg/dcuGfURbdc" color="alternative" class="shadow-xs">
					<FontAwesomeIcon icon={faDiscord} class="mr-2" />
					Discord
				</Button>
				<Button href="/contact" color="alternative" class="shadow-xs">
					<FontAwesomeIcon icon={faEnvelope} class="mr-2" />
					Contact
				</Button>
			</div>
		</section>
	</div>
</main>
