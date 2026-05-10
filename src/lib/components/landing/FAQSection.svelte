<script lang="ts">
	import { Accordion, AccordionItem } from 'flowbite-svelte';

	type AnswerSegment = string | { text: string; href: string };
	type FaqItem = { question: string; answer: AnswerSegment[] };

	const linkClass = 'text-blue-600 hover:underline dark:text-blue-400';

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

<section id="faq" class="mx-auto my-24 max-w-4xl">
	<div class="mb-4 text-center">
		<span class="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-400">
			Common Questions
		</span>
	</div>
	<h2 class="mb-10 text-center text-2xl font-bold text-gray-900 dark:text-gray-50">Frequently Asked Questions</h2>
	<div
		class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<Accordion class="divide-y divide-gray-200 dark:divide-gray-700">
			{#each faqItems as item (item.question)}
				<AccordionItem class="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
					<span slot="header" class="text-base font-semibold text-gray-800 dark:text-gray-100">
						{item.question}
					</span>
					<p class="leading-relaxed text-gray-600 dark:text-gray-400">
						{#each item.answer as segment, i (i)}{#if typeof segment === 'string'}{segment}{:else}<a
									href={segment.href}
									class={linkClass}>{segment.text}</a
								>{/if}{/each}
					</p>
				</AccordionItem>
			{/each}
		</Accordion>
	</div>
</section>
