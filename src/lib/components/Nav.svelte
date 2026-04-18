<script lang="ts">
	import { navigating, page } from '$app/stores'; // <-- Import navigating
	import {
		faBell,
		faBinoculars,
		faChartLine,
		faCircleInfo,
		faCloud,
		faGavel,
		faHouse,
		faKey,
		faList,
		faRightFromBracket,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		Badge,
		Button,
		Navbar,
		NavBrand,
		NavHamburger,
		NavLi,
		NavUl
	} from 'flowbite-svelte';
	import Radar from './Radar.svelte';
	import SettingsPopup from '$lib/components/SettingsPopup.svelte';

	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { session } from '$lib/stores/session';
	import { settingsStore } from '$lib/stores/settings';

	let activeUrl = $derived($page.url.pathname);
	let isHoveringAlerts = $state(false);
	let isNavOpen = $state(false); // State for mobile nav visibility
	let isActuallyNavigating = $derived($navigating !== null);
	let isVisible = $state(false); // Controls opacity
	let isAnimating = $state(false); // Controls animation class
	let hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Effect to manage the loading bar states gracefully
	$effect(() => {
		if (isActuallyNavigating) {
			// --- Navigation Started ---
			// Clear any pending hide/fade timeouts
			if (hideTimeoutId) clearTimeout(hideTimeoutId);
			if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
			hideTimeoutId = null;
			fadeTimeoutId = null;

			// Make visible and start animating immediately
			isVisible = true;
			isAnimating = true;
		} else {
			// --- Navigation Ended (or initial load) ---
			// Only proceed if it was previously visible/animating
			if (isVisible || isAnimating) {
				// Don't start hiding if already scheduled
				if (!hideTimeoutId && !fadeTimeoutId) {
					// Let the animation complete its current cycle
					// The animation duration is 0.7s (700ms) as defined in the CSS
					const animationDuration = 700;

					// Wait for the current animation cycle to complete
					// This ensures we don't interrupt mid-animation
					hideTimeoutId = setTimeout(() => {
						// Let the animation finish its current cycle completely
						// before stopping it and fading out
						isAnimating = false; // Stop animation at the end of cycle
						hideTimeoutId = null;

						// Schedule fade out after animation stops
						// Start fade-in immediately without additional delay
						isVisible = false; // Fade out
						fadeTimeoutId = null;
					}, animationDuration); // Wait exactly one animation cycle
				}
			}
		}

		// Cleanup timeouts on component destroy
		return () => {
			if (hideTimeoutId) clearTimeout(hideTimeoutId);
			if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
		};
	});

	// Local reactive state for the theme, initialized from the store
	let theme = $state($settingsStore.theme);

	// Effect to update the store when the local theme state changes
	$effect(() => {
		// Avoid writing back to the store if the change originated from the store itself
		if (theme !== $settingsStore.theme) {
			settingsStore.updateSetting('theme', theme);
		}
	});

	// Effect to update local state if the store changes externally (e.g., another tab)
	// Using .pre ensures this runs before the effect above if both trigger in the same tick
	$effect.pre(() => {
		if ($settingsStore.theme !== theme) {
			theme = $settingsStore.theme;
		}
	});

	// Close nav on navigation
	$effect(() => {
		if ($page.url) {
			// Ensure url is available
			isNavOpen = false;
		}
	});
</script>

