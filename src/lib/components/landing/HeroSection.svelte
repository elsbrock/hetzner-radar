<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import SampleCardStack from '$lib/components/SampleCardStack.svelte';

	const wordToAnimate = 'Overpaying';
	const letters = wordToAnimate.split('');
	let startAnimation = $state(false);

	onMount(() => {
		setTimeout(() => {
			startAnimation = true;
		}, 50);
	});
</script>

<section class="mx-auto my-10 grid max-w-6xl grid-cols-1 items-start gap-12 md:grid-cols-5">
	<!-- Left Column: Text and Button -->
	<div class="justify-center text-left md:col-span-3">
		<h1
			class="mb-6 text-4xl font-extrabold tracking-tight text-gray-800 md:text-5xl dark:text-gray-100"
		>
			Stop&nbsp;{#each letters as letter, i (i)}<span
					class="scary-letter"
					class:animate={startAnimation}
					style="animation-delay: {i * 0.05}s;">{letter}</span
				>{/each}&nbsp;for Hetzner Auction Servers
		</h1>
		<p class="mb-8 text-lg text-gray-600 dark:text-gray-400">
			<strong>Server Radar</strong> is a free, open-source tool built by the community, for the
			community. Track Hetzner auction prices, get historical insights, use advanced filtering, and
			receive
			<span class="underline decoration-orange-500 decoration-2">instant notifications</span>
			via email, Discord, and more — all without any cost or hidden fees.
		</p>
		<div class="flex flex-col gap-4 sm:flex-row">
			<Button
				data-testid="cta-get-started"
				color="primary"
				href="/analyze"
				size="lg"
				class="shadow-sm"
			>
				Get Started
				<ArrowRightOutline class="ms-2 h-5 w-5" />
			</Button>
			<Button
				data-testid="cta-view-github"
				color="alternative"
				href="https://github.com/elsbrock/hetzner-radar"
				size="lg"
				class="shadow-sm"
			>
				<FontAwesomeIcon icon={faGithub} class="mr-2" />
				View on GitHub
			</Button>
		</div>
	</div>
	<!-- Right Column: Sample Card Stack -->
	<div class="my-8 mt-4 mr-8 md:col-span-2 md:mt-12">
		<SampleCardStack />
	</div>
</section>

<style>
	@keyframes scary-shake {
		0% {
			transform: translateX(0) rotate(0);
		}
		10%,
		30%,
		50%,
		70%,
		90% {
			transform: translateX(-2px) rotate(-1.5deg);
		}
		20%,
		40%,
		60%,
		80% {
			transform: translateX(2px) rotate(1.5deg);
		}
		100% {
			transform: translateX(0) rotate(0);
		}
	}

	.scary-letter {
		display: inline-block;
		transform-origin: center center;
		will-change: transform;
	}

	.scary-letter.animate {
		animation-name: scary-shake;
		animation-duration: 1s;
		animation-timing-function: ease-in-out;
		animation-iteration-count: 1;
	}
</style>
