<script lang="ts">
	import type { ServerConfiguration } from '$lib/api/frontend/filter';
	import type { ServerFilter } from '$lib/filter'; // Corrected import path for ServerFilter
	import { getFormattedDiskSize } from '$lib/disksize';
	import { faHardDrive, faMemory, faSdCard, faShoppingCart, faFilter, faExternalLinkAlt, faHammer, faTicket } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon as Fa } from '@fortawesome/svelte-fontawesome';
	import { Drawer, Button, CloseButton, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Badge, Indicator } from 'flowbite-svelte';
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	dayjs.extend(relativeTime);
	import { settingsStore } from '$lib/stores/settings';
	import { vatOptions } from './VatSelector.svelte';
	import { filter } from '$lib/stores/filter'; // Corrected import name
	import { getHetznerLink, convertServerConfigurationToFilter } from '$lib/filter'; // Added convert function
  	import { sineIn } from 'svelte/easing';

	export let config: ServerConfiguration | null = null;
	export let hidden: boolean = true; // Two-way binding: bind:ihdden

	let transitionParamsRight = {
		x: 320,
		duration: 200,
		easing: sineIn
	};

	interface MockAuction {
		id: string;
		lastPrice: number;
		link: string;
		lastSeen: number; // Unix timestamp
	}

	const mockAuctions: MockAuction[] = [
		// Using placeholder timestamps for demonstration
		{ id: 'SB-A123', lastPrice: 45.5, link: 'https://www.hetzner.com/sb?search=A123', lastSeen: dayjs().subtract(10, 'minutes').unix() },
		{ id: 'SB-B456', lastPrice: 48.0, link: 'https://www.hetzner.com/sb?search=B456', lastSeen: dayjs().subtract(90, 'minutes').unix() },
		{ id: 'SB-C789', lastPrice: 42.99, link: 'https://www.hetzner.com/sb?search=C789', lastSeen: dayjs().subtract(5, 'hours').unix() }
	];

	function closeDrawer() {
		hidden = true;
	}

	interface NumberSummary {
		count: number;
		value: number;
	}

	// Helper function copied from ServerCard.svelte
	function summarizeNumbers(numbers: number[]): NumberSummary[] {
		const counts = new Map<number, number>();
		const order: number[] = [];

		for (const num of numbers) {
			if (counts.has(num)) {
				counts.set(num, counts.get(num)! + 1);
			} else {
				counts.set(num, 1);
				order.push(num); // Preserve the order of first occurrence
			}
		}

		const result: NumberSummary[] = [];

		for (const num of order) {
			const count = counts.get(num)!;
			result.push({ count, value: num });
		}

		return result;
	}

	// Define the type for VAT option keys based on the imported value
	type VatCountryCode = keyof typeof vatOptions;

	// VAT related reactive variables copied from ServerCard.svelte, with improved type safety
	$: countryCode = $settingsStore.vatSelection.countryCode;
	// Ensure the country code is a valid key before using it, default to 'NET'
	$: validCountryCode = (countryCode && countryCode in vatOptions) ? countryCode as VatCountryCode : 'NET';
	$: selectedOption = config ? vatOptions[validCountryCode] : vatOptions['NET'];
	$: displayPrice = config ? (config.price ?? 0) * (1 + selectedOption.rate) : 0;
	$: vatSuffix = selectedOption.rate > 0 ? `(${(selectedOption.rate * 100).toFixed(0)}% VAT)` : '(net)';
</script>

