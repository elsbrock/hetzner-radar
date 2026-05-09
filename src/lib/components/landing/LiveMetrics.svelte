<script lang="ts">
	import { faBell, faClock, faEnvelope, faGavel, faUsers } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { cubicOut } from 'svelte/easing';
	import { tweened } from 'svelte/motion';

	let { data } = $props();

	let loading = $state(true);

	const auctionCounter = tweened(0, { duration: 1000, easing: cubicOut });
	const userCounter = tweened(0, { duration: 1000, easing: cubicOut });
	const alertCounter = tweened(0, { duration: 1000, easing: cubicOut });
	const historyCounter = tweened(0, { duration: 1000, easing: cubicOut });
	const latestBatchCounter = tweened(0, { duration: 1000, easing: cubicOut });

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

<section class="border-b border-gray-200 bg-gray-50 py-12 dark:border-gray-800 dark:bg-gray-900/50">
	<div class="mx-auto max-w-6xl px-6">
		<dl class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
			<!-- Auctions Tracked -->
			<div data-testid="glance-auctions-tracked" class="rounded-xl border border-gray-200 bg-white p-5 text-center dark:border-gray-800 dark:bg-gray-900">
				{#if loading}
					<div class="mx-auto mb-3 h-10 w-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto mb-2 h-7 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto h-4 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
				{:else}
					<div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
						<FontAwesomeIcon icon={faGavel} class="h-5 w-5 text-primary-600 dark:text-primary-400" />
					</div>
					<dt class="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
						{Math.round($auctionCounter).toLocaleString()}
					</dt>
					<dd class="mt-1 text-sm text-gray-500 dark:text-gray-400">Auctions Tracked</dd>
				{/if}
			</div>

			<!-- Auctions in Last Batch -->
			<div data-testid="glance-last-batch" class="rounded-xl border border-gray-200 bg-white p-5 text-center dark:border-gray-800 dark:bg-gray-900">
				{#if loading}
					<div class="mx-auto mb-3 h-10 w-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto mb-2 h-7 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto h-4 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
				{:else}
					<div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
						<FontAwesomeIcon icon={faClock} class="h-5 w-5 text-primary-600 dark:text-primary-400" />
					</div>
					<dt class="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
						{Math.round($latestBatchCounter).toLocaleString()}
					</dt>
					<dd class="mt-1 text-sm text-gray-500 dark:text-gray-400">Last Batch</dd>
				{/if}
			</div>

			<!-- Active Users -->
			<div data-testid="glance-active-users" class="rounded-xl border border-gray-200 bg-white p-5 text-center dark:border-gray-800 dark:bg-gray-900">
				{#if loading}
					<div class="mx-auto mb-3 h-10 w-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto mb-2 h-7 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto h-4 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
				{:else}
					<div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
						<FontAwesomeIcon icon={faUsers} class="h-5 w-5 text-primary-600 dark:text-primary-400" />
					</div>
					<dt class="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
						{Math.round($userCounter).toLocaleString()}
					</dt>
					<dd class="mt-1 text-sm text-gray-500 dark:text-gray-400">Active Users</dd>
				{/if}
			</div>

			<!-- Active Alerts -->
			<div data-testid="glance-active-alerts" class="rounded-xl border border-gray-200 bg-white p-5 text-center dark:border-gray-800 dark:bg-gray-900">
				{#if loading}
					<div class="mx-auto mb-3 h-10 w-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto mb-2 h-7 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto h-4 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
				{:else}
					<div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
						<FontAwesomeIcon icon={faBell} class="h-5 w-5 text-primary-600 dark:text-primary-400" />
					</div>
					<dt class="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
						{Math.round($alertCounter).toLocaleString()}
					</dt>
					<dd class="mt-1 text-sm text-gray-500 dark:text-gray-400">Active Alerts</dd>
				{/if}
			</div>

			<!-- Notifications sent -->
			<div data-testid="glance-notifications-sent" class="col-span-2 rounded-xl border border-gray-200 bg-white p-5 text-center sm:col-span-3 lg:col-span-1 dark:border-gray-800 dark:bg-gray-900">
				{#if loading}
					<div class="mx-auto mb-3 h-10 w-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto mb-2 h-7 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
					<div class="mx-auto h-4 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
				{:else}
					<div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
						<FontAwesomeIcon icon={faEnvelope} class="h-5 w-5 text-primary-600 dark:text-primary-400" />
					</div>
					<dt class="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
						{Math.round($historyCounter).toLocaleString()}
					</dt>
					<dd class="mt-1 text-sm text-gray-500 dark:text-gray-400">Notifications Sent</dd>
				{/if}
			</div>
		</dl>
	</div>
</section>