<Navbar class="relative h-[4.25rem] w-full">
	<NavBrand href="/">
		<div style="width: 32px; height: 32px">
			<Radar />
		</div>
		<div class="ml-5 leading-none md:-mt-1">
			<span class="self-center text-xl font-semibold whitespace-nowrap text-black dark:text-white">
				Server Radar <Badge>beta</Badge>
			</span>
			<span class="block text-xs text-gray-500 dark:text-gray-200"
				>Prices. Availability. Alerts.</span
			>
		</div>
	</NavBrand>

	<!-- Vertical separator after brand (desktop only) -->
	<div class="mx-4 hidden h-8 w-px bg-gray-300 xl:block dark:bg-gray-600"></div>

	<div class="hidden items-center md:order-2 xl:flex">
		{#if $session}
			<!-- Alerts button for logged-in users -->
			<Button
				size="sm"
				href="/alerts"
				class="p-1.5 px-3"
				onmouseenter={() => (isHoveringAlerts = true)}
				onmouseleave={() => (isHoveringAlerts = false)}
			>
				<FontAwesomeIcon class="me-2 h-4 w-4" icon={faBell} shake={isHoveringAlerts} />
				Alerts
			</Button>
			<div class="mx-3 h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

			<!-- Desktop Settings Icon -->
			<a
				href={resolve('/settings')}
				data-testid="nav-settings-desktop"
				class="mr-2 flex aspect-square h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
				aria-label="Settings"
			>
				<FontAwesomeIcon class="h-4 w-4" icon={faUser} />
			</a>

			<!-- Desktop Sign Out -->
			<form
				action="/auth/logout"
				method="POST"
				use:enhance={() => {
					session.set(null);
					return goto(resolve('/auth/logout'));
				}}
				class="mr-3"
			>
				<Button
					data-testid="nav-signout-desktop"
					outline
					class="bg-white p-2 dark:bg-inherit"
					type="submit"
					aria-label="Sign Out"
				>
					<FontAwesomeIcon class="h-4 w-4" icon={faRightFromBracket} />
				</Button>
			</form>
		{:else}
			<!-- Desktop Sign In -->
			<Button
				data-testid="nav-signin-desktop"
				outline
				class="mr-3 bg-white p-2 dark:bg-inherit"
				href="/auth/login"
			>
				<FontAwesomeIcon class="me-2 h-4 w-4" icon={faKey} /> Sign In
			</Button>
		{/if}

		<!-- Settings popup (includes dark mode) -->
		<SettingsPopup />
	</div>

	<div class="flex md:order-2 xl:hidden">
		<Button href="/analyze" aria-label="Auctions" size="xs">
			<FontAwesomeIcon class="h-5 w-5" icon={faBinoculars} /><span class="ml-2 hidden md:inline">
				Auctions</span
			>
		</Button>
		<NavHamburger
			data-testid="nav-hamburger"
			class="md:block! xl:hidden!"
			onclick={() => (isNavOpen = !isNavOpen)}
		/>
	</div>

	<NavUl
		hidden={!isNavOpen}
		slideParams={{ duration: 250, delay: 0 }}
		class="order-1"
		divClass="w-full xl:block xl:w-auto xl:flex-1"
		ulClass="flex flex-col p-4 mt-4 xl:flex-row xl:space-x-1 rtl:space-x-reverse xl:mt-0 xl:text-sm xl:font-medium"
		{activeUrl}
	>
		<NavLi href="/" data-testid="nav-link-home" class="bg-transparent!">
			<span
				class="rounded-full px-3 py-1.5 text-sm transition-all {activeUrl === '/'
					? 'bg-orange-100 font-medium text-gray-900 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:text-white dark:ring-orange-600/60'
					: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
				><FontAwesomeIcon class="mr-1.5 h-3.5 w-3.5 opacity-60" icon={faHouse} />Home</span
			>
		</NavLi>
		<NavLi href="/configurations" data-testid="nav-link-configurations" class="bg-transparent!">
			<span
				class="rounded-full px-3 py-1.5 text-sm transition-all {activeUrl === '/configurations'
					? 'bg-orange-100 font-medium text-gray-900 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:text-white dark:ring-orange-600/60'
					: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
				><FontAwesomeIcon class="mr-1.5 h-3.5 w-3.5 opacity-60" icon={faList} />Configurations</span
			>
		</NavLi>
		<NavLi href="/analyze" data-testid="nav-link-analyze" class="bg-transparent!">
			<span
				class="rounded-full px-3 py-1.5 text-sm transition-all {activeUrl === '/analyze'
					? 'bg-orange-100 font-medium text-gray-900 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:text-white dark:ring-orange-600/60'
					: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
				><FontAwesomeIcon class="mr-1.5 h-3.5 w-3.5 opacity-60" icon={faGavel} />Auctions</span
			>
		</NavLi>
		<NavLi href="/cloud-status" data-testid="nav-link-cloud-status" class="bg-transparent!">
			<span
				class="rounded-full px-3 py-1.5 text-sm transition-all {activeUrl === '/cloud-status'
					? 'bg-orange-100 font-medium text-gray-900 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:text-white dark:ring-orange-600/60'
					: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
				><FontAwesomeIcon class="mr-1.5 h-3.5 w-3.5 opacity-60" icon={faCloud} />Cloud</span
			>
		</NavLi>
		<NavLi href="/statistics" data-testid="nav-link-statistics" class="bg-transparent!">
			<span
				class="rounded-full px-3 py-1.5 text-sm transition-all {activeUrl === '/statistics'
					? 'bg-orange-100 font-medium text-gray-900 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:text-white dark:ring-orange-600/60'
					: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
				><FontAwesomeIcon class="mr-1.5 h-3.5 w-3.5 opacity-60" icon={faChartLine} />Statistics</span
			>
		</NavLi>
		<NavLi href="/about" data-testid="nav-link-about" class="bg-transparent!">
			<span
				class="rounded-full px-3 py-1.5 text-sm transition-all {activeUrl === '/about'
					? 'bg-orange-100 font-medium text-gray-900 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:text-white dark:ring-orange-600/60'
					: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
				><FontAwesomeIcon class="mr-1.5 h-3.5 w-3.5 opacity-60" icon={faCircleInfo} />About</span
			>
		</NavLi>

		{#if $session}
			<!-- Settings only shown on mobile in navbar -->
			<NavLi href="/settings" data-testid="nav-link-settings" class="bg-transparent! xl:hidden">
				<span
					class="rounded-full px-4 py-1.5 text-base transition-all {activeUrl === '/settings'
						? 'bg-orange-100 font-medium text-gray-900 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:text-white dark:ring-orange-600/60'
						: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
					>Settings</span
				>
			</NavLi>
			<!-- Mobile only container for controls -->
			<div
				class="mt-2 flex items-center justify-between border-t p-2 xl:hidden dark:border-gray-700"
			>
				<form
					action="/auth/logout"
					method="POST"
					use:enhance={() => {
						session.set(null);
						return goto(resolve('/auth/logout'));
					}}
					class="mr-2 grow"
				>
					<Button
						data-testid="nav-signout-mobile"
						outline
						class="w-full bg-white dark:bg-inherit"
						type="submit"
					>
						<FontAwesomeIcon class="me-2 h-4 w-4" icon={faRightFromBracket} /> Sign Out
					</Button>
				</form>
				<!-- Settings popup (includes dark mode) -->
				<SettingsPopup />
			</div>
		{:else}
			<!-- Mobile only container for controls -->
			<div
				class="mt-2 flex items-center justify-between border-t p-2 xl:hidden dark:border-gray-700"
			>
				<Button
					data-testid="nav-signin-mobile"
					outline
					class="mr-2 grow bg-white dark:bg-inherit"
					href="/auth/login"
				>
					<FontAwesomeIcon class="me-2 h-4 w-4" icon={faKey} /> Sign In
				</Button>
				<!-- Settings popup (includes dark mode) -->
				<SettingsPopup />
			</div>
		{/if}
		<!-- Removed separate mobile DarkMode NavLi -->
	</NavUl>

	<div
		class="{isVisible
			? 'fade-out-gradient'
			: 'fade-in-gradient'} absolute inset-x-0 bottom-0 h-[50px] translate-y-0 overflow-hidden"
		style="background: radial-gradient(ellipse 80% 50px at 50% 100%, rgba(249, 115, 22, 0.15), transparent 60%); pointer-events: none;"
	></div>
</Navbar>

<!-- Loading Indicator -->
<div class="relative h-[2px] w-full overflow-hidden">
	<!-- Static bar, visible when animated bar is not -->
	<div
		class="absolute inset-0 h-[2px] bg-linear-to-r from-transparent via-orange-500 to-transparent transition-opacity duration-300 {isVisible
			? 'opacity-0'
			: 'opacity-100'}"
	></div>
	<!-- Animated bar -->
	<div
		class="absolute inset-0 -left-full h-[2px] w-[300%] bg-linear-to-r from-transparent via-orange-500 to-transparent bg-size-[33.33%_100%] bg-repeat-x transition-opacity duration-300 {isVisible
			? 'opacity-100'
			: 'opacity-0'} {isAnimating ? 'animate-loading-bar' : ''}"
	></div>
</div>

<style>
	@keyframes loading-bar {
		0% {
			transform: translateX(0%);
		}
		100% {
			transform: translateX(33.33%); /* Move exactly one pattern width */
		}
	}
	.animate-loading-bar {
		animation: loading-bar 0.7s infinite linear;
	}

	/* Separate transition durations for fade-in and fade-out */
	.fade-out-gradient {
		opacity: 0;
		transition: opacity 300ms ease;
	}

	.fade-in-gradient {
		opacity: 1;
		transition: opacity 300ms ease; /* Faster fade-in */
	}
</style>
