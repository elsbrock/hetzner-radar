<script lang="ts">
	import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { browser } from '$app/environment';
	import SectionEyebrow from './SectionEyebrow.svelte';

	const screenshots: { light: string; dark: string; alt: string }[] = [
		{
			light: '/images/screenshots/config-light.webp',
			dark: '/images/screenshots/config-dark.webp',
			alt: 'Curated server configurations'
		},
		{
			light: '/images/screenshots/statistics-light.webp',
			dark: '/images/screenshots/statistics-dark.webp',
			alt: 'Market statistics and price trends'
		},
		{
			light: '/images/screenshots/analyze-light.webp',
			dark: '/images/screenshots/analyze-dark.webp',
			alt: 'Server analysis with filters and price history'
		},
		{
			light: '/images/screenshots/sidebar-light.webp',
			dark: '/images/screenshots/sidebar-dark.webp',
			alt: 'Filter sidebar with advanced options'
		},
		{
			light: '/images/screenshots/cloud-status-light.webp',
			dark: '/images/screenshots/cloud-status-dark.webp',
			alt: 'Cloud server availability status'
		}
	];

	let currentIndex = $state(0);
	let isDarkMode = $state(false);
	let isPaused = $state(false);
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let resumeTimeoutId: ReturnType<typeof setTimeout> | null = null;

	const AUTO_ROTATE_INTERVAL = 5000;
	const PAUSE_DURATION = 10000;

	$effect(() => {
		if (!browser) return;

		isDarkMode = document.documentElement.classList.contains('dark');

		const observer = new MutationObserver(() => {
			isDarkMode = document.documentElement.classList.contains('dark');
		});

		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		return () => observer.disconnect();
	});

	// Preload only the next slide in the active theme, so the initial page load
	// doesn't fetch all variants (~3.4 MB of PNGs) up front.
	$effect(() => {
		if (!browser) return;

		const next = screenshots[(currentIndex + 1) % screenshots.length];
		const img = new Image();
		img.src = isDarkMode ? next.dark : next.light;
	});

	$effect(() => {
		if (!browser || isPaused) return;

		intervalId = setInterval(() => {
			currentIndex = (currentIndex + 1) % screenshots.length;
		}, AUTO_ROTATE_INTERVAL);

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	});

	function pauseAutoRotate() {
		isPaused = true;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		if (resumeTimeoutId) {
			clearTimeout(resumeTimeoutId);
		}
		resumeTimeoutId = setTimeout(() => {
			isPaused = false;
		}, PAUSE_DURATION);
	}

	function next() {
		pauseAutoRotate();
		currentIndex = (currentIndex + 1) % screenshots.length;
	}

	function prev() {
		pauseAutoRotate();
		currentIndex = (currentIndex - 1 + screenshots.length) % screenshots.length;
	}

	function goTo(index: number) {
		pauseAutoRotate();
		currentIndex = index;
	}
</script>

{#if screenshots.length > 0}
	<section class="mx-auto my-16 max-w-5xl">
		<div class="mb-8 text-center">
			<SectionEyebrow label="Interface" />
			<h2 class="mt-3 text-2xl font-semibold text-gray-800 dark:text-gray-100">See it in action</h2>
		</div>
		<div class="relative">
			<!-- Monitor bezel -->
			<div
				class="overflow-hidden rounded-xl border border-gray-300 bg-gray-200/70 shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900"
			>
				<!-- Chrome bar -->
				<div
					class="flex items-center border-b border-gray-300/70 bg-gray-100 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800"
				>
					<span class="flex gap-1.5">
						<span class="h-2.5 w-2.5 rounded-full bg-red-400/80"></span>
						<span class="h-2.5 w-2.5 rounded-full bg-amber-400/80"></span>
						<span class="h-2.5 w-2.5 rounded-full bg-emerald-400/80"></span>
					</span>
					<span class="ms-4 truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
						{screenshots[currentIndex].alt}
					</span>
				</div>
				<!-- Screenshot display -->
				<div class="overflow-hidden bg-gray-100 dark:bg-gray-800">
					{#key currentIndex}
						<img
							src={isDarkMode ? screenshots[currentIndex].dark : screenshots[currentIndex].light}
							alt={screenshots[currentIndex].alt}
							width="1667"
							height="1116"
							loading="lazy"
							decoding="async"
							class="h-auto w-full animate-fade-in"
						/>
					{/key}
				</div>
			</div>

			<!-- Navigation arrows -->
			{#if screenshots.length > 1}
				<button
					onclick={prev}
					class="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md transition-colors hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800"
					aria-label="Previous screenshot"
				>
					<FontAwesomeIcon icon={faChevronLeft} class="h-5 w-5 text-gray-700 dark:text-gray-300" />
				</button>
				<button
					onclick={next}
					class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md transition-colors hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800"
					aria-label="Next screenshot"
				>
					<FontAwesomeIcon icon={faChevronRight} class="h-5 w-5 text-gray-700 dark:text-gray-300" />
				</button>
			{/if}

			<!-- Dots indicator -->
			{#if screenshots.length > 1}
				<div class="mt-4 flex justify-center gap-2">
					{#each screenshots as screenshot, i (screenshot.alt)}
						<button
							onclick={() => goTo(i)}
							class="h-2 w-2 rounded-full transition-colors {i === currentIndex
								? 'bg-orange-500'
								: 'bg-gray-300 dark:bg-gray-600'}"
							aria-label="Go to screenshot {i + 1}"
						></button>
					{/each}
				</div>
			{/if}
		</div>
	</section>
{/if}

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: scale(0.98);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	:global(.animate-fade-in) {
		animation: fade-in 0.3s ease-out;
	}
</style>
