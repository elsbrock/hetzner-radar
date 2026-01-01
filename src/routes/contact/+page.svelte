<script>
	import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<div>
	<div class="mx-auto max-w-4xl p-8">
		<h1 class="mb-6 text-center text-4xl font-bold text-gray-800 dark:text-gray-100">Contact</h1>

		<div class="mb-12 text-center">
			<p class="text-base text-gray-600 dark:text-gray-400">
				For bug reports and feature requests, please use GitHub Issues. For general questions or
				feedback, you can reach me via email or Discord.
			</p>
		</div>

		<section class="mx-auto max-w-2xl">
			<div class="grid gap-4 md:grid-cols-3">
				<a
					href="https://github.com/elsbrock/hetzner-radar/issues"
					class="flex flex-col items-center rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg dark:bg-gray-800"
				>
					<FontAwesomeIcon
						icon={faGithub}
						class="mb-3 h-8 w-8 text-gray-700 dark:text-gray-300"
					/>
					<h3 class="mb-1 font-semibold text-gray-800 dark:text-gray-100">GitHub Issues</h3>
					<p class="text-center text-sm text-gray-600 dark:text-gray-400">
						Bug reports & features
					</p>
				</a>

				<a
					href="mailto:mail@radar.iodev.org"
					class="flex flex-col items-center rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg dark:bg-gray-800"
				>
					<FontAwesomeIcon
						icon={faEnvelope}
						class="mb-3 h-8 w-8 text-gray-700 dark:text-gray-300"
					/>
					<h3 class="mb-1 font-semibold text-gray-800 dark:text-gray-100">Email</h3>
					<p class="text-center text-sm text-gray-600 dark:text-gray-400">mail@radar.iodev.org</p>
				</a>

				<a
					href="https://discord.gg/dcuGfURbdc"
					class="flex flex-col items-center rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg dark:bg-gray-800"
				>
					<FontAwesomeIcon
						icon={faDiscord}
						class="mb-3 h-8 w-8 text-gray-700 dark:text-gray-300"
					/>
					<h3 class="mb-1 font-semibold text-gray-800 dark:text-gray-100">Discord</h3>
					<p class="text-center text-sm text-gray-600 dark:text-gray-400">Community discussion</p>
				</a>
			</div>
		</section>

		<section class="mt-12 text-center">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				I typically respond within a few days. For urgent issues, Discord is usually fastest.
			</p>
		</section>
	</div>
</div>
