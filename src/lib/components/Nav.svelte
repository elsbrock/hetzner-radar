<script lang="ts">
	import { navigating, page } from '$app/stores';
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
	let isNavOpen = $state(false);
	let isActuallyNavigating = $derived($navigating !== null);
	let isVisible = $state(false);
	let isAnimating = $state(false);
	let hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (isActuallyNavigating) {
			if (hideTimeoutId) clearTimeout(hideTimeoutId);
			if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
			hideTimeoutId = null;
			fadeTimeoutId = null;
			isVisible = true;
			isAnimating = true;
		} else {
			if (isVisible || isAnimating) {
				if (!hideTimeoutId && !fadeTimeoutId) {
					const animationDuration = 700;
					hideTimeoutId = setTimeout(() => {
						isAnimating = false;
						hideTimeoutId = null;
						isVisible = false;
						fadeTimeoutId = null;
					}, animationDuration);
				}
			}
		}

		return () => {
			if (hideTimeoutId) clearTimeout(hideTimeoutId);
			if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
		};
	});

	let theme = $state($settingsStore.theme);

	$effect(() => {
		if (theme !== $settingsStore.theme) {
			settingsStore.updateSetting('theme', theme);
		}
	});

	$effect.pre(() => {
		if ($settingsStore.theme !== theme) {
			theme = $settingsStore.theme;
		}
	});

	$effect(() => {
		if ($page.url) {
			isNavOpen = false;
		}
	});
</script>

