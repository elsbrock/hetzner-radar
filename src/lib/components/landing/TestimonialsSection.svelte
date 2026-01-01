<script lang="ts">
	import { Card } from 'flowbite-svelte';
</script>

<section id="testimonials" class="mx-auto my-20 max-w-7xl">
	<h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
		What Our Users Say
	</h2>
	<p class="mx-auto mb-10 text-center text-gray-600 md:w-2/3 dark:text-gray-400">
		Join the community of satisfied users who have optimized their server purchases with <strong
			>Server Radar</strong
		>'s comprehensive tools and real-time alerts. Hear from those who have benefited from our
		advanced features and seamless monitoring.
	</p>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
		<Card
			class="flex flex-col justify-between border border-gray-100 shadow-xs dark:border-gray-700"
		>
			<p class="mb-3 text-gray-600 italic dark:text-gray-400">
				"As a startup founder, Server Radar helps me stretch our infrastructure budget. The
				open-source nature means I can trust it and even contribute features we need!"
			</p>
			<div class="flex items-center">
				<img
					src="/images/user1.webp"
					alt="Alex Johnson"
					class="mr-4 h-12 w-12 rounded-full"
					loading="lazy"
				/>
				<div>
					<p class="font-semibold text-gray-800 dark:text-gray-100">Alex Johnson</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">Web Developer</p>
				</div>
			</div>
		</Card>

		<Card
			class="flex flex-col justify-between border border-gray-100 shadow-xs dark:border-gray-700"
		>
			<p class="mb-3 text-gray-600 italic dark:text-gray-400">
				"The transparency of open source combined with the powerful filtering makes this my go-to
				tool. Saved hundreds of euros and joined an amazing community!"
			</p>
			<div class="flex items-center">
				<img
					src="/images/user2.webp"
					alt="Maria Lopez"
					class="mr-4 h-12 w-12 rounded-full"
					loading="lazy"
				/>
				<div>
					<p class="font-semibold text-gray-800 dark:text-gray-100">Maria Lopez</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">System Administrator</p>
				</div>
			</div>
		</Card>

		<Card
			class="flex flex-col justify-between border border-gray-100 shadow-xs dark:border-gray-700"
		>
			<p class="mb-3 text-gray-600 italic dark:text-gray-400">
				"I love that it's community-driven. Filed a feature request on GitHub and it was implemented
				within days. This is how software should be built – by users, for users."
			</p>
			<div class="flex items-center">
				<img
					src="/images/user3.webp"
					alt="Liam Smith"
					class="mr-4 h-12 w-12 rounded-full"
					loading="lazy"
				/>
				<div>
					<p class="font-semibold text-gray-800 dark:text-gray-100">Liam Smith</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">IT Consultant</p>
				</div>
			</div>
		</Card>
	</div>
</section>
