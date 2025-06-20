<script lang="ts">
	import { Accordion, AccordionItem } from 'flowbite-svelte';

	const faqItems = [
		{
			question: 'Is Server Radar really free?',
			answer:
				'Yes! Server Radar is completely free and open source. We believe in providing value to the community without barriers. You can use all features including notifications at no cost.'
		},
		{
			question: 'How often is the auction data updated?',
			answer:
				'We check the Hetzner auction multiple times throughout the day to ensure you have access to the latest server availability and pricing. The "Auctions in Last Batch" counter shows you how many servers we found in our most recent scan.'
		},
		{
			question: 'Can I contribute to the project?',
			answer:
				"Absolutely! Server Radar is open source and we welcome contributions. Whether it's code improvements, bug reports, feature suggestions, or documentation updates, check out our GitHub repository to get started."
		},
		{
			question: 'How do notifications work?',
			answer:
				"We offer two types of alerts: <strong>Auction Price Alerts</strong> notify you when servers hit your target price, and <strong>Cloud Availability Alerts</strong> inform you when specific cloud server types become available in your desired locations. Simply create an account, configure your alerts, and choose your notification channels (email, Discord, etc.). We'll notify you instantly when your conditions are met. No spam, just the alerts you need!"
		},
		{
			question: 'What notification types are supported?',
			answer:
				"Currently we support email notifications and Discord webhooks for both price alerts and cloud availability alerts. We're actively working on adding more notification channels like Slack, Telegram, and webhook integrations to give you maximum flexibility in how you receive alerts."
		},
		{
			question: 'Is my data secure?',
			answer:
				'We take privacy seriously. We only collect minimal data necessary to provide the service (email/Discord info for notifications). All server auction data is publicly available information. Check our Privacy Policy for full details.'
		}
	];
</script>

<section id="faq" class="mx-auto my-20 max-w-7xl">
	<h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
		Frequently Asked Questions
	</h2>
	<p class="mx-auto mb-12 text-center text-gray-600 md:w-2/3 dark:text-gray-400">
		Get quick answers to common questions about Server Radar's features, pricing, and functionality.
	</p>
	<div class="mx-auto max-w-4xl">
		<div
			class="rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
		>
			<Accordion class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each faqItems as item}
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
	</div>
</section>
