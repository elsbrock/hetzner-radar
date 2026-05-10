<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
	import SampleCardStack from '$lib/components/SampleCardStack.svelte';
	import type { ServerConfiguration } from '$lib/api/frontend/filter';

	let { featuredServers = [] }: { featuredServers?: ServerConfiguration[] } = $props();
</script>

<section class="relative overflow-hidden border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
	<!-- Subtle background pattern -->
	<div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style="background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0); background-size: 32px 32px;"></div>
	
	<!-- Gradient accent -->
	<div class="absolute -top-48 right-0 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl"></div>
	<div class="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-500/5 blur-3xl"></div>

	<div class="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
		<div class="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
			<!-- Content -->
			<div>
				<div class="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700 dark:border-primary-800 dark:bg-primary-900/50 dark:text-primary-400">
					<span class="flex h-1.5 w-1.5 rounded-full bg-primary-500"></span>
					Open-source price tracker
				</div>
				
				<h1 class="mb-6 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl lg:text-[3.25rem] lg:leading-[1.15] dark:text-white">
					Track Hetzner server prices over time
				</h1>
				
				<p class="mb-8 max-w-lg text-lg leading-relaxed text-gray-600 dark:text-gray-400">
					Server Radar polls the Hetzner auction every few minutes and keeps three months of price history. Filter, compare, and set alerts when configurations drop below your target price.
				</p>
				
				<div class="flex flex-col gap-3 sm:flex-row sm:gap-4">
					<Button
						data-testid="cta-get-started"
						href="/analyze"
						size="lg"
						class="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
					>
						Browse Servers
						<ArrowRightOutline class="ml-2 h-4 w-4" />
					</Button>
					<Button
						data-testid="cta-view-github"
						href="https://github.com/elsbrock/hetzner-radar"
						size="lg"
						class="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
					>
						<FontAwesomeIcon icon={faGithub} class="mr-2 h-4 w-4" />
						View on GitHub
					</Button>
				</div>

				<!-- Trust indicators -->
				<div class="mt-10 flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
					<div class="flex items-center gap-2">
						<svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
						</svg>
						<span>Free forever</span>
					</div>
					<div class="flex items-center gap-2">
						<svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
						</svg>
						<span>No account required</span>
					</div>
					<div class="flex items-center gap-2">
						<svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
						</svg>
						<span>Open source</span>
					</div>
				</div>
			</div>

			<!-- Card Stack -->
			<div class="relative lg:pl-8">
				<SampleCardStack configs={featuredServers} />
			</div>
		</div>
	</div>
</section>
