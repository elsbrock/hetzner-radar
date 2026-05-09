<script lang="ts">
	import {
		Footer,
		FooterCopyright,
		FooterIcon,
		FooterLink,
		FooterLinkGroup
	} from 'flowbite-svelte';
	import { DiscordSolid, GithubSolid } from 'flowbite-svelte-icons';
	import Radar from './Radar.svelte';
	import { resolve } from '$app/paths';
	const buildDate = import.meta.env.VITE_BUILD_STAMP;
</script>

<Footer footerType="socialmedia" class="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
	<div class="mx-auto max-w-6xl px-6 py-12">
		<div class="grid grid-cols-1 gap-10 md:grid-cols-12">
			<!-- Brand Column -->
			<div class="md:col-span-5">
				<a href={resolve('/')} class="flex items-center gap-3">
					<div class="flex h-7 w-7 items-center justify-center">
						<Radar />
					</div>
					<span class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
						Server Radar
					</span>
				</a>
				<p class="mt-4 max-w-sm text-sm leading-relaxed text-gray-600 dark:text-gray-400">
					Track Hetzner dedicated server auction prices, analyze historical trends, and set up custom alerts. Open-source and free to use.
				</p>
				<div class="mt-6 flex items-center gap-4">
					<a
						href="https://github.com/elsbrock/hetzner-radar"
						class="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-white"
						aria-label="GitHub"
					>
						<GithubSolid class="h-4 w-4" />
					</a>
					<a
						href="https://discord.gg/dcuGfURbdc"
						class="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-white"
						aria-label="Discord"
					>
						<DiscordSolid class="h-4 w-4" />
					</a>
				</div>
			</div>

			<!-- Links Columns -->
			<div class="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
				<div>
					<h3 class="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
						Resources
					</h3>
					<ul class="mt-4 space-y-3">
						<li>
							<a
								href="/configurations"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Configurations
							</a>
						</li>
						<li>
							<a
								href="/statistics"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Statistics
							</a>
						</li>
						<li>
							<a
								href="/cloud-status"
								data-testid="footer-link-cloud-status"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Cloud Availability
							</a>
						</li>
						<li>
							<a
								href="/analyze"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Analyze
							</a>
						</li>
					</ul>
				</div>
				<div>
					<h3 class="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
						Community
					</h3>
					<ul class="mt-4 space-y-3">
						<li>
							<a
								href="https://github.com/elsbrock/hetzner-radar"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								GitHub
							</a>
						</li>
						<li>
							<a
								href="https://discord.gg/dcuGfURbdc"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Discord
							</a>
						</li>
						<li>
							<a
								href="/about"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								About
							</a>
						</li>
					</ul>
				</div>
				<div>
					<h3 class="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
						Legal
					</h3>
					<ul class="mt-4 space-y-3">
						<li>
							<a
								href="/privacy"
								data-testid="footer-link-privacy"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Privacy Policy
							</a>
						</li>
						<li>
							<a
								href="/terms"
								data-testid="footer-link-terms"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Terms of Service
							</a>
						</li>
						<li>
							<a
								href="/contact"
								data-testid="footer-link-contact"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Contact
							</a>
						</li>
						<li>
							<a
								href="/changelog"
								data-testid="footer-link-changelog"
								class="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Changelog
							</a>
						</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- Bottom Bar -->
		<div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 dark:border-gray-800 sm:flex-row">
			<div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
				<span data-testid="footer-copyright">
					&copy; {new Date().getFullYear()} Server Radar
				</span>
				{#if buildDate}
					<span class="hidden sm:inline">·</span>
					<span class="hidden text-xs sm:inline">
						Updated {buildDate}
					</span>
				{/if}
			</div>
			<p class="text-center text-xs text-gray-500 dark:text-gray-500 sm:text-right">
				Not affiliated with Hetzner Online GmbH
			</p>
		</div>
	</div>
</Footer>
