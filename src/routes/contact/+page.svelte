<script>
	import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import PageHero from '$lib/components/PageHero.svelte';
</script>

<PageHero
	title="Contact"
	tagline="For bug reports and feature requests, please use GitHub Issues. For general questions or feedback, you can reach me via email or Discord."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Contact' }
	]}
/>

<main class="mx-auto max-w-3xl px-6 py-12">
	<div class="grid gap-4 sm:grid-cols-3">
		<a
			href="https://github.com/elsbrock/hetzner-radar/issues"
			class="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
		>
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
				<FontAwesomeIcon icon={faGithub} class="h-6 w-6 text-gray-900 dark:text-white" />
			</div>
			<h3 class="mb-1 font-semibold text-gray-900 dark:text-white">GitHub Issues</h3>
			<p class="text-center text-sm text-gray-600 dark:text-gray-400">Bug reports & features</p>
		</a>

		<a
			href="mailto:mail@radar.iodev.org"
			class="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
		>
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
				<FontAwesomeIcon icon={faEnvelope} class="h-6 w-6 text-gray-900 dark:text-white" />
			</div>
			<h3 class="mb-1 font-semibold text-gray-900 dark:text-white">Email</h3>
			<p class="text-center text-sm text-gray-600 dark:text-gray-400">mail@radar.iodev.org</p>
		</a>

		<a
			href="https://discord.gg/dcuGfURbdc"
			class="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
		>
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
				<FontAwesomeIcon icon={faDiscord} class="h-6 w-6 text-gray-900 dark:text-white" />
			</div>
			<h3 class="mb-1 font-semibold text-gray-900 dark:text-white">Discord</h3>
			<p class="text-center text-sm text-gray-600 dark:text-gray-400">Community discussion</p>
		</a>
	</div>

	<p class="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
		I typically respond within a few days. For urgent issues, Discord is usually fastest.
	</p>
</main>
