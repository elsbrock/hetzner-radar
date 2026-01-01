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

<section class="mx-auto mt-8 mb-20 max-w-6xl px-4">
	<dl class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
		<!-- Auctions Tracked -->
		<div
			data-testid="glance-auctions-tracked"
			class="flex flex-col items-center rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800"
		>
			{#if loading}
				<div class="mb-2 h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
				<div class="mb-1 h-8 w-16 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
				<div class="h-4 w-20 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div
					class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30"
				>
					<FontAwesomeIcon
						icon={faGavel}
						class="h-5 w-5 text-orange-500 {shakingIconIndex === 0 ? 'subtle-bounce-it' : ''}"
					/>
				</div>
				<dt class="text-2xl font-bold text-gray-900 dark:text-white">
					{Math.round($auctionCounter).toLocaleString()}
				</dt>
				<dd class="text-sm text-gray-500 dark:text-gray-400">Auctions Tracked</dd>
			{/if}
		</div>

		<!-- Auctions in Last Batch -->
		<div
			data-testid="glance-last-batch"
			class="flex flex-col items-center rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800"
		>
			{#if loading}
				<div class="mb-2 h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
				<div class="mb-1 h-8 w-16 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
				<div class="h-4 w-20 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div
					class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30"
				>
					<FontAwesomeIcon
						icon={faClock}
						class="h-5 w-5 text-orange-500 {shakingIconIndex === 1 ? 'subtle-bounce-it' : ''}"
					/>
				</div>
				<dt class="text-2xl font-bold text-gray-900 dark:text-white">
					{Math.round($latestBatchCounter).toLocaleString()}
				</dt>
				<dd class="text-sm text-gray-500 dark:text-gray-400">Last Batch</dd>
			{/if}
		</div>

		<!-- Active Users -->
		<div
			data-testid="glance-active-users"
			class="flex flex-col items-center rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800"
		>
			{#if loading}
				<div class="mb-2 h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
				<div class="mb-1 h-8 w-16 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
				<div class="h-4 w-20 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div
					class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30"
				>
					<FontAwesomeIcon
						icon={faUsers}
						class="h-5 w-5 text-orange-500 {shakingIconIndex === 2 ? 'subtle-bounce-it' : ''}"
					/>
				</div>
				<dt class="text-2xl font-bold text-gray-900 dark:text-white">
					{Math.round($userCounter).toLocaleString()}
				</dt>
				<dd class="text-sm text-gray-500 dark:text-gray-400">Active Users</dd>
			{/if}
		</div>

		<!-- Active Alerts -->
		<div
			data-testid="glance-active-alerts"
			class="flex flex-col items-center rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800"
		>
			{#if loading}
				<div class="mb-2 h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
				<div class="mb-1 h-8 w-16 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
				<div class="h-4 w-20 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div
					class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30"
				>
					<FontAwesomeIcon
						icon={faBell}
						class="h-5 w-5 text-orange-500 {shakingIconIndex === 3 ? 'subtle-bounce-it' : ''}"
					/>
				</div>
				<dt class="text-2xl font-bold text-gray-900 dark:text-white">
					{Math.round($alertCounter).toLocaleString()}
				</dt>
				<dd class="text-sm text-gray-500 dark:text-gray-400">Active Alerts</dd>
			{/if}
		</div>

		<!-- Notifications sent -->
		<div
			data-testid="glance-notifications-sent"
			class="col-span-2 flex flex-col items-center rounded-lg border border-gray-200 bg-white p-4 shadow-xs sm:col-span-3 lg:col-span-1 dark:border-gray-700 dark:bg-gray-800"
		>
			{#if loading}
				<div class="mb-2 h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
				<div class="mb-1 h-8 w-16 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
				<div class="h-4 w-20 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<div
					class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30"
				>
					<FontAwesomeIcon
						icon={faEnvelope}
						class="h-5 w-5 text-orange-500 {shakingIconIndex === 4 ? 'subtle-bounce-it' : ''}"
					/>
				</div>
				<dt class="text-2xl font-bold text-gray-900 dark:text-white">
					{Math.round($historyCounter).toLocaleString()}
				</dt>
				<dd class="text-sm text-gray-500 dark:text-gray-400">Notifications Sent</dd>
			{/if}
		</div>
	</dl>
</section>