<Drawer bind:hidden={hidden} backdrop={true} bgOpacity="bg-black/25" placement="right" transitionType="fly" transitionParams={transitionParamsRight} id="server-detail-drawer" width="w-96">
	<div class="flex items-center mb-4">
		<h5 class="inline-flex items-center text-base font-semibold text-gray-500 dark:text-gray-400">
			Server Details
		</h5>
		<CloseButton on:click={closeDrawer} class="ms-auto" />
	</div>

	{#if config}
		<!-- Configuration Details - Styled like ServerCard -->
		<div class="mb-6">
			<div class="flex items-center justify-between mb-2">
				<h5 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
					{config.cpu}
				</h5>
				<Button size="xs" color="alternative" title="Apply configuration to filter" on:click={() => {
					if (config) {
						const newFilter = convertServerConfigurationToFilter(config);
						filter.set(newFilter);
						closeDrawer();
					}
				}}>
					<Fa icon={faFilter} />
				</Button>
			</div>
			<!-- Price with VAT -->
			<div class="mb-3">
				<span class="text-lg font-bold text-gray-900 dark:text-white">
					{displayPrice.toFixed(2)} €
				</span>
				<span class="text-sm text-gray-600 dark:text-gray-400 ml-1">{vatSuffix}</span>
				<span class="text-gray-400 text-xs ml-1">monthly</span>
				{#if config.markup_percentage !== null}
					<div class="text-gray-400 text-xs mt-1">
						<span class="text-gray-500">
							{#if (config.markup_percentage ?? 0) > 0}
								<span
									style={`color: hsl(${Math.max(
										0,
										Math.min(
											120,
											(120 *
												(10 -
													(config.markup_percentage ?? 0))) /
												10,
										),
									)}, 70%,
				50%);`}>{(config.markup_percentage ?? 0).toFixed(0)}%</span
								> higher than best
							{:else}
								best price
							{/if}
						</span>
					</div>
				{/if}
			</div>

			<!-- Aligned Hardware Details -->
			<div class="font-normal text-gray-700 dark:text-gray-400 leading-tight grid grid-cols-[50px,1fr] gap-x-3 gap-y-1 mb-3">
				<!-- RAM -->
				<div class="flex items-center text-sm">
					<Fa icon={faMemory} class="me-1 w-4 text-gray-500" />
					RAM
				</div>
				<div class="text-sm">
					{config.ram_size} GB
				</div>

				<!-- NVMe Drives -->
				{#if config.nvme_drives.length > 0}
					<div class="flex items-center text-sm">
						<Fa icon={faSdCard} class="me-1 w-4 text-gray-500" />
						NVMe
					</div>
					<div class="text-sm">
						{summarizeNumbers(config.nvme_drives)
							.map((d) => `${d.count}× ${getFormattedDiskSize(d.value, 1)}`)
							.join(', ')}
					</div>
				{/if}

				<!-- SATA Drives -->
				{#if config.sata_drives.length > 0}
					<div class="flex items-center text-sm">
						<Fa icon={faSdCard} class="me-1 w-4 text-gray-500" />
						SATA
					</div>
					<div class="text-sm">
						{summarizeNumbers(config.sata_drives)
							.map((d) => `${d.count}× ${getFormattedDiskSize(d.value, 1)}`)
							.join(', ')}
					</div>
				{/if}

				<!-- HDD Drives -->
				{#if config.hdd_drives.length > 0}
					<div class="flex items-center text-sm">
						<Fa icon={faHardDrive} class="me-1 w-4 text-gray-500" />
						HDD
					</div>
					<div class="text-sm">
						{summarizeNumbers(config.hdd_drives)
							.map((d) => `${d.count}× ${getFormattedDiskSize(d.value, 1)}`)
							.join(', ')}
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

		<div class="flex items-center justify-between mb-1">
			<h6 class="text-lg font-medium text-gray-900 dark:text-white">Auctions</h6>
			{#if config}
				<a href={getHetznerLink(config)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700" title="Search on Hetzner with this configuration">
					<Fa icon={faExternalLinkAlt} />
				</a>
			{/if}
		</div>
		<Table hoverable={true} striped={true}>
			<TableBody class="divide-y">
				{#each mockAuctions as auction (auction.id)}
					<TableBodyRow>
						<TableBodyCell class="px-1 py-4">
							<div>#{auction.id}</div>
							<div class="text-gray-400 text-xs mt-1">
								<span class="inline-flex items-center">
									{#if dayjs.unix(auction.lastSeen ?? 0) > dayjs().subtract(80, 'minutes')}
										<Indicator color="green" class="animate-pulse mr-1.5" size="xs" />
									{:else}
										<Indicator color="red" class="mr-1.5" size="xs" />
									{/if}
									seen {auction.lastSeen ? dayjs.unix(auction.lastSeen).fromNow() : 'unknown'}
								</span>
							</div>
						</TableBodyCell>
						<TableBodyCell class="px-2 py-4 text-right">{auction.lastPrice.toFixed(2)} €</TableBodyCell>
						<TableBodyCell class="px-2 py-4 text-right">
							<form action="https://robot.hetzner.com/order/marketConfirm" method="POST" target="_blank">
								<input type="hidden" name="id" value={auction.id} />
								<input type="hidden" name="server_id" value={auction.id} />
								<input type="hidden" name="culture" value="en_GB" />
								<input type="hidden" name="ip[1266]" value="1" />
								<input type="hidden" name="country" value="de" />
								<input type="hidden" name="currency" value="EUR" />
								<Button type="submit" size="md" aria-label="Confirm Order" class="px-4">
									<Fa icon={faShoppingCart} />
								</Button>
							</form>
						</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>

		<!-- Horizontal Rule and Disclaimer -->
		<hr class="my-4 border-gray-200 dark:border-gray-600" />
		<!-- Enhanced Disclaimer -->
		<div class="text-xs leading-relaxed text-gray-400 dark:text-gray-500 space-y-2">
			<p>
				Clicking the <Fa icon={faShoppingCart} class="inline mx-1" /> button redirects you to Hetzner to confirm the order. Clicking the <Fa icon={faExternalLinkAlt} class="inline mx-1" /> button opens a preconfigured Hetzner search.
			</p>
			<p>
				Please note: Hetzner search results depend on availability and may differ. Ensure server specs meet your needs. Prices shown here include VAT based on your selection, but Hetzner's final price may vary.
			</p>
			<p>
				This service is provided "as is" without warranty. The author assumes no responsibility for issues or discrepancies on the Hetzner platform.
			</p>
		</div>
	{:else}
		<p class="text-gray-500 dark:text-gray-400">No server selected.</p>
	{/if}
</Drawer>