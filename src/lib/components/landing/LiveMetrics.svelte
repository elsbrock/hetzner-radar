<script lang="ts">
	let { data } = $props();

	// Approximate, forward-looking figures ("2,100+", "35k+") — never the exact count.
	function approx(n: number): string {
		if (n >= 10000) return `${Math.floor(n / 1000)}k+`;
		if (n >= 1000) return `${(Math.floor(n / 100) * 100).toLocaleString()}+`;
		return `${Math.floor(n / 10) * 10}+`;
	}

	const stats = $derived([
		{ testid: 'glance-active-users', value: approx(data.userStats ?? 0), label: 'users' },
		{ testid: 'glance-active-alerts', value: approx(data.alertStats ?? 0), label: 'active alerts' },
		{ testid: 'glance-notifications-sent', value: approx(data.historyStats ?? 0), label: 'alerts sent' },
		{
			testid: 'glance-auctions-tracked',
			value: approx(data.auctionStats ?? 0),
			label: 'auctions tracked'
		}
	]);
</script>

<!-- Social proof — a full-width band flush under the hero (a grounded "stat shelf"). -->
<section
	class="-mx-8 border-b border-gray-200 bg-gray-50 px-8 py-5 dark:border-gray-800 dark:bg-gray-900/50"
	style="width: calc(100% + 4rem);"
>
	<div
		class="mx-auto flex max-w-5xl flex-wrap items-start justify-center gap-x-12 gap-y-5 text-center sm:gap-x-20"
	>
		{#each stats as s (s.testid)}
			<div data-testid={s.testid}>
				<div class="text-2xl font-bold text-orange-500 tabular-nums">{s.value}</div>
				<div class="mt-0.5 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
					{s.label}
				</div>
			</div>
		{/each}
	</div>
</section>
