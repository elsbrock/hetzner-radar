<script lang="ts">
	import type { ServerConfiguration } from '$lib/api/frontend/filter';
	import { getFormattedDiskSize } from '$lib/disksize';
	import { currencySymbol } from '$lib/stores/settings';
	import { Badge } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'; // Use named import
	import { faHardDrive, faMemory, faSdCard, faTags } from '@fortawesome/free-solid-svg-icons';

	// --- Props ---

	interface _$Props {
		config: ServerConfiguration;
		displayPrice: number; // Final price including VAT and currency conversion (needed for unit price calculation)
		showPricePerUnit?: boolean;
		showBadges?: boolean;
		layout?: 'horizontal' | 'vertical';
		class?: string;
	}

	let {
		config,
		displayPrice,
		showPricePerUnit = true,
		showBadges = true,
		layout = 'vertical',
		class: className = ''
	} = $props();

	// --- Helper Functions & Types ---

	interface NumberSummary {
		count: number;
		value: number;
	}

	// Summarizes an array of numbers into counts of unique values.
	function summarizeNumbers(numbers: number[]): NumberSummary[] {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Map is used for counting in a non-reactive function, not for reactivity
		const counts = new Map<number, number>();
		for (const num of numbers) {
			counts.set(num, (counts.get(num) || 0) + 1);
		}
		return Array.from(counts.entries())
			.map(([value, count]) => ({ count, value }))
			.sort((a, b) => a.value - b.value); // Sort by value for consistent display
	}

	// Calculates the total size of disks in Terabytes (TB).
	function getTotalDiskTb(drives: number[]): number {
		if (!drives || drives.length === 0) {
			return 0;
		}
		const totalGb = drives.reduce((sum, size) => sum + size, 0);
		return totalGb / 1000; // Convert GB to TB
	}

	// --- Derived Values ---

	let totalNvmeTb = $derived(getTotalDiskTb(config.nvme_drives));
	let totalSataTb = $derived(getTotalDiskTb(config.sata_drives));
	let totalHddTb = $derived(getTotalDiskTb(config.hdd_drives));

	// Summarized disk arrays for display
	let nvmeSummary = $derived(summarizeNumbers(config.nvme_drives));
	let sataSummary = $derived(summarizeNumbers(config.sata_drives));
	let hddSummary = $derived(summarizeNumbers(config.hdd_drives));

	// --- Derived Unit Prices ---
	let pricePerGbRam = $derived(config.ram_size > 0 ? displayPrice / config.ram_size : 0);
	let pricePerTbNvme = $derived(totalNvmeTb > 0 ? displayPrice / totalNvmeTb : 0);
	let pricePerTbSata = $derived(totalSataTb > 0 ? displayPrice / totalSataTb : 0);
	let pricePerTbHdd = $derived(totalHddTb > 0 ? displayPrice / totalHddTb : 0);
</script>

