<script lang="ts">
	import { Accordion, AccordionItem } from 'flowbite-svelte';

	const faqItems = [
		{
			question: 'Is Server Radar free?',
			answer:
				'Yes. All features including alerts are free. The project is open source.'
		},
		{
			question: 'How often is the data updated?',
			answer:
				'Auction data is fetched hourly. Cloud availability is checked more frequently.'
		},
		{
			question: 'How do alerts work?',
			answer:
				'Create an account and configure alerts for auction prices or cloud availability. When a match is found, you receive a notification via email or Discord webhook.'
		},
		{
			question: 'What data do you collect?',
			answer:
				'Email address (for account/notifications) and Discord webhook URL (if configured). Server auction data is public information from Hetzner. See the <a href="/privacy" class="text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</a> for details.'
		},
		{
			question: 'Can I contribute?',
			answer:
				'Yes. The source code is on <a href="https://github.com/elsbrock/hetzner-radar" class="text-blue-600 hover:underline dark:text-blue-400">GitHub</a>. Bug reports, feature requests, and pull requests are welcome.'
		}
	];
</script>

<section id="faq" class="mx-auto my-20 max-w-4xl">
	<h2 class="mb-8 text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">FAQ</h2>
	<div
		class="rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
	>
		<Accordion class="divide-y divide-gray-200 dark:divide-gray-700">
			{#each faqItems as item (item.question)}
				<AccordionItem class="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
					<span slot="header" class="text-base font-semibold text-gray-800 dark:text-gray-100">
						{item.question}
					</span>
					<p class="leading-relaxed text-gray-600 dark:text-gray-400">
						{@html item.answer}
					</p>
				</AccordionItem>
			{/each}
		</Accordion>
	</div>
</section>
