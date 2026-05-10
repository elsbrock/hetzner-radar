<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
	import SampleCardStack from '$lib/components/SampleCardStack.svelte';
	import type { ServerConfiguration } from '$lib/api/frontend/filter';

	let { featuredServers = [] }: { featuredServers?: ServerConfiguration[] } = $props();
</script>

<section
	class="relative -mx-8 -mt-8 overflow-hidden border-b border-orange-200 bg-linear-to-br from-orange-100 via-amber-100 to-orange-200 px-8 py-20 dark:border-orange-900/50 dark:from-orange-950/40 dark:via-gray-900 dark:to-orange-950/30"
	style="width: calc(100% + 4rem);"
>
	<!-- Animated radar dots background -->
	<div class="pointer-events-none absolute inset-0">
		<div class="radar-dot" style="top: 15%; left: 10%;"></div>
		<div class="radar-dot" style="top: 25%; left: 85%;"></div>
		<div class="radar-dot" style="top: 70%; left: 20%;"></div>
		<div class="radar-dot" style="top: 60%; left: 75%;"></div>
		<div class="radar-dot" style="top: 40%; left: 50%;"></div>
		<div class="radar-dot" style="top: 80%; left: 60%;"></div>
		<div class="radar-dot" style="top: 10%; left: 40%;"></div>
		<div class="radar-dot" style="top: 50%; left: 5%;"></div>
	</div>

	<div class="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-8 lg:grid-cols-5">
		<div class="text-left lg:col-span-3">
		<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-300 bg-white/60 px-3 py-1 text-sm font-medium text-orange-700 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
			<span class="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500"></span>
			Tracking live auction data
		</div>
		<h1
			class="mb-4 text-balance text-4xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-5xl dark:text-gray-50"
		>
			Never overpay for a Hetzner dedicated server again
		</h1>
		<p class="mb-8 max-w-xl text-pretty text-lg leading-relaxed text-gray-600 dark:text-gray-400">
			Server Radar monitors the Hetzner auction every few minutes and stores three months of pricing history. Compare configurations, spot trends, and get instant alerts when prices drop below your target.
		</p>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
			<Button
				data-testid="cta-get-started"
				color="primary"
				href="/analyze"
				size="lg"
				class="shadow-md"
			>
				Start Exploring
				<ArrowRightOutline class="ms-2 h-5 w-5" />
			</Button>
			<Button
				data-testid="cta-view-github"
				color="alternative"
				href="https://github.com/elsbrock/hetzner-radar"
				size="lg"
				class="shadow-xs"
			>
				<FontAwesomeIcon icon={faGithub} class="mr-2 h-6! w-6!" />
				View on GitHub
			</Button>
		</div>
		<p class="mt-6 text-sm text-gray-500 dark:text-gray-500">
			Free and open source. No account required to browse.
		</p>
	</div>
		<div class="my-4 lg:col-span-2 lg:mt-0">
			<SampleCardStack configs={featuredServers} />
		</div>
	</div>
</section>

<style>
	.radar-dot {
		position: absolute;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: rgb(249 115 22 / 0.5);
		animation: pulse-float 4s ease-in-out infinite;
	}

	:global(.dark) .radar-dot {
		background-color: rgb(251 146 60 / 0.6);
	}

	.radar-dot:nth-child(2) {
		animation-delay: 0.5s;
	}
	.radar-dot:nth-child(3) {
		animation-delay: 1s;
	}
	.radar-dot:nth-child(4) {
		animation-delay: 1.5s;
	}
	.radar-dot:nth-child(5) {
		animation-delay: 2s;
	}
	.radar-dot:nth-child(6) {
		animation-delay: 2.5s;
	}
	.radar-dot:nth-child(7) {
		animation-delay: 3s;
	}
	.radar-dot:nth-child(8) {
		animation-delay: 3.5s;
	}

	@keyframes pulse-float {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(1) translate(0, 0);
			box-shadow: 0 0 4px 2px rgb(249 115 22 / 0.3);
		}
		50% {
			opacity: 0.8;
			transform: scale(2) translate(3px, -3px);
			box-shadow: 0 0 12px 4px rgb(249 115 22 / 0.4);
		}
	}
</style>
