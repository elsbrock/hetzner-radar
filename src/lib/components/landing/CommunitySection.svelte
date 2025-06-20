<script lang="ts">
	import { faDiscord } from '@fortawesome/free-brands-svg-icons';
	import { faBell, faQuestionCircle, faUsers } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
</script>

<section id="community" class="mx-auto my-20 max-w-7xl">
	<div class="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
		<div>
			<h2 class="mb-6 text-4xl font-semibold text-gray-800 dark:text-gray-100">
				Join Our Thriving Community
			</h2>
			<p class="mb-6 text-lg text-gray-600 dark:text-gray-400">
				Connect with fellow server hunters, share strategies, and stay ahead of the curve. Our
				community is where the best deals are discovered and shared.
			</p>
			<div class="mb-8 space-y-4">
				<div class="flex items-center gap-3">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900"
					>
						<FontAwesomeIcon icon={faUsers} class="h-4 w-4 text-blue-600 dark:text-blue-400" />
					</div>
					<span class="text-gray-700 dark:text-gray-300">100+ active members sharing tips</span>
				</div>
				<div class="flex items-center gap-3">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
					>
						<FontAwesomeIcon icon={faBell} class="h-4 w-4 text-green-600 dark:text-green-400" />
					</div>
					<span class="text-gray-700 dark:text-gray-300"
						>Real-time deal alerts and notifications</span
					>
				</div>
				<div class="flex items-center gap-3">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900"
					>
						<FontAwesomeIcon
							icon={faQuestionCircle}
							class="h-4 w-4 text-purple-600 dark:text-purple-400"
						/>
					</div>
					<span class="text-gray-700 dark:text-gray-300"
						>Expert help with server configurations</span
					>
				</div>
			</div>
			<Button href="https://discord.gg/dcuGfURbdc" size="lg" class="shadow-sm" color="primary">
				<FontAwesomeIcon icon={faDiscord} class="mr-2" />
				Join Discord Community
				<ArrowRightOutline class="ms-2 h-5 w-5" />
			</Button>
		</div>
		<div
			class="rounded-lg border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-100 p-8 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-700"
		>
			<h3 class="mb-4 text-xl font-bold text-gray-800 dark:text-gray-100">
				🎯 Community Highlights
			</h3>
			<div class="space-y-4">
				<div
					class="rounded-lg border-2 border-gray-300 bg-white p-4 dark:border-gray-500 dark:bg-gray-800"
				>
					<div class="flex items-start gap-3">
						<img src="/images/user1.webp" alt="User" class="h-8 w-8 rounded-full" loading="lazy" />
						<div class="flex-1">
							<p class="text-sm text-gray-700 dark:text-gray-300">
								"Just saved €200 on a perfect server thanks to the community's price alerts! 🎉"
							</p>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">— Alex, 2 hours ago</p>
						</div>
					</div>
				</div>
				<div
					class="rounded-lg border-2 border-gray-300 bg-white p-4 dark:border-gray-500 dark:bg-gray-800"
				>
					<div class="flex items-start gap-3">
						<img src="/images/user2.webp" alt="User" class="h-8 w-8 rounded-full" loading="lazy" />
						<div class="flex-1">
							<p class="text-sm text-gray-700 dark:text-gray-300">
								"CAX41 available in Falkenstein! Setting up alerts for everyone interested."
							</p>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">— Maria, 1 day ago</p>
						</div>
					</div>
				</div>
				<div class="text-center">
					<p class="text-xs text-gray-500 dark:text-gray-400">
						💬 Join the conversation and discover your next great deal
					</p>
				</div>
			</div>
		</div>
	</div>
</section>
