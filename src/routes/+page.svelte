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
</script>

<main class="p-8">
	<HeroSection featuredServers={data.featuredServers} />

	<LiveMetrics {data} />

	<FeaturesSection />

	<ScreenshotCarousel />

	<ConfigurationsTeaser />

	<StatisticsTeaser />

	<FAQSection />

	<OpenSourceBanner />

	<!-- Links -->
	<section class="mx-auto my-16 max-w-4xl">
		<div class="flex flex-wrap items-center justify-center gap-8 text-gray-600 dark:text-gray-400">
			<a
				href="https://github.com/elsbrock/hetzner-radar"
				class="flex items-center gap-2 transition-colors hover:text-gray-900 dark:hover:text-gray-200"
			>
				<FontAwesomeIcon icon={faGithub} class="h-5 w-5" />
				<span>GitHub</span>
			</a>
			<a
				href="https://discord.gg/dcuGfURbdc"
				class="flex items-center gap-2 transition-colors hover:text-gray-900 dark:hover:text-gray-200"
			>
				<FontAwesomeIcon icon={faDiscord} class="h-5 w-5" />
				<span>Discord</span>
			</a>
			<a
				href="/contact"
				class="flex items-center gap-2 transition-colors hover:text-gray-900 dark:hover:text-gray-200"
			>
				<FontAwesomeIcon icon={faEnvelope} class="h-5 w-5" />
				<span>Contact</span>
			</a>
		</div>
	</section>

	<!-- Disclaimer -->
	<section class="mx-auto mb-4 max-w-4xl text-center">
		<p class="text-xs text-gray-500 dark:text-gray-400">
			Server Radar is an independent project and is not affiliated with, endorsed, or sponsored by
			Hetzner Online GmbH. "Hetzner" is a trademark of Hetzner Online GmbH. Data accuracy is not
			guaranteed. See <a
				href={resolve('/terms')}
				class="underline hover:text-orange-500 dark:hover:text-orange-400">Terms</a
			>
			and
			<a
				href={resolve('/privacy')}
				class="underline hover:text-orange-500 dark:hover:text-orange-400">Privacy Policy</a
			>.
		</p>
	</section>
</main>
