<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
	import SampleCardStack from '$lib/components/SampleCardStack.svelte';
</script>

<section class="mx-auto my-10 grid max-w-6xl grid-cols-1 items-start gap-12 md:grid-cols-5">
	<div class="justify-center text-left md:col-span-3">
		<h1
			class="mb-6 text-4xl font-extrabold tracking-tight text-gray-800 md:text-5xl dark:text-gray-100"
		>
			Hetzner Server Tracker
		</h1>
		<p class="mb-8 text-lg text-gray-600 dark:text-gray-400">
			Track dedicated server auction prices and cloud server availability. Get notified when prices
			drop or when sold-out cloud servers become available again.
		</p>
		<div class="flex flex-col gap-4 sm:flex-row">
			<Button
				data-testid="cta-get-started"
				color="primary"
				href="/analyze"
				size="lg"
				class="shadow-sm"
			>
				Browse Servers
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
				View Source
			</Button>
		</div>
	</div>
	<div class="my-8 mt-4 mr-8 md:col-span-2 md:mt-12">
		<SampleCardStack />
	</div>
</section>
