<script lang="ts">
	import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import ConfigurationsTeaser from '$lib/components/landing/ConfigurationsTeaser.svelte';
	import FAQSection from '$lib/components/landing/FAQSection.svelte';
	import FeaturesSection from '$lib/components/landing/FeaturesSection.svelte';
	import HeroSection from '$lib/components/landing/HeroSection.svelte';
	import LiveMetrics from '$lib/components/landing/LiveMetrics.svelte';
	import OpenSourceBanner from '$lib/components/landing/OpenSourceBanner.svelte';
	import ScreenshotCarousel from '$lib/components/landing/ScreenshotCarousel.svelte';
	import StatisticsTeaser from '$lib/components/landing/StatisticsTeaser.svelte';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const faq = [
		{
			q: 'Is Server Radar free?',
			a: 'Yes. All features including alerts are free. The project is open source under the MIT license.'
		},
		{
			q: 'How often is the data updated?',
			a: 'Auction and cloud availability data is polled every few minutes.'
		},
		{
			q: 'How do alerts work?',
			a: 'Create an account and configure alerts for auction prices or cloud availability. When a match is found, you receive a notification by email or Discord webhook.'
		},
		{
			q: 'What data do you collect?',
			a: 'Email address (for account and notifications) and Discord webhook URL if configured. Server auction data is public information published by Hetzner.'
		},
		{
			q: 'Can I contribute?',
			a: 'Yes. The source code is on GitHub. Bug reports, feature requests, and pull requests are welcome.'
		}
	];

	const faqJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faq.map((item) => ({
			'@type': 'Question',
			name: item.q,
			acceptedAnswer: {
				'@type': 'Answer',
				text: item.a
			}
		}))
	};

	const searchActionJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		url: 'https://radar.iodev.org/',
		potentialAction: {
			'@type': 'SearchAction',
			target: {
				'@type': 'EntryPoint',
				urlTemplate: 'https://radar.iodev.org/analyze?filter={search_term_string}'
			},
			'query-input': 'required name=search_term_string'
		}
	};
</script>

<svelte:head>
	<title>Hetzner Dedicated Server Price Tracker | Server Radar</title>
	<meta
		name="description"
		content="Track Hetzner dedicated server auction prices over time, compare against standard and cloud pricing, and get email or Discord alerts on price drops."
	/>
	<link rel="canonical" href="https://radar.iodev.org/" />

	<meta property="og:title" content="Hetzner Dedicated Server Price Tracker | Server Radar" />
	<meta
		property="og:description"
		content="Three months of auction price history, live cloud availability, and configurable alerts for the Hetzner server market."
	/>
	<meta property="og:url" content="https://radar.iodev.org/" />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://radar.iodev.org/images/og-image.webp" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Hetzner Dedicated Server Price Tracker | Server Radar" />
	<meta
		name="twitter:description"
		content="Three months of auction price history, live cloud availability, and configurable alerts for the Hetzner server market."
	/>
	<meta name="twitter:image" content="https://radar.iodev.org/images/og-image.webp" />

	{@html `<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</` + `script>`}
	{@html `<script type="application/ld+json">${JSON.stringify(searchActionJsonLd)}</` + `script>`}
</svelte:head>

<main>
	<HeroSection featuredServers={data.featuredServers} />

	<LiveMetrics {data} />

	<FeaturesSection />

	<ScreenshotCarousel />

	<ConfigurationsTeaser />

	<StatisticsTeaser />

	<FAQSection />

	<OpenSourceBanner />

	<!-- Social Links -->
	<section class="border-b border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-950">
		<div class="mx-auto max-w-6xl px-6">
			<div class="flex flex-wrap items-center justify-center gap-8">
				<a
					href="https://github.com/elsbrock/hetzner-radar"
					class="flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
				>
					<FontAwesomeIcon icon={faGithub} class="h-5 w-5" />
					<span>GitHub</span>
				</a>
				<a
					href="https://discord.gg/dcuGfURbdc"
					class="flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
				>
					<FontAwesomeIcon icon={faDiscord} class="h-5 w-5" />
					<span>Discord</span>
				</a>
				<a
					href="/contact"
					class="flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
				>
					<FontAwesomeIcon icon={faEnvelope} class="h-5 w-5" />
					<span>Contact</span>
				</a>
			</div>
		</div>
	</section>

	<!-- Disclaimer -->
	<section class="bg-gray-50 py-8 dark:bg-gray-900/50">
		<div class="mx-auto max-w-6xl px-6 text-center">
			<p class="text-xs leading-relaxed text-gray-500 dark:text-gray-500">
				Server Radar is an independent project and is not affiliated with, endorsed, or sponsored by
				Hetzner Online GmbH. "Hetzner" is a trademark of Hetzner Online GmbH. Data accuracy is not
				guaranteed. See <a
					href={resolve('/terms')}
					class="font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Terms</a
				>
				and
				<a
					href={resolve('/privacy')}
					class="font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Privacy Policy</a
				>.
			</p>
		</div>
	</section>
</main>
