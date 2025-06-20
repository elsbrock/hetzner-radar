<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faBug, faForwardStep, faUsers } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
</script>

<section id="open-source" class="mx-auto my-20 max-w-7xl">
	<h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
		Built by the Community, For the Community
	</h2>
	<p class="mx-auto mb-12 text-center text-gray-600 md:w-2/3 dark:text-gray-400">
		Transparency, collaboration, and user-first development are at the heart of everything we do.
	</p>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<!-- Open Source Commitment -->
		<div
			class="rounded-lg border border-l-4 border-gray-100 !border-l-green-500 bg-gradient-to-br from-green-50 to-emerald-100 p-8 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-700"
		>
			<div class="mb-6 flex items-center">
				<div class="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
					<FontAwesomeIcon icon={faGithub} class="h-6 w-6 text-white" />
				</div>
				<h3 class="text-2xl font-bold text-gray-800 dark:text-gray-100">100% Open Source</h3>
			</div>
			<p class="mb-6 text-gray-600 dark:text-gray-400">
				Every line of code is transparent and community-reviewed. We believe in building tools that
				serve users, not shareholders. Inspect, modify, and contribute freely.
			</p>
			<div class="mb-6 space-y-3">
				<div class="flex items-center gap-3">
					<div
						class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
					>
						<span class="text-sm text-green-600 dark:text-green-400">✓</span>
					</div>
					<span class="text-gray-700 dark:text-gray-300">MIT License - truly free forever</span>
				</div>
				<div class="flex items-center gap-3">
					<div
						class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
					>
						<span class="text-sm text-green-600 dark:text-green-400">✓</span>
					</div>
					<span class="text-gray-700 dark:text-gray-300"
						>Modern tech stack (SvelteKit, TypeScript)</span
					>
				</div>
				<div class="flex items-center gap-3">
					<div
						class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
					>
						<span class="text-sm text-green-600 dark:text-green-400">✓</span>
					</div>
					<span class="text-gray-700 dark:text-gray-300"
						>Community-reviewed for security & privacy</span
					>
				</div>
			</div>
			<div class="flex flex-col gap-3 sm:flex-row">
				<Button
					href="https://github.com/elsbrock/hetzner-radar"
					class="flex items-center justify-center"
					color="primary"
				>
					<FontAwesomeIcon icon={faGithub} class="mr-2" />
					View Source Code
				</Button>
				<Button
					href="https://github.com/elsbrock/hetzner-radar/blob/main/CONTRIBUTING.md"
					class="flex items-center justify-center"
					color="alternative"
				>
					<FontAwesomeIcon icon={faForwardStep} class="mr-2" />
					Start Contributing
				</Button>
			</div>
		</div>

		<!-- Community Contribution -->
		<div
			class="rounded-lg border border-l-4 border-gray-100 !border-l-orange-500 bg-gradient-to-br from-orange-50 to-amber-100 p-8 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-700"
		>
			<div class="mb-6 flex items-center">
				<div class="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500">
					<FontAwesomeIcon icon={faUsers} class="h-6 w-6 text-white" />
				</div>
				<h3 class="text-2xl font-bold text-gray-800 dark:text-gray-100">Join the Team</h3>
			</div>
			<p class="mb-6 text-gray-600 dark:text-gray-400">
				Server Radar exists thanks to passionate contributors who donate their time and expertise.
				Every contribution, big or small, makes a difference.
			</p>
			<div class="mb-6 space-y-4">
				<div
					class="rounded-lg border border-gray-300 bg-white p-4 dark:border-gray-500 dark:bg-gray-800"
				>
					<div class="mb-2 flex items-center gap-3">
						<FontAwesomeIcon icon={faBug} class="h-4 w-4 text-red-500" />
						<span class="font-semibold text-gray-800 dark:text-gray-200">Report & Fix Issues</span>
					</div>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Help us improve by reporting bugs or submitting fixes
					</p>
				</div>
				<div
					class="rounded-lg border border-gray-300 bg-white p-4 dark:border-gray-500 dark:bg-gray-800"
				>
					<div class="mb-2 flex items-center gap-3">
						<span class="text-orange-500">☕</span>
						<span class="font-semibold text-gray-800 dark:text-gray-200">Support Development</span>
					</div>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Buy us a coffee to fuel late-night coding sessions
					</p>
				</div>
			</div>
			<div class="text-center">
				<p class="text-sm text-gray-500 italic dark:text-gray-400">
					💝 Special thanks to all contributors making this project possible!
				</p>
			</div>
		</div>
	</div>
</section>
