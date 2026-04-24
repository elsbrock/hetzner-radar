<script>
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import PageHero from '$lib/components/PageHero.svelte';

	const pageTitle = 'Why we built Server Radar — a Hetzner auction price tracker';
	const pageDescription =
		'Why we built Server Radar: a tool that tracks Hetzner dedicated auction prices over time and pings you when the right configuration appears for sale.';
	const canonical = 'https://radar.iodev.org/about';
	const ogImage = 'https://radar.iodev.org/images/og-image.webp';
	const datePublished = '2024-08-18T12:12:01+02:00';
	const dateModified = '2026-01-01T19:03:52+01:00';

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
		headline: 'Why we built Server Radar',
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
	title="Why we built Server Radar"
	tagline="A tool that watches Hetzner's dedicated server auction over time and pings you when the right configuration appears at the right price."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'About' }
	]}
/>

<main class="mx-auto max-w-4xl px-6 py-10">
	<div class="pb-8">
		<!-- Introduction Section -->
		<div class="mb-12">
			<p class="mb-5 text-lg text-gray-600 dark:text-gray-400">
				Server Radar tracks Hetzner's dedicated server auction and cloud availability. It provides
				historical pricing data, advanced filtering, and configurable alerts to help you find
				servers that match your requirements and budget.
			</p>
			<p class="text-lg text-gray-600 dark:text-gray-400">
				The project is open source. Data queries run client-side using DuckDB for fast filtering,
				while the backend handles alerting and user accounts.
			</p>
		</div>

		<!-- Author Section -->
		<section class="mb-12">
			<h2 class="mb-6 text-3xl font-semibold text-gray-800 dark:text-gray-100">Author</h2>
			<div
				class="flex flex-col items-center rounded-lg bg-white p-6 shadow-md md:flex-row md:space-x-8 dark:bg-gray-800"
			>
				<img
					src="/images/operator.webp"
					alt="Simon"
					class="mb-6 h-48 w-48 rounded-full drop-shadow-lg md:mb-0"
				/>
				<div>
					<p class="mb-4 text-gray-600 dark:text-gray-400">
						I'm Simon, a software engineer based in Germany. I built Server Radar to solve a
						problem I had: tracking Hetzner auction prices over time and getting notified when
						specific configurations became available.
					</p>
					<p class="text-gray-600 dark:text-gray-400">
						The tool grew from a simple script into a full application. I've open-sourced it so
						others can use it, audit the code, and contribute improvements.
					</p>
				</div>
			</div>
		</section>

		<!-- Links Section -->
		<section class="text-center">
			<div class="flex justify-center space-x-4">
				<Button href="https://github.com/elsbrock/hetzner-radar" class="shadow-xs">
					<FontAwesomeIcon icon={faGithub} class="mr-2" />
					GitHub
				</Button>
				<Button href="/contact" color="alternative" class="shadow-xs">
					<FontAwesomeIcon icon={faEnvelope} class="mr-2" />
					Contact
				</Button>
			</div>
		</section>
	</div>
</main>