<div class={className}>
	{#if layout === 'horizontal'}
		<!-- Horizontal Layout (columns) -->
		<div class="mb-3 flex flex-wrap gap-8 text-gray-700 dark:text-gray-400">
			<!-- RAM Column -->
			<div class="flex flex-col items-start">
				<div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
					<FontAwesomeIcon icon={faMemory} class="h-3 w-3" />
					<span>RAM</span>
				</div>
				<div class="text-sm font-medium text-gray-900 dark:text-white">
					{config.ram_size} GB
				</div>
				{#if showPricePerUnit && pricePerGbRam > 0}
					<div class="text-xs text-gray-500 dark:text-gray-400">
						{pricePerGbRam.toFixed(2)} {$currencySymbol}/GB
					</div>
				{/if}
			</div>

			<!-- NVMe Column -->
			{#if config.nvme_drives.length > 0}
				<div class="flex flex-col items-start">
					<div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
						<FontAwesomeIcon icon={faSdCard} class="h-3 w-3" />
						<span>NVMe</span>
					</div>
					<div class="text-sm font-medium text-gray-900 dark:text-white">
						{#each nvmeSummary as summary (summary.value)}
							<div class="whitespace-nowrap"
								>{nvmeSummary.length > 1 || summary.count > 1
									? `${summary.count}x `
									: ''}{getFormattedDiskSize(summary.value)}</div
							>
						{/each}
					</div>
					{#if showPricePerUnit && pricePerTbNvme > 0}
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{pricePerTbNvme.toFixed(2)} {$currencySymbol}/TB
						</div>
					{/if}
				</div>
			{/if}

			<!-- SATA Column -->
			{#if config.sata_drives.length > 0}
				<div class="flex flex-col items-start">
					<div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
						<FontAwesomeIcon icon={faHardDrive} class="h-3 w-3" />
						<span>SATA</span>
					</div>
					<div class="text-sm font-medium text-gray-900 dark:text-white">
						{#each sataSummary as summary (summary.value)}
							<div class="whitespace-nowrap"
								>{sataSummary.length > 1 || summary.count > 1
									? `${summary.count}x `
									: ''}{getFormattedDiskSize(summary.value)}</div
							>
						{/each}
					</div>
					{#if showPricePerUnit && pricePerTbSata > 0}
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{pricePerTbSata.toFixed(2)} {$currencySymbol}/TB
						</div>
					{/if}
				</div>
			{/if}

			<!-- HDD Column -->
			{#if config.hdd_drives.length > 0}
				<div class="flex flex-col items-start">
					<div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
						<FontAwesomeIcon icon={faHardDrive} class="h-3 w-3" />
						<span>HDD</span>
					</div>
					<div class="text-sm font-medium text-gray-900 dark:text-white">
						{#each hddSummary as summary (summary.value)}
							<div class="whitespace-nowrap"
								>{hddSummary.length > 1 || summary.count > 1
									? `${summary.count}x `
									: ''}{getFormattedDiskSize(summary.value)}</div
							>
						{/each}
					</div>
					{#if showPricePerUnit && pricePerTbHdd > 0}
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{pricePerTbHdd.toFixed(2)} {$currencySymbol}/TB
						</div>
					{/if}
				</div>
			{/if}

			<!-- Extras Column -->
			{#if showBadges}
				<div class="flex flex-col items-start">
					<div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
						<FontAwesomeIcon icon={faTags} class="h-3 w-3" />
						<span>Extras</span>
					</div>
					{#if config.is_ecc || config.with_inic || config.with_gpu || config.with_hwr || config.with_rps}
						<div class="flex flex-col gap-0.5">
							{#if config.is_ecc}<Badge border class="px-1.5 py-0.5 text-xs">ECC</Badge>{/if}
							{#if config.with_inic}<Badge border class="px-1.5 py-0.5 text-xs">iNIC</Badge>{/if}
							{#if config.with_gpu}<Badge border class="px-1.5 py-0.5 text-xs">GPU</Badge>{/if}
							{#if config.with_hwr}<Badge border class="px-1.5 py-0.5 text-xs">HWR</Badge>{/if}
							{#if config.with_rps}<Badge border class="px-1.5 py-0.5 text-xs">RPS</Badge>{/if}
						</div>
					{:else}
						<div class="text-sm text-gray-400 dark:text-gray-500">none</div>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Vertical Layout (rows) -->
		<div
			class="mb-3 grid grid-cols-[16px_50px_1fr_auto] gap-x-3 gap-y-1 leading-tight text-sm text-gray-700 dark:text-gray-400"
		>
			<!-- RAM -->
			<div class="flex items-start justify-center pt-0.5">
				<FontAwesomeIcon icon={faMemory} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
			</div>
			<div>RAM</div>
			<div class="font-medium text-gray-900 dark:text-white">{config.ram_size} GB</div>
			<div class="text-right text-xs text-gray-500 dark:text-gray-400">
				{#if showPricePerUnit && pricePerGbRam > 0}
					{pricePerGbRam.toFixed(2)} {$currencySymbol}/GB
				{/if}
			</div>

			<!-- NVMe -->
			{#if config.nvme_drives.length > 0}
				<div class="flex items-start justify-center pt-0.5">
					<FontAwesomeIcon icon={faSdCard} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
				</div>
				<div>NVMe</div>
				<div class="flex flex-wrap gap-x-2 font-medium text-gray-900 dark:text-white">
					{#each nvmeSummary as summary (summary.value)}
						<span class="whitespace-nowrap"
							>{nvmeSummary.length > 1 || summary.count > 1
								? `${summary.count}x `
								: ''}{getFormattedDiskSize(summary.value)}</span
						>
					{/each}
				</div>
				<div class="text-right text-xs text-gray-500 dark:text-gray-400">
					{#if showPricePerUnit && pricePerTbNvme > 0}
						{pricePerTbNvme.toFixed(2)} {$currencySymbol}/TB
					{/if}
				</div>
			{/if}

			<!-- SATA -->
			{#if config.sata_drives.length > 0}
				<div class="flex items-start justify-center pt-0.5">
					<FontAwesomeIcon icon={faHardDrive} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
				</div>
				<div>SATA</div>
				<div class="flex flex-wrap gap-x-2 font-medium text-gray-900 dark:text-white">
					{#each sataSummary as summary (summary.value)}
						<span class="whitespace-nowrap"
							>{sataSummary.length > 1 || summary.count > 1
								? `${summary.count}x `
								: ''}{getFormattedDiskSize(summary.value)}</span
						>
					{/each}
				</div>
				<div class="text-right text-xs text-gray-500 dark:text-gray-400">
					{#if showPricePerUnit && pricePerTbSata > 0}
						{pricePerTbSata.toFixed(2)} {$currencySymbol}/TB
					{/if}
				</div>
			{/if}

			<!-- HDD -->
			{#if config.hdd_drives.length > 0}
				<div class="flex items-start justify-center pt-0.5">
					<FontAwesomeIcon icon={faHardDrive} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
				</div>
				<div>HDD</div>
				<div class="flex flex-wrap gap-x-2 font-medium text-gray-900 dark:text-white">
					{#each hddSummary as summary (summary.value)}
						<span class="whitespace-nowrap"
							>{hddSummary.length > 1 || summary.count > 1
								? `${summary.count}x `
								: ''}{getFormattedDiskSize(summary.value)}</span
						>
					{/each}
				</div>
				<div class="text-right text-xs text-gray-500 dark:text-gray-400">
					{#if showPricePerUnit && pricePerTbHdd > 0}
						{pricePerTbHdd.toFixed(2)} {$currencySymbol}/TB
					{/if}
				</div>
			{/if}

			<!-- Extras -->
			{#if showBadges}
				<div class="flex items-start justify-center pt-0.5">
					<FontAwesomeIcon icon={faTags} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
				</div>
				<div>Extras</div>
				<div class="col-span-2">
					{#if config.is_ecc || config.with_inic || config.with_gpu || config.with_hwr || config.with_rps}
						<div class="flex flex-wrap gap-1">
							{#if config.is_ecc}<Badge border class="px-1.5 py-0.5 text-xs">ECC</Badge>{/if}
							{#if config.with_inic}<Badge border class="px-1.5 py-0.5 text-xs">iNIC</Badge>{/if}
							{#if config.with_gpu}<Badge border class="px-1.5 py-0.5 text-xs">GPU</Badge>{/if}
							{#if config.with_hwr}<Badge border class="px-1.5 py-0.5 text-xs">HWR</Badge>{/if}
							{#if config.with_rps}<Badge border class="px-1.5 py-0.5 text-xs">RPS</Badge>{/if}
						</div>
					{:else}
						<span class="text-gray-400 dark:text-gray-500">none</span>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
