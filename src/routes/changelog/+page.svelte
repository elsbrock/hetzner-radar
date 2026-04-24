<script lang="ts">
	import { page as _page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { Timeline, TimelineItem } from 'flowbite-svelte';

	const canonical = 'https://radar.iodev.org/changelog';
	const ogImage = 'https://radar.iodev.org/images/og-image.webp';
	const description =
		'Release notes for Server Radar: new features, filters, alerts, and data improvements across Hetzner auction and cloud server tracking, in reverse order.';

	type Entry = { headline: string; datePublished: string };
	const entries: Entry[] = [
		{ headline: 'Standard Dedicated Server Support', datePublished: '2026-01-03' },
		{ headline: 'Enhanced Cloud Status Visualization', datePublished: '2025-11-06' },
		{ headline: 'Cloud Availability Alerts', datePublished: '2025-06-03' },
		{ headline: 'Discord Integration', datePublished: '2025-06-01' },
		{ headline: 'Statistics & Sold Price Tracking', datePublished: '2025-05-06' },
		{ headline: 'Navigation & UI Improvements', datePublished: '2025-05-04' },
		{ headline: 'Auction Alert Management', datePublished: '2025-05-02' },
		{ headline: 'Result Grouping & Card Stack', datePublished: '2025-04-27' },
		{ headline: 'Collapsible Filter Panel', datePublished: '2025-04-27' },
		{ headline: 'Cloud Server Availability Monitoring', datePublished: '2025-04-22' },
		// Older entries only have month-level granularity in the page copy.
		{ headline: 'Chart System Upgrade', datePublished: '2024-11-01' },
		{ headline: 'Filter Persistence & Toast System', datePublished: '2024-10-01' },
		{ headline: 'Advanced Filtering', datePublished: '2024-08-01' }
	];

	const blogJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Blog',
		name: 'Server Radar Changelog',
		description,
		url: canonical,
		publisher: {
			'@type': 'Person',
			name: 'Simon Elsbrock',
			url: 'https://radar.iodev.org/'
		},
		blogPost: entries.map((e) => ({
			'@type': 'BlogPosting',
			headline: e.headline,
			datePublished: e.datePublished,
			url: canonical,
			author: {
				'@type': 'Person',
				name: 'Simon Elsbrock'
			}
		}))
	};

	const breadcrumbJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{
				'@type': 'ListItem',
				position: 1,
				name: 'Home',
				item: 'https://radar.iodev.org/'
			},
			{
				'@type': 'ListItem',
				position: 2,
				name: 'Changelog',
				item: canonical
			}
		]
	};
</script>

<svelte:head>
	<title>Changelog | Server Radar</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />

	<!-- Open Graph -->
	<meta property="og:title" content="Changelog | Server Radar" />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={ogImage} />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Changelog | Server Radar" />
	<meta name="twitter:description" content={description} />

	<!-- Structured Data -->
	{@html `<script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</` + `script>`}
	{@html `<script type="application/ld+json">${JSON.stringify(blogJsonLd)}</` + `script>`}
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Changelog</h1>
		<p class="text-gray-600 dark:text-gray-400">Latest features and improvements to Server Radar</p>
	</div>

	<Timeline>
		<TimelineItem title="Standard Dedicated Server Support" date="Released on January 3rd, 2026">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Browse Hetzner's standard dedicated servers alongside auction servers in a unified view:
			</p>
			<ul class="ml-4 list-inside list-disc space-y-1 text-gray-500 dark:text-gray-400">
				<li>Filter between auction and standard servers with new toggle options</li>
				<li>Visual badges distinguish server types at a glance</li>
				<li>Direct links to Hetzner's product pages for standard servers</li>
				<li>Backwards compatible with existing auction alerts</li>
			</ul>
		</TimelineItem>
		<TimelineItem title="Enhanced Cloud Status Visualization" date="Released on November 6th, 2025">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Completely redesigned cloud status page with improved data visualization and user
				experience:
			</p>
			<ul class="ml-4 list-inside list-disc space-y-1 text-gray-500 dark:text-gray-400">
				<li>
					Summary statistics cards showing overall availability, best/worst locations, and scarcest
					server types
				</li>
				<li>
					Interactive filters for availability status, architecture, CPU type, and server name
					search
				</li>
				<li>Collapsible server type groups with expandable/collapsible sections</li>
				<li>Color-coded background cells for better availability status recognition</li>
				<li>Additional "Available In" column showing availability counts per server type</li>
				<li>Location availability percentage summary row</li>
				<li>Mobile-optimized responsive design with simplified location headers</li>
			</ul>
		</TimelineItem>
		<TimelineItem title="Cloud Availability Alerts" date="Released on June 3rd, 2025">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Get notified when your preferred cloud server configurations become available. Set up alerts
				for specific server types, locations, and pricing thresholds.
			</p>
		</TimelineItem>
		<TimelineItem title="Discord Integration" date="Released on June 1st, 2025">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Comprehensive Discord notification system with dual-channel support. Get alerts directly in
				your Discord server for auction and cloud availability updates.
			</p>
		</TimelineItem>
		<TimelineItem title="Statistics & Sold Price Tracking" date="Released on May 6th, 2025">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Added sold auction price tracking and enhanced statistics page with quick stats overview,
				price trends, and volume comparisons.
			</p>
		</TimelineItem>
		<TimelineItem title="Navigation & UI Improvements" date="Released on May 4th, 2025">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Redesigned navigation with improved desktop layout and loading indicators.
			</p>
		</TimelineItem>
		<TimelineItem title="Auction Alert Management" date="Released on May 2nd, 2025">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Advanced auction view system allowing users to track and manage their auction alerts with
				detailed matching history.
			</p>
		</TimelineItem>
		<TimelineItem title="Result Grouping & Card Stack" date="Released on April 27th, 2025">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Intelligent result grouping functionality and interactive card stack display for better data
				visualization on the landing page.
			</p>
		</TimelineItem>
		<TimelineItem title="Collapsible Filter Panel" date="Released on April 27th, 2025">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Responsive collapsible filter panel with different display modes for desktop and mobile.
				Improved user experience with better transitions and icons.
			</p>
		</TimelineItem>
		<TimelineItem title="Cloud Server Availability Monitoring" date="Released on April 22nd, 2025">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Real-time monitoring of Hetzner's cloud server availability across all locations. Live
				status page with color-coded indicators and accessibility features for color-blind users.
			</p>
		</TimelineItem>
		<TimelineItem title="Chart System Upgrade" date="Released on November 2024">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Switched from D3 to ApexCharts for better performance and added stacked charts for enhanced
				data visualization.
			</p>
		</TimelineItem>
		<TimelineItem title="Filter Persistence & Toast System" date="Released on October 2024">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Added filter persistence across sessions and comprehensive toast notification system. Major
				page rework with improved layouts.
			</p>
		</TimelineItem>
		<TimelineItem title="Advanced Filtering" date="Released on August 2024">
			<p class="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
				Dual range sliders, RPS filtering, recently seen servers filter, and shareable filter URLs
				for better user experience.
			</p>
		</TimelineItem>
	</Timeline>

	<div class="mt-12 text-center">
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Want to suggest a feature or report a bug?
			<a href={resolve('/contact')} class="text-blue-600 hover:underline dark:text-blue-400">Get in touch</a>
		</p>
	</div>
</div>
