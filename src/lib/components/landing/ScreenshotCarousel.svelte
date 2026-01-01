<script lang="ts">
	import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { browser } from '$app/environment';

	const screenshots: { light: string; dark: string; alt: string }[] = [
		{
			light: '/images/screenshots/config-light.png',
			dark: '/images/screenshots/config-dark.png',
			alt: 'Curated server configurations'
		},
		{
			light: '/images/screenshots/statistics-light.png',
			dark: '/images/screenshots/statistics-dark.png',
			alt: 'Market statistics and price trends'
		},
		{
			light: '/images/screenshots/analyze-light.png',
			dark: '/images/screenshots/analyze-dark.png',
			alt: 'Server analysis with filters and price history'
		},
		{
			light: '/images/screenshots/sidebar-light.png',
			dark: '/images/screenshots/sidebar-dark.png',
			alt: 'Filter sidebar with advanced options'
		},
		{
			light: '/images/screenshots/cloud-status-light.png',
			dark: '/images/screenshots/cloud-status-dark.png',
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

	// Preload all images
	$effect(() => {
		if (!browser) return;

		for (const screenshot of screenshots) {
			const lightImg = new Image();
			lightImg.src = screenshot.light;
			const darkImg = new Image();
			darkImg.src = screenshot.dark;
		}
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
		<div class="relative">
			<!-- Screenshot display -->
			<div
				class="overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-lg dark:border-gray-700 dark:bg-gray-800"
			>
				{#key currentIndex}
					<img
						src={isDarkMode ? screenshots[currentIndex].dark : screenshots[currentIndex].light}
						alt={screenshots[currentIndex].alt}
						class="w-full animate-fade-in"
					/>
				{/key}
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
