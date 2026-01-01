<script>
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
</script>

<main class="p-8">
	<section class="mx-auto my-12 max-w-7xl text-center">
		<h1 class="mb-6 text-5xl font-extrabold text-gray-800 dark:text-gray-100">About</h1>
	</section>

	<div class="mx-auto max-w-4xl pb-8">
		<!-- Introduction Section -->
		<div class="mb-12">
			<p class="mb-5 text-lg text-gray-600 dark:text-gray-400">
				Server Radar tracks Hetzner's dedicated server auction and cloud availability. It provides
				historical pricing data, advanced filtering, and configurable alerts to help you find
				servers that match your requirements and budget.
			</p>
			<p class="text-lg text-gray-600 dark:text-gray-400">
				The project is open source. Data queries run client-side using DuckDB for fast filtering,
				while the backend handles alerting and user accounts.
			</p>
		</div>

		<!-- Author Section -->
		<section class="mb-12">
			<h2 class="mb-6 text-3xl font-semibold text-gray-800 dark:text-gray-100">Author</h2>
			<div
				class="flex flex-col items-center rounded-lg bg-white p-6 shadow-md md:flex-row md:space-x-8 dark:bg-gray-800"
			>
				<img
					src="/images/operator.webp"
					alt="Simon"
					class="mb-6 h-48 w-48 rounded-full drop-shadow-lg md:mb-0"
				/>
				<div>
					<p class="mb-4 text-gray-600 dark:text-gray-400">
						I'm Simon, a software engineer based in Germany. I built Server Radar to solve a
						problem I had: tracking Hetzner auction prices over time and getting notified when
						specific configurations became available.
					</p>
					<p class="text-gray-600 dark:text-gray-400">
						The tool grew from a simple script into a full application. I've open-sourced it so
						others can use it, audit the code, and contribute improvements.
					</p>
				</div>
			</div>
		</section>

		<!-- Links Section -->
		<section class="text-center">
			<div class="flex justify-center space-x-4">
				<Button href="https://github.com/elsbrock/hetzner-radar" class="shadow-sm">
					<FontAwesomeIcon icon={faGithub} class="mr-2" />
					GitHub
				</Button>
				<Button href="/contact" color="alternative" class="shadow-sm">
					<FontAwesomeIcon icon={faEnvelope} class="mr-2" />
					Contact
				</Button>
			</div>
		</section>
	</div>
</main>
