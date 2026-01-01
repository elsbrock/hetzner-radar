<script lang="ts">
	import { page as _page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { Timeline, TimelineItem } from 'flowbite-svelte';
</script>

<svelte:head>
	<title>Changelog - Server Radar</title>
	<meta name="description" content="Latest features and improvements to Server Radar" />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Changelog</h1>
		<p class="text-gray-600 dark:text-gray-400">Latest features and improvements to Server Radar</p>
	</div>

	<Timeline>
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