<Navbar class="relative z-30 h-16 w-full border-b border-gray-200/80 bg-white/95 backdrop-blur-sm dark:border-gray-800/80 dark:bg-gray-950/95">
	<NavBrand href="/">
		<div class="flex h-8 w-8 items-center justify-center">
			<Radar />
		</div>
		<div class="ml-3">
			<span class="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
				Server Radar
				<Badge class="rounded-md bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-400">BETA</Badge>
			</span>
			<span class="block text-[11px] font-medium text-gray-500 dark:text-gray-400">Hetzner Price Tracker</span>
		</div>
	</NavBrand>

	<div class="mx-6 hidden h-6 w-px bg-gray-200 xl:block dark:bg-gray-800"></div>

	<div class="hidden items-center md:order-2 xl:flex">
		{#if $session}
			<Button
				size="sm"
				href="/alerts"
				class="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow dark:bg-primary-600 dark:hover:bg-primary-500"
				onmouseenter={() => (isHoveringAlerts = true)}
				onmouseleave={() => (isHoveringAlerts = false)}
			>
				<FontAwesomeIcon class="mr-2 h-3.5 w-3.5" icon={faBell} shake={isHoveringAlerts} />
				Alerts
			</Button>
			<div class="mx-4 h-6 w-px bg-gray-200 dark:bg-gray-800"></div>

			<a
				href={resolve('/settings')}
				data-testid="nav-settings-desktop"
				class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
				aria-label="Settings"
			>
				<FontAwesomeIcon class="h-4 w-4" icon={faUser} />
			</a>

			<form
				action="/auth/logout"
				method="POST"
				use:enhance={() => {
					session.set(null);
					return goto(resolve('/auth/logout'));
				}}
				class="ml-2 mr-4"
			>
				<Button
					data-testid="nav-signout-desktop"
					class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
					type="submit"
					aria-label="Sign Out"
				>
					<FontAwesomeIcon class="h-4 w-4" icon={faRightFromBracket} />
				</Button>
			</form>
		{:else}
			<Button
				data-testid="nav-signin-desktop"
				class="mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
				href="/auth/login"
			>
				<FontAwesomeIcon class="mr-2 h-3.5 w-3.5" icon={faKey} />
				Sign In
			</Button>
		{/if}

		<SettingsPopup />
	</div>

	<div class="flex items-center gap-2 md:order-2 xl:hidden">
		<Button href="/analyze" aria-label="Auctions" size="xs" class="rounded-lg bg-primary-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600">
			<FontAwesomeIcon class="h-4 w-4" icon={faBinoculars} />
			<span class="ml-2 hidden md:inline">Auctions</span>
		</Button>
		<NavHamburger
			data-testid="nav-hamburger"
			class="md:block! xl:hidden! rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
			onclick={() => (isNavOpen = !isNavOpen)}
		/>
	</div>

	<NavUl
		hidden={!isNavOpen}
		slideParams={{ duration: 200, delay: 0 }}
		class="order-1"
		divClass="w-full xl:block xl:w-auto xl:flex-1"
		ulClass="flex flex-col p-4 mt-4 xl:flex-row xl:space-x-1 rtl:space-x-reverse xl:mt-0 xl:text-sm xl:font-medium"
		{activeUrl}
	>
		<NavLi href="/" data-testid="nav-link-home" class="bg-transparent!">
			<span
				class="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all {activeUrl === '/'
					? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
					: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white'}"
			>
				<FontAwesomeIcon class="mr-2 h-3.5 w-3.5 opacity-70" icon={faHouse} />
				Home
			</span>
		</NavLi>
		<NavLi href="/configurations" data-testid="nav-link-configurations" class="bg-transparent!">
			<span
				class="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all {activeUrl === '/configurations'
					? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
					: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white'}"
			>
				<FontAwesomeIcon class="mr-2 h-3.5 w-3.5 opacity-70" icon={faList} />
				Configurations
			</span>
		</NavLi>
		<NavLi href="/analyze" data-testid="nav-link-analyze" class="bg-transparent!">
			<span
				class="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all {activeUrl === '/analyze'
					? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
					: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white'}"
			>
				<FontAwesomeIcon class="mr-2 h-3.5 w-3.5 opacity-70" icon={faGavel} />
				Auctions
			</span>
		</NavLi>
		<NavLi href="/cloud-status" data-testid="nav-link-cloud-status" class="bg-transparent!">
			<span
				class="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all {activeUrl === '/cloud-status'
					? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
					: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white'}"
			>
				<FontAwesomeIcon class="mr-2 h-3.5 w-3.5 opacity-70" icon={faCloud} />
				Cloud
			</span>
		</NavLi>
		<NavLi href="/statistics" data-testid="nav-link-statistics" class="bg-transparent!">
			<span
				class="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all {activeUrl === '/statistics'
					? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
					: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white'}"
			>
				<FontAwesomeIcon class="mr-2 h-3.5 w-3.5 opacity-70" icon={faChartLine} />
				Statistics
			</span>
		</NavLi>
		<NavLi href="/about" data-testid="nav-link-about" class="bg-transparent!">
			<span
				class="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all {activeUrl === '/about'
					? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
					: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white'}"
			>
				<FontAwesomeIcon class="mr-2 h-3.5 w-3.5 opacity-70" icon={faCircleInfo} />
				About
			</span>
		</NavLi>

		{#if $session}
			<NavLi href="/settings" data-testid="nav-link-settings" class="bg-transparent! xl:hidden">
				<span
					class="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all {activeUrl === '/settings'
						? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
						: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white'}"
				>
					Settings
				</span>
			</NavLi>
			<div class="mt-3 flex items-center gap-3 border-t border-gray-200 pt-4 xl:hidden dark:border-gray-800">
				<form
					action="/auth/logout"
					method="POST"
					use:enhance={() => {
						session.set(null);
						return goto(resolve('/auth/logout'));
					}}
					class="flex-1"
				>
					<Button
						data-testid="nav-signout-mobile"
						class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
						type="submit"
					>
						<FontAwesomeIcon class="mr-2 h-4 w-4" icon={faRightFromBracket} />
						Sign Out
					</Button>
				</form>
				<SettingsPopup />
			</div>
		{:else}
			<div class="mt-3 flex items-center gap-3 border-t border-gray-200 pt-4 xl:hidden dark:border-gray-800">
				<Button
					data-testid="nav-signin-mobile"
					class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
					href="/auth/login"
				>
					<FontAwesomeIcon class="mr-2 h-4 w-4" icon={faKey} />
					Sign In
				</Button>
				<SettingsPopup />
			</div>
		{/if}
	</NavUl>
</Navbar>

<!-- Loading Indicator -->
<div class="relative h-0.5 w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
	<div
		class="absolute inset-0 h-full bg-gradient-to-r from-transparent via-primary-500 to-transparent transition-opacity duration-300 {isVisible ? 'opacity-100' : 'opacity-0'} {isAnimating ? 'animate-loading-bar' : ''}"
		style="width: 300%; left: -100%;"
	></div>
</div>

<style>
	@keyframes loading-bar {
		0% {
			transform: translateX(0%);
		}
		100% {
			transform: translateX(33.33%);
		}
	}
	.animate-loading-bar {
		animation: loading-bar 0.7s infinite linear;
	}
</style>
