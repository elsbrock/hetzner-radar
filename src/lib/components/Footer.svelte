<script lang="ts">
	import {
		Footer,
		FooterCopyright,
		FooterIcon,
		FooterLink,
		FooterLinkGroup
	} from 'flowbite-svelte';
	import { DiscordSolid, GithubSolid } from 'flowbite-svelte-icons';
	import ServerIcon from '$lib/components/ServerIcon.svelte';
	import Radar from './Radar.svelte';
	const buildDate = import.meta.env.VITE_BUILD_STAMP;
</script>

<Footer footerType="socialmedia" class="border-t border-gray-200 dark:border-gray-700">
	<div class="mx-auto max-w-7xl md:flex md:justify-between">
		<div class="mb-6 ml-4 md:mb-0 md:max-w-xl">
			<div class="flex flex-col">
				<a href="/" class="flex items-center">
					<div style="width: 18px; height: 18px" class="mr-3 flex-shrink-0">
						<Radar />
					</div>
					<span
						class="mt-[10px] ml-5 text-lg leading-none font-semibold whitespace-nowrap text-gray-900 dark:text-white"
						>Server Radar</span
					>
				</a>
				<p class="mt-5 text-xs text-gray-500 dark:text-gray-400">
					Track Hetzner dedicated server auction prices in real-time, analyze historical pricing
					trends, set up custom price alerts with email and Discord notifications, and discover the
					best value dedicated server deals. Our completely free, open-source community-driven
					platform helps you make informed purchasing decisions and never miss great auction
					opportunities.
				</p>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-4 md:justify-start">
			<div>
				<h2 class="mb-2 text-xs font-semibold text-gray-900 uppercase dark:text-white">
					Resources
				</h2>
				<FooterLinkGroup ulClass="space-y-1">
					<FooterLink
						href="/configurations"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>Configurations</FooterLink
					>
					<FooterLink
						href="/statistics"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>Statistics</FooterLink
					>
					<FooterLink
						data-testid="footer-link-cloud-status"
						href="/cloud-status"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>Cloud Availability</FooterLink
					>
					<FooterLink
						href="/analyze"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>Analyze</FooterLink
					>
				</FooterLinkGroup>
			</div>
			<div>
				<h2 class="mb-2 text-xs font-semibold text-gray-900 uppercase dark:text-white">
					Follow us
				</h2>
				<FooterLinkGroup ulClass="space-y-1">
					<FooterLink
						href="https://github.com/elsbrock/hetzner-radar"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>GitHub</FooterLink
					>
					<FooterLink
						href="https://discord.gg/dcuGfURbdc"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>Discord</FooterLink
					>
				</FooterLinkGroup>
			</div>
			<div>
				<h2 class="mb-2 text-xs font-semibold text-gray-900 uppercase dark:text-white">Legal</h2>
				<FooterLinkGroup ulClass="space-y-1">
					<FooterLink
						data-testid="footer-link-privacy"
						href="/privacy"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>Privacy Policy</FooterLink
					>
					<FooterLink
						data-testid="footer-link-terms"
						href="/terms"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>Terms & Conditions</FooterLink
					>
					<FooterLink
						data-testid="footer-link-contact"
						href="/contact"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>Contact</FooterLink
					>
					<FooterLink
						data-testid="footer-link-changelog"
						href="/changelog"
						liClass="mb-2"
						aClass="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
						>Changelog</FooterLink
					>
				</FooterLinkGroup>
			</div>
		</div>
	</div>
	<div class="mx-auto my-6 max-w-7xl lg:my-8">
		<div
			class="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700"
		></div>
	</div>
	<div class="relative mx-auto max-w-7xl sm:flex sm:items-center sm:justify-between">
		<div class="flex items-center sm:flex-1">
			<FooterCopyright
				data-testid="footer-copyright"
				href="/"
				by="Server Radar."
				year={new Date().getFullYear()}
			/>
			{#if buildDate}
				<p class="text-italic ml-4 text-xs text-gray-500 dark:text-gray-400">
					Last Update {buildDate} (Europe/Berlin)
				</p>
			{/if}
		</div>
		<div class="absolute left-1/2 hidden -translate-x-1/2 transform sm:block">
			<!-- Server Icon perfectly centered -->
			<ServerIcon
				width="120px"
				height="auto"
				className="opacity-70 hover:opacity-100 transition-opacity"
			/>
		</div>
		<div class="flex space-x-4 sm:flex-1 sm:justify-end rtl:space-x-reverse">
			<FooterIcon href="https://discord.gg/dcuGfURbdc">
				<DiscordSolid
					class="h-6 w-6 text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white"
				/>
			</FooterIcon>
			<FooterIcon href="https://github.com/elsbrock/hetzner-radar">
				<GithubSolid
					class="h-6 w-6 text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white"
				/>
			</FooterIcon>
		</div>
	</div>
</Footer>
