<script lang="ts">
	import { faBell, faClock, faEnvelope, faGavel, faUsers } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { cubicOut } from 'svelte/easing';
	import { tweened } from 'svelte/motion';

	let { data } = $props();

	let loading = $state(true);

	// Create tweened stores for all counters
	const auctionCounter = tweened(0, {
		duration: 1000,
		easing: cubicOut
	});
	const userCounter = tweened(0, {
		duration: 1000,
		easing: cubicOut
	});
	const alertCounter = tweened(0, {
		duration: 1000,
		easing: cubicOut
	});
	const historyCounter = tweened(0, {
		duration: 1000,
		easing: cubicOut
	});
	const latestBatchCounter = tweened(0, {
		duration: 1000,
		easing: cubicOut
	});

	// Shake Animation Logic
	const NUM_ICONS = 5;
	const SHAKE_INTERVAL = 5000;
	const SHAKE_DELAY = 150;
	const SHAKE_DURATION = 500;

	let shakingIconIndex = $state(-1);

	$effect(() => {
		let intervalId: ReturnType<typeof setInterval> | undefined;
		let timeoutIds: ReturnType<typeof setTimeout>[] = [];

		const startSequence = () => {
			timeoutIds.forEach(clearTimeout);
			timeoutIds = [];
			shakingIconIndex = -1;

			for (let i = 0; i < NUM_ICONS; i++) {
				const startTimeoutId = setTimeout(() => {
					shakingIconIndex = i;
				}, i * SHAKE_DELAY);
				timeoutIds.push(startTimeoutId);

				const stopTimeoutId = setTimeout(
					() => {
						if (shakingIconIndex === i) {
							shakingIconIndex = -1;
						}
					},
					i * SHAKE_DELAY + SHAKE_DURATION
				);
				timeoutIds.push(stopTimeoutId);
			}
		};

		startSequence();
		intervalId = setInterval(startSequence, SHAKE_INTERVAL);

		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
			timeoutIds.forEach(clearTimeout);
		};
	});

	// Handle data changes in Svelte 5 runes mode
	$effect(() => {
		if (data) {
			auctionCounter.set(data.auctionStats ?? 0);
			userCounter.set(data.userStats ?? 0);
			alertCounter.set(data.alertStats ?? 0);
			historyCounter.set(data.historyStats ?? 0);
			latestBatchCounter.set(data.latestBatchStats ?? 0);
			loading = false;
		}
	});
</script>

<section class="mx-auto mb-16 max-w-7xl">
	<div
		class="mx-auto flex max-w-7xl flex-col flex-wrap items-center justify-around gap-x-4 gap-y-8 sm:flex-row"
	>
		<!-- Auctions Tracked -->
		<div data-testid="glance-auctions-tracked" class="flex flex-col items-center px-4 text-center">
			{#if loading}
				<div class="mb-2 flex h-10 items-center justify-center gap-3">
					<div class="h-6 w-6 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-10 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="h-5 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div class="mb-2 flex items-center justify-center gap-3">
					<FontAwesomeIcon
						icon={faGavel}
						class="h-6 w-6 text-orange-500 {shakingIconIndex === 0 ? 'subtle-bounce-it' : ''}"
					/>
					<p
						class="text-4xl leading-tight font-semibold tracking-tight text-gray-700 antialiased dark:text-gray-200"
					>
						{Math.round($auctionCounter).toLocaleString()}
					</p>
				</div>
				<span class="text-base text-gray-500 antialiased dark:text-gray-400"
					>Total Auctions Tracked</span
				>
			{/if}
		</div>

		<!-- Auctions in Last Batch -->
		<div data-testid="glance-last-batch" class="flex flex-col items-center px-4 text-center">
			{#if loading}
				<div class="mb-2 flex h-10 items-center justify-center gap-3">
					<div class="h-6 w-6 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-10 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div class="mb-2 flex items-center justify-center gap-3">
					<FontAwesomeIcon
						icon={faClock}
						class="h-6 w-6 text-orange-500 {shakingIconIndex === 1 ? 'subtle-bounce-it' : ''}"
					/>
					<p
						class="text-4xl leading-tight font-semibold tracking-tight text-gray-700 antialiased dark:text-gray-200"
					>
						{Math.round($latestBatchCounter).toLocaleString()}
					</p>
				</div>
				<span class="text-base text-gray-500 antialiased dark:text-gray-400"
					>Auctions in Last Batch</span
				>
			{/if}
		</div>

		<!-- Active Users -->
		<div data-testid="glance-active-users" class="flex flex-col items-center px-4 text-center">
			{#if loading}
				<div class="mb-2 flex h-10 items-center justify-center gap-3">
					<div class="h-6 w-6 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-10 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div class="mb-2 flex items-center justify-center gap-3">
					<FontAwesomeIcon
						icon={faUsers}
						class="h-6 w-6 text-orange-500 {shakingIconIndex === 2 ? 'subtle-bounce-it' : ''}"
					/>
					<p
						class="text-4xl leading-tight font-semibold tracking-tight text-gray-700 antialiased dark:text-gray-200"
					>
						{Math.round($userCounter).toLocaleString()}
					</p>
				</div>
				<span class="text-base text-gray-500 antialiased dark:text-gray-400">Active Users</span>
			{/if}
		</div>

		<!-- Active Alerts -->
		<div data-testid="glance-active-alerts" class="flex flex-col items-center px-4 text-center">
			{#if loading}
				<div class="mb-2 flex h-10 items-center justify-center gap-3">
					<div class="h-6 w-6 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-10 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div class="mb-2 flex items-center justify-center gap-3">
					<FontAwesomeIcon
						icon={faBell}
						class="h-6 w-6 text-orange-500 {shakingIconIndex === 3 ? 'subtle-bounce-it' : ''}"
					/>
					<p
						class="text-4xl leading-tight font-semibold tracking-tight text-gray-700 antialiased dark:text-gray-200"
					>
						{Math.round($alertCounter).toLocaleString()}
					</p>
				</div>
				<span class="text-base text-gray-500 antialiased dark:text-gray-400">Active Alerts</span>
			{/if}
		</div>

		<!-- Notifications sent -->
		<div
			data-testid="glance-notifications-sent"
			class="flex flex-col items-center px-4 text-center"
		>
			{#if loading}
				<div class="mb-2 flex h-10 items-center justify-center gap-3">
					<div class="h-6 w-6 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-10 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div class="mb-2 flex items-center justify-center gap-3">
					<FontAwesomeIcon
						icon={faEnvelope}
						class="h-6 w-6 text-orange-500 {shakingIconIndex === 4 ? 'subtle-bounce-it' : ''}"
					/>
					<p
						class="text-4xl leading-tight font-semibold tracking-tight text-gray-700 antialiased dark:text-gray-200"
					>
						{Math.round($historyCounter).toLocaleString()}
					</p>
				</div>
				<span class="text-base text-gray-500 antialiased dark:text-gray-400"
					>Notifications Sent</span
				>
			{/if}
		</div>
	</div>
</section>
