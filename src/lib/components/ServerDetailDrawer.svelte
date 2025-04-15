<script lang="ts">
	import type { ServerConfiguration } from '$lib/api/frontend/filter';
	import type { ServerFilter } from '$lib/filter'; // Corrected import path for ServerFilter
	import { getFormattedDiskSize } from '$lib/disksize';
	import { HETZNER_IPV4_COST_CENTS } from '$lib/constants';
	import { faHardDrive, faMemory, faSdCard, faShoppingCart, faFilter, faExternalLinkAlt, faHammer, faTicket } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon as Fa } from '@fortawesome/svelte-fontawesome';
	import { Drawer, Button, CloseButton, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Badge, Indicator, Tooltip } from 'flowbite-svelte';
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	dayjs.extend(relativeTime);
	import { settingsStore } from '$lib/stores/settings';
	import { vatOptions } from './VatSelector.svelte';
	import { filter } from '$lib/stores/filter'; // Corrected import name
	import { getHetznerLink, convertServerConfigurationToFilter } from '$lib/filter'; // Added convert function
  	import { sineIn } from 'svelte/easing';
    import { withDbConnections } from '$lib/api/frontend/dbapi'; // Added
 import { getAuctionsForConfiguration, type AuctionResult } from '../api/frontend/auctions'; // Added
 import { db } from '../../stores/db'; // Use relative path for db store import
    import ServerPriceChart from './ServerPriceChart.svelte';
    import { getPrices } from '$lib/api/frontend/filter';

	export let config: ServerConfiguration | null = null;
	export let hidden: boolean = true; // Two-way binding: bind:ihdden

	let transitionParamsRight = {
		x: 320,
		duration: 200,
		easing: sineIn
	};

	// Real auction data
	let auctions: AuctionResult[] = [];
	let loadingAuctions = false;

	// Fetch auctions when config changes or db is ready
	$: (async () => { // Make the reactive block async
		// Ensure both config and $db are ready before fetching
		if (config && $db) {
			loadingAuctions = true;
			auctions = []; // Clear previous results
			try {
				// Use withDbConnections to get a connection
				await withDbConnections($db, async (conn) => {
					auctions = await getAuctionsForConfiguration(conn, config, $filter?.recentlySeen ?? false);
				});
			} catch (error) {
				console.error('Error fetching auctions:', error);
				// Optionally show an error message to the user
				auctions = []; // Ensure auctions is empty on error
			} finally {
				loadingAuctions = false;
			}
		} else {
			// Reset if config is null or db not ready
			auctions = [];
			loadingAuctions = false;
		}
	})(); // Immediately invoke the async function

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

	   let serverPrices: any[] = [];
	   let loadingPrices = true;

	   $: (async () => {
	       if (config && $db) {
	           loadingPrices = true;
	           try {
	               await withDbConnections($db, async (conn) => {
	                   serverPrices = await getPrices(conn, convertServerConfigurationToFilter(config));
	               });
	           } catch (error) {
	               console.error('Error fetching server prices:', error);
	               serverPrices = [];
	           } finally {
	               loadingPrices = false;
	           }
	       } else {
	           serverPrices = [];
	           loadingPrices = false;
	       }
	   })();
</script>

<Drawer bind:hidden={hidden} backdrop={true} bgOpacity="bg-black/25" placement="right" transitionType="fly" transitionParams={transitionParamsRight} id="server-detail-drawer" width="w-96" class="border-l-1">
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
				<Button size="xs" color="alternative" on:click={() => {
					if (config) {
						const newFilter = convertServerConfigurationToFilter(config);
						filter.set(newFilter);
						closeDrawer();
					}
				}}>
					<Fa icon={faFilter} />
				</Button>
				<Tooltip placement="bottom" class="z-50">Apply configuration to filter</Tooltip>
			</div>
			<!-- Price with VAT -->
			<div class="mb-3 max-w-full overflow-hidden">
				<div class="h-50 -mt-5 -mb-4 -mx-3"><ServerPriceChart data={serverPrices} loading={loadingPrices} toolbarShow={false} legendShow={false} /></div>
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
				<Button href={getHetznerLink(config)} target="_blank" rel="noopener noreferrer" size="xs" color="alternative">
					<Fa icon={faExternalLinkAlt} />
				</Button>
				<Tooltip placement="bottom" class="z-50">Search on Hetzner with this configuration</Tooltip>
			{/if}
		</div>
		<Table hoverable={true} striped={true}>
			<TableBody class="divide-y">
				{#if loadingAuctions}
					<TableBodyRow>
						<TableBodyCell colspan={3} class="text-center py-4">
							<p>Loading auctions...</p>
						</TableBodyCell>
					</TableBodyRow>
				{:else if auctions.length > 0}
					{#each auctions.slice(0, 5) as auction (auction.id)}
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
							<TableBodyCell class="px-2 py-4 text-right">{((auction.lastPrice + HETZNER_IPV4_COST_CENTS/100) * (1 + selectedOption.rate)).toFixed(2)} €</TableBodyCell>
							<TableBodyCell class="px-2 py-4 text-right">
								<form action="https://robot.hetzner.com/order/marketConfirm" method="POST" target="_blank">
									<input type="hidden" name="id" value={auction.id} />
									<input type="hidden" name="server_id" value={auction.id} />
									<input type="hidden" name="culture" value="en_GB" />
									<input type="hidden" name="ip[1266]" value="1" />
									<input type="hidden" name="country" value={validCountryCode.toLowerCase()} />
									<input type="hidden" name="currency" value="EUR" />
									<Button type="submit" size="md" aria-label="Confirm Order" class="px-4">
										<Fa icon={faShoppingCart} />
									</Button>
								</form>
							</TableBodyCell>
						</TableBodyRow>
					{/each}
				{:else}
					<TableBodyRow>
						<TableBodyCell colspan={3} class="text-center py-4">
							<p>No matching auctions found.</p>
						</TableBodyCell>
					</TableBodyRow>
				{/if}
			</TableBody>
		</Table>
		{#if auctions.length > 5}
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
				Showing the 5 most recently seen auctions. More may be available.
			</p>
		{/if}

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