<script lang="ts">
	import type { ServerConfiguration } from '$lib/api/frontend/filter';
	import { getFormattedDiskSize } from '$lib/disksize';
	import { Badge } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'; // Use named import
	import { faHardDrive, faMemory, faSdCard } from '@fortawesome/free-solid-svg-icons';

	// --- Props ---

	interface $$Props {
		config: ServerConfiguration;
		displayPrice: number; // Final price including VAT (needed for unit price calculation)
		showPricePerUnit?: boolean;
		class?: string;
	}

	let {
		config,
		displayPrice,
		showPricePerUnit = true,
		class: className = ''
	} = $props();

	// --- Helper Functions & Types ---

	interface NumberSummary {
		count: number;
		value: number;
	}

	// Summarizes an array of numbers into counts of unique values.
	function summarizeNumbers(numbers: number[]): NumberSummary[] {
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
	let pricePerGbRam = $derived(
		config.ram_size > 0 ? displayPrice / config.ram_size : 0
	);
	let pricePerTbNvme = $derived(totalNvmeTb > 0 ? displayPrice / totalNvmeTb : 0);
	let pricePerTbSata = $derived(totalSataTb > 0 ? displayPrice / totalSataTb : 0);
	let pricePerTbHdd = $derived(totalHddTb > 0 ? displayPrice / totalHddTb : 0);

</script>

<div class={className}>
	<!-- Hardware Details Grid -->
	<div
		class="font-normal text-gray-700 dark:text-gray-400 leading-tight grid grid-cols-[10px,40px,100px,70px] gap-x-3 gap-y-1 mb-3"
	>
		<!-- RAM -->
		<div class="flex items-center justify-center text-sm"> <!-- Col 1: Icon -->
			<FontAwesomeIcon icon={faMemory} class="w-4 h-4 text-gray-500" />
		</div>
		<div class="flex items-center text-sm">RAM</div> <!-- Col 2: Label -->
		<div class="text-sm"> <!-- Col 3: Details -->
			<span>{config.ram_size} GB</span>
		</div>
		<div class="text-sm text-right"> <!-- Col 4: Price -->
			{#if showPricePerUnit && pricePerGbRam > 0}
				<span class="text-xs text-gray-500">({pricePerGbRam.toFixed(2)} €/GB)</span>
			{/if}
		</div>

		<!-- NVMe Drives -->
		{#if config.nvme_drives.length > 0}
			<div class="flex items-center justify-center text-sm"> <!-- Col 1: Icon -->
				<FontAwesomeIcon icon={faSdCard} class="w-4 h-4 text-gray-500" />
			</div>
			<div class="flex items-center text-sm">NVMe</div> <!-- Col 2: Label -->
			<div class="text-sm"> <!-- Col 3: Details -->
				<span>
					{#each summarizeNumbers(config.nvme_drives) as summary, i (summary.value)}
						<span class="whitespace-nowrap">{summary.count > 1 ? `${summary.count}x ` : ''}{getFormattedDiskSize(summary.value)}</span>{i < summarizeNumbers(config.nvme_drives).length - 1 ? ', ' : ''}
					{/each}
				</span>
			</div>
			<div class="text-sm text-right flex items-center justify-end"> <!-- Col 4: Price -->
				{#if showPricePerUnit && pricePerTbNvme > 0}
					<span class="text-xs text-gray-500">({pricePerTbNvme.toFixed(2)} €/TB)</span>
				{/if}
			</div>
		{/if}

		<!-- SATA Drives -->
		{#if config.sata_drives.length > 0}
			<div class="flex items-center justify-center text-sm"> <!-- Col 1: Icon -->
				<FontAwesomeIcon icon={faHardDrive} class="w-4 h-4 text-gray-500" />
			</div>
			<div class="flex items-center text-sm">SATA</div> <!-- Col 2: Label -->
			<div class="text-sm"> <!-- Col 3: Details -->
				<span>
					{#each summarizeNumbers(config.sata_drives) as summary, i (summary.value)}
						<span class="whitespace-nowrap">{summary.count > 1 ? `${summary.count}x ` : ''}{getFormattedDiskSize(summary.value)}</span>{i < summarizeNumbers(config.sata_drives).length - 1 ? ', ' : ''}
					{/each}
				</span>
			</div>
			<div class="text-sm text-right flex items-center justify-end"> <!-- Col 4: Price -->
				{#if showPricePerUnit && pricePerTbSata > 0}
					<span class="text-xs text-gray-500">({pricePerTbSata.toFixed(2)} €/TB)</span>
				{/if}
			</div>
		{/if}

		<!-- HDD Drives -->
		{#if config.hdd_drives.length > 0}
			<div class="flex items-center justify-center text-sm"> <!-- Col 1: Icon -->
				<FontAwesomeIcon icon={faHardDrive} class="w-4 h-4 text-gray-500" />
			</div>
			<div class="flex items-center text-sm">HDD</div> <!-- Col 2: Label -->
			<div class="text-sm"> <!-- Col 3: Details -->
				<span>
					{#each summarizeNumbers(config.hdd_drives) as summary, i (summary.value)}
						<span class="whitespace-nowrap">{summary.count > 1 ? `${summary.count}x ` : ''}{getFormattedDiskSize(summary.value)}</span>{i < summarizeNumbers(config.hdd_drives).length - 1 ? ', ' : ''}
					{/each}
				</span>
			</div>
			<div class="text-sm text-right flex items-center justify-end"> <!-- Col 4: Price -->
				{#if showPricePerUnit && pricePerTbHdd > 0}
					<span class="text-xs text-gray-500">({pricePerTbHdd.toFixed(2)} €/TB)</span>
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