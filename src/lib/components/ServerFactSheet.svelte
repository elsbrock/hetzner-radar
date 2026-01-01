<script lang="ts">
	import type { ServerConfiguration } from '$lib/api/frontend/filter';
	import { getFormattedDiskSize } from '$lib/disksize';
	import { currencySymbol } from '$lib/stores/settings';
	import { Badge } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'; // Use named import
	import { faHardDrive, faMemory, faSdCard } from '@fortawesome/free-solid-svg-icons';

	// --- Props ---

	interface _$Props {
		config: ServerConfiguration;
		displayPrice: number; // Final price including VAT and currency conversion (needed for unit price calculation)
		showPricePerUnit?: boolean;
		class?: string;
	}

	let { config, displayPrice, showPricePerUnit = true, class: className = '' } = $props();

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

	// --- Derived Unit Prices ---
	let pricePerGbRam = $derived(config.ram_size > 0 ? displayPrice / config.ram_size : 0);
	let pricePerTbNvme = $derived(totalNvmeTb > 0 ? displayPrice / totalNvmeTb : 0);
	let pricePerTbSata = $derived(totalSataTb > 0 ? displayPrice / totalSataTb : 0);
	let pricePerTbHdd = $derived(totalHddTb > 0 ? displayPrice / totalHddTb : 0);
</script>

<div class={className}>
	<!-- Hardware Details Grid -->
	<div
		class="mb-3 grid grid-cols-[10px,40px,70px,80px] gap-x-3 gap-y-1 leading-tight font-normal text-gray-700 dark:text-gray-400"
	>
		<!-- RAM -->
		<div class="flex items-center justify-center text-sm">
			<!-- Col 1: Icon -->
			<FontAwesomeIcon icon={faMemory} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
		</div>
		<div class="flex items-center text-sm">RAM</div>
		<!-- Col 2: Label -->
		<div class="text-sm">
			<!-- Col 3: Details -->
			<span>{config.ram_size} GB</span>
		</div>
		<div class="text-right text-sm">
			<!-- Col 4: Price -->
			{#if showPricePerUnit && pricePerGbRam > 0}
				<span class="text-xs text-gray-500 dark:text-gray-400"
					>({pricePerGbRam.toFixed(2)} {$currencySymbol}/GB)</span
				>
			{/if}
		</div>

		<!-- NVMe Drives -->
		{#if config.nvme_drives.length > 0}
			<div class="flex items-center justify-center text-sm">
				<!-- Col 1: Icon -->
				<FontAwesomeIcon icon={faSdCard} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
			</div>
			<div class="flex items-center text-sm">NVMe</div>
			<!-- Col 2: Label -->
			<div class="text-sm">
				<!-- Col 3: Details -->
				<span>
					{#each summarizeNumbers(config.nvme_drives) as summary, i (summary.value)}
						<span class="whitespace-nowrap"
							>{summary.count > 1 ? `${summary.count}x ` : ''}{getFormattedDiskSize(
								summary.value
							)}</span
						>{i < summarizeNumbers(config.nvme_drives).length - 1 ? ', ' : ''}
					{/each}
				</span>
			</div>
			<div class="flex items-center justify-end text-right text-sm">
				<!-- Col 4: Price -->
				{#if showPricePerUnit && pricePerTbNvme > 0}
					<span class="text-xs text-gray-500 dark:text-gray-400"
						>({pricePerTbNvme.toFixed(2)} {$currencySymbol}/TB)</span
					>
				{/if}
			</div>
		{/if}

		<!-- SATA Drives -->
		{#if config.sata_drives.length > 0}
			<div class="flex items-center justify-center text-sm">
				<!-- Col 1: Icon -->
				<FontAwesomeIcon icon={faHardDrive} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
			</div>
			<div class="flex items-center text-sm">SATA</div>
			<!-- Col 2: Label -->
			<div class="text-sm">
				<!-- Col 3: Details -->
				<span>
					{#each summarizeNumbers(config.sata_drives) as summary, i (summary.value)}
						<span class="whitespace-nowrap"
							>{summary.count > 1 ? `${summary.count}x ` : ''}{getFormattedDiskSize(
								summary.value
							)}</span
						>{i < summarizeNumbers(config.sata_drives).length - 1 ? ', ' : ''}
					{/each}
				</span>
			</div>
			<div class="flex items-center justify-end text-right text-sm">
				<!-- Col 4: Price -->
				{#if showPricePerUnit && pricePerTbSata > 0}
					<span class="text-xs text-gray-500 dark:text-gray-400"
						>({pricePerTbSata.toFixed(2)} {$currencySymbol}/TB)</span
					>
				{/if}
			</div>
		{/if}

		<!-- HDD Drives -->
		{#if config.hdd_drives.length > 0}
			<div class="flex items-center justify-center text-sm">
				<!-- Col 1: Icon -->
				<FontAwesomeIcon icon={faHardDrive} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
			</div>
			<div class="flex items-center text-sm">HDD</div>
			<!-- Col 2: Label -->
			<div class="text-sm">
				<!-- Col 3: Details -->
				<span>
					{#each summarizeNumbers(config.hdd_drives) as summary, i (summary.value)}
						<span class="whitespace-nowrap"
							>{summary.count > 1 ? `${summary.count}x ` : ''}{getFormattedDiskSize(
								summary.value
							)}</span
						>{i < summarizeNumbers(config.hdd_drives).length - 1 ? ', ' : ''}
					{/each}
				</span>
			</div>
			<div class="flex items-center justify-end text-right text-sm">
				<!-- Col 4: Price -->
				{#if showPricePerUnit && pricePerTbHdd > 0}
					<span class="text-xs text-gray-500 dark:text-gray-400"
						>({pricePerTbHdd.toFixed(2)} {$currencySymbol}/TB)</span
					>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Badges -->
	<div class="flex flex-wrap gap-2">
		{#if config.is_ecc}<span><Badge border>ECC</Badge></span>{/if}
		{#if config.with_inic}<span><Badge border>iNIC</Badge></span>{/if}
		{#if config.with_gpu}<span><Badge border>GPU</Badge></span>{/if}
		{#if config.with_hwr}<span><Badge border>HWR</Badge></span>{/if}
		{#if config.with_rps}<span><Badge border>RPS</Badge></span>{/if}
	</div>
</div>
