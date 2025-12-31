<script lang="ts">
	import { navigating, page } from '$app/stores'; // <-- Import navigating
	import {
		faBell,
		faBinoculars,
		faChartSimple,
		faCircleInfo,
		faCloud,
		faCog,
		faHouse,
		faKey,
		faRightFromBracket,
		faServer
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		Badge,
		Button,
		DarkMode,
		Navbar,
		NavBrand,
		NavHamburger,
		NavLi,
		NavUl
	} from 'flowbite-svelte';
	import Radar from './Radar.svelte';

	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { session } from '$lib/stores/session';
	import { settingsStore } from '$lib/stores/settings';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';

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

<Navbar class="relative h-15 w-full">
	<NavBrand href="/">
		<div style="width: 32px; height: 32px">
			<Radar />
		</div>
		<div class="ml-5 leading-none md:-mt-1">
			<span class="self-center text-xl font-semibold whitespace-nowrap text-black dark:text-white">
				Server Radar <Badge>beta</Badge>
			</span>
			<span class="block text-xs text-gray-500 dark:text-gray-200"
				>The Hetzner Auction Price Tracker.</span
			>
		</div>
	</NavBrand>

	<div class="hidden items-center md:order-2 lg:flex">
		<Button
			size="md"
			color="alternative"
			href="https://github.com/elsbrock/hetzner-radar"
			class="
            border-gray-400 bg-gray-50
            p-2 px-4
            text-gray-800
            ring-4
            ring-orange-100
            hover:border-orange-400 hover:text-gray-800
            hover:ring-orange-200 dark:border-gray-500
            dark:bg-gray-700 dark:text-gray-200
            dark:ring-orange-900/50 dark:hover:border-orange-500
            dark:hover:text-gray-100 dark:hover:ring-orange-800/50
        "
		>
			<FontAwesomeIcon class="me-2 h-5 w-5" icon={faGithub} />
			Star
		</Button>
		<div class="mx-3 h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

		{#if $session}
			<!-- Desktop Settings Icon -->
			<a
				href={resolve('/settings')}
				data-testid="nav-settings-desktop"
				class="mr-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
				aria-label="Settings"
			>
				<FontAwesomeIcon class="h-5 w-5" icon={faCog} />
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

		<div class="flex items-center">
			<!-- Use DarkMode component directly -->
			<DarkMode />
		</div>
	</div>

	<div class="flex md:order-2 lg:hidden">
		<Button href="/analyze" aria-label="Auctions" size="xs">
			<FontAwesomeIcon class="h-5 w-5" icon={faBinoculars} /><span class="ml-2 hidden md:inline">
				Auctions</span
			>
		</Button>
		<NavHamburger
			data-testid="nav-hamburger"
			class="md:flex"
			onclick={() => (isNavOpen = !isNavOpen)}
		/>
	</div>

	<NavUl hidden={!isNavOpen} slideParams={{ duration: 250, delay: 0 }} class="order-1" {activeUrl}>
		<NavLi href="/" data-testid="nav-link-home" class="flex items-center !bg-transparent">
			<FontAwesomeIcon class="me-2 h-4 w-4 text-gray-700 dark:text-gray-300" icon={faHouse} />
			<span
				class="text-base text-black dark:text-gray-200 {activeUrl === '/'
					? 'border-primary-500 border-b-2'
					: ''}">Home</span
			>
		</NavLi>
		<NavLi
			href="/configurations"
			data-testid="nav-link-configurations"
			class="flex items-center !bg-transparent"
		>
			<FontAwesomeIcon class="me-2 h-4 w-4 text-gray-700 dark:text-gray-300" icon={faServer} />
			<span
				class="text-base text-black dark:text-gray-200 {activeUrl === '/configurations'
					? 'border-primary-500 border-b-2'
					: ''}">Configurations</span
			>
		</NavLi>
		<NavLi href="/analyze" data-testid="nav-link-analyze" class="flex items-center !bg-transparent">
			<FontAwesomeIcon class="me-2 h-4 w-4 text-gray-700 dark:text-gray-300" icon={faBinoculars} />
			<span
				class="text-base text-black dark:text-gray-200 {activeUrl === '/analyze'
					? 'border-primary-500 border-b-2'
					: ''}">Auctions</span
			>
		</NavLi>
		<NavLi
			href="/cloud-status"
			data-testid="nav-link-cloud-status"
			class="flex items-center !bg-transparent"
		>
			<FontAwesomeIcon class="me-2 h-4 w-4 text-gray-700 dark:text-gray-300" icon={faCloud} />
			<span
				class="text-base text-black dark:text-gray-200 {activeUrl === '/cloud-status'
					? 'border-primary-500 border-b-2'
					: ''}">Cloud</span
			>
		</NavLi>
		{#if $session}
			<NavLi
				href="/alerts"
				data-testid="nav-link-alerts"
				class="flex items-center !bg-transparent"
				onmouseenter={() => (isHoveringAlerts = true)}
				onmouseleave={() => (isHoveringAlerts = false)}
			>
				{#if isHoveringAlerts}
					<FontAwesomeIcon class="me-2 h-4 w-4 text-orange-500" icon={faBell} shake />
				{:else}
					<FontAwesomeIcon class="me-2 h-4 w-4 text-orange-500" icon={faBell} />
				{/if}
				<span
					class="text-base text-black dark:text-gray-200 {activeUrl === '/alerts'
						? 'border-primary-500 border-b-2'
						: ''}">Alerts</span
				>
			</NavLi>
		{:else}
			<NavLi
				href="/statistics"
				data-testid="nav-link-statistics"
				class="flex items-center !bg-transparent"
			>
				<FontAwesomeIcon
					class="me-2 h-4 w-4 text-gray-700 dark:text-gray-300"
					icon={faChartSimple}
				/>
				<span
					class="text-base text-black dark:text-gray-200 {activeUrl === '/statistics'
						? 'border-primary-500 border-b-2'
						: ''}">Statistics</span
				>
			</NavLi>
			<NavLi href="/about" data-testid="nav-link-about" class="flex items-center !bg-transparent">
				<FontAwesomeIcon
					class="me-2 h-4 w-4 text-gray-700 dark:text-gray-300"
					icon={faCircleInfo}
				/>
				<span
					class="text-base text-black dark:text-gray-200 {activeUrl === '/about'
						? 'border-primary-500 border-b-2'
						: ''}">About</span
				>
			</NavLi>
		{/if}

		{#if $session}
			<!-- Settings only shown on mobile in navbar -->
			<NavLi
				href="/settings"
				data-testid="nav-link-settings"
				class="flex items-center !bg-transparent md:hidden"
			>
				<FontAwesomeIcon class="me-2 h-4 w-4 text-gray-700 dark:text-gray-300" icon={faCog} />
				<span
					class="text-base text-black dark:text-gray-300 {activeUrl === '/settings'
						? 'border-primary-500 border-b-2'
						: ''}">Settings</span
				>
			</NavLi>
			<!-- Mobile only container for controls -->
			<div
				class="mt-2 flex items-center justify-between border-t p-2 md:hidden dark:border-gray-700"
			>
				<form
					action="/auth/logout"
					method="POST"
					use:enhance={() => {
						session.set(null);
						return goto(resolve('/auth/logout'));
					}}
					class="mr-2 flex-grow"
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
				<!-- Use DarkMode component directly -->
				<DarkMode />
			</div>
		{:else}
			<!-- Mobile only container for controls -->
			<div
				class="mt-2 flex items-center justify-between border-t p-2 md:hidden dark:border-gray-700"
			>
				<Button
					data-testid="nav-signin-mobile"
					outline
					class="mr-2 flex-grow bg-white dark:bg-inherit"
					href="/auth/login"
				>
					<FontAwesomeIcon class="me-2 h-4 w-4" icon={faKey} /> Sign In
				</Button>
				<!-- Use DarkMode component directly -->
				<DarkMode />
			</div>
		{/if}
		<!-- Removed separate mobile DarkMode NavLi -->
	</NavUl>

	<div
		class="{isVisible
			? 'fade-out-gradient'
			: 'fade-in-gradient'} absolute inset-x-0 bottom-0 h-[50px] translate-y-[0px] overflow-hidden"
		style="background: radial-gradient(ellipse 80% 50px at 50% 100%, rgba(249, 115, 22, 0.15), transparent 60%); pointer-events: none;"
	></div>
</Navbar>

<!-- Loading Indicator -->
<div class="relative h-[2px] w-full overflow-hidden">
	<!-- Static bar, visible when animated bar is not -->
	<div
		class="absolute inset-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent transition-opacity duration-300 {isVisible
			? 'opacity-0'
			: 'opacity-100'}"
	></div>
	<!-- Animated bar -->
	<div
		class="absolute inset-0 left-[-100%] h-[2px] w-[300%] bg-gradient-to-r from-transparent via-orange-500 to-transparent bg-[length:33.33%_100%] bg-repeat-x transition-opacity duration-300 {isVisible
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
