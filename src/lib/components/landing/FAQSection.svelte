<script lang="ts">
	import { Accordion, AccordionItem } from 'flowbite-svelte';

	type AnswerSegment = string | { text: string; href: string };
	type FaqItem = { question: string; answer: AnswerSegment[] };

	const faqItems: FaqItem[] = [
		{
			question: 'Is Server Radar free?',
			answer: ['Yes. All features including alerts are free. The project is open source.']
		},
		{
			question: 'How often is the data updated?',
			answer: ['Auction and cloud availability data is updated every few minutes.']
		},
		{
			question: 'How do alerts work?',
			answer: [
				'Create an account and configure alerts for auction prices or cloud availability. When a match is found, you receive a notification via email or Discord webhook.'
			]
		},
		{
			question: 'What data do you collect?',
			answer: [
				'Email address (for account/notifications) and Discord webhook URL (if configured). Server auction data is public information from Hetzner. See the ',
				{ text: 'Privacy Policy', href: '/privacy' },
				' for details.'
			]
		},
		{
			question: 'Can I contribute?',
			answer: [
				'Yes. The source code is on ',
				{ text: 'GitHub', href: 'https://github.com/elsbrock/hetzner-radar' },
				'. Bug reports, feature requests, and pull requests are welcome.'
			]
		}
	];
</script>

<section id="faq" class="border-b border-gray-200 bg-white py-20 md:py-28 dark:border-gray-800 dark:bg-gray-950">
	<div class="mx-auto max-w-3xl px-6">
		<h2 class="mb-12 text-center text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
			Frequently asked questions
		</h2>
		
		<div class="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
			<Accordion class="divide-y divide-gray-200 dark:divide-gray-800">
				{#each faqItems as item (item.question)}
					<AccordionItem class="border-0">
						<span slot="header" class="text-base font-medium text-gray-900 dark:text-white">
							{item.question}
						</span>
						<p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
							{#each item.answer as segment, i (i)}
								{#if typeof segment === 'string'}
									{segment}
								{:else}
									<a href={segment.href} class="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
										{segment.text}
									</a>
								{/if}
							{/each}
						</p>
					</AccordionItem>
				{/each}
			</Accordion>
		</div>
	</div>
</section>
