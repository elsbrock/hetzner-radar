<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import dayjs from "dayjs";
    import relativeTime from "dayjs/plugin/relativeTime";
    import {
            Button,
            CloseButton,
            Drawer,
            Spinner,
            Table,
            TableBody,
            TableBodyCell,
            TableBodyRow
        } from "flowbite-svelte";
        import { sineIn } from "svelte/easing";
        import { HETZNER_IPV4_COST_CENTS } from "$lib/constants";
        import { FontAwesomeIcon as Fa } from "@fortawesome/svelte-fontawesome";
        import { faShoppingCart } from "@fortawesome/free-solid-svg-icons";
        import { addToast } from "$lib/stores/toast";
    
    dayjs.extend(relativeTime);

    // Define the auction match interface
    interface AuctionMatch {
        id: number;
        auction_id: number;
        alert_history_id: number;
        match_price: number;
        matched_at: string;
        
        // Auction details
        cpu: string;
        ram: string;
        datacenter: string;
        location: string;
        price: number;
        seen: string;
    }

    // Props using Svelte 5 runes
    interface $$Props {
        alertId?: string | null;
        hidden?: boolean;
        vatRate?: number;
    }
    
    // Define props using $props with default values
    let { 
        alertId = null, 
        hidden = $bindable(true),
        vatRate = 0
    } = $props();

    let transitionParamsRight = {
        x: 320,
        duration: 200,
        easing: sineIn,
    };

    // State using Svelte 5 runes
    let auctions = $state<AuctionMatch[]>([]);
    let loading = $state(false);
    let error = $state<string | null>(null);
    let alertName = $state<string | null>(null);

    // Check URL parameters on mount to auto-open drawer
    onMount(() => {
        const viewParam = $page.url.searchParams.get('view');
        if (viewParam) {
            alertId = viewParam;
            hidden = false;
        }
    });

    // Make sure the drawer properly closes when hidden is set to true
    $effect(() => {
        if (hidden) {
            // Reset state when drawer is closed
            alertId = null;
            auctions = [];
            alertName = null;
            error = null;
            
            // Update URL to remove the view parameter when drawer is closed
            const url = new URL(window.location.href);
            if (url.searchParams.has('view')) {
                url.searchParams.delete('view');
                goto(url.toString(), { replaceState: true, keepFocus: true });
            }
        }
    });

    // Fetch auctions when alertId changes using $effect
    $effect(() => {
        const currentAlertId = alertId; // Capture current value for the effect
        
        if (currentAlertId) {
            fetchAuctions(currentAlertId);
        } else {
            auctions = [];
            alertName = null;
        }
    });

    async function fetchAuctions(id: string) {
        loading = true;
        error = null;
        auctions = [];
        
        try {
            const response = await fetch(`/alerts/${id}/auctions`);
            
            if (!response.ok) {
                // Handle 404 error specifically
                if (response.status === 404) {
                    // Show an error toast
                    addToast({
                        message: "Alert not found. It may have been deleted.",
                        color: "red",
                        icon: "error"
                    });
                    
                    // Update URL to remove the view parameter
                    const url = new URL(window.location.href);
                    url.searchParams.delete('view');
                    goto(url.toString(), { replaceState: true, keepFocus: true });
                    
                    // Close the drawer by dispatching an event
                    hidden = true;
                    
                    return;
                }
                
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            auctions = data.auctions;
            alertName = data.alertName;
        } catch (err) {
            console.error("Error fetching auction matches:", err);
            
            // Show an error toast
            addToast({
                message: "Failed to fetch auction matches. Please try again later.",
                color: "red",
                icon: "error"
            });
            
            // Update URL to remove the view parameter
            const url = new URL(window.location.href);
            url.searchParams.delete('view');
            goto(url.toString(), { replaceState: true, keepFocus: true });
            
            // Close the drawer
            hidden = true;
        } finally {
            loading = false;
        }
    }

    function closeDrawer() {
        hidden = true;
        
        // Update URL to remove the view parameter
        const url = new URL(window.location.href);
        url.searchParams.delete('view');
        goto(url.toString(), { replaceState: true, keepFocus: true });
    }

    // Calculate price with VAT
    let displayPrice = $derived((auction: AuctionMatch) => {
        return ((auction.price + HETZNER_IPV4_COST_CENTS / 100) * (1 + vatRate / 100)).toFixed(2);
    });
</script>

<Drawer
    bind:hidden
    backdrop={true}
    bgOpacity="bg-black/25"
    placement="right"
    transitionType="fly"
    transitionParams={transitionParamsRight}
    id="alert-auctions-drawer"
    width="w-96"
    class="border-l border-gray-200 dark:border-gray-700"
    activateClickOutside={true}
    on:hidden={() => {
        // Ensure URL is updated when drawer is closed by any means
        const url = new URL(window.location.href);
        if (url.searchParams.has('view')) {
            url.searchParams.delete('view');
            goto(url.toString(), { replaceState: true, keepFocus: true });
        }
    }}
>
    <div class="flex items-center mb-2">
        <h5
            class="inline-flex items-center text-base font-semibold text-gray-500 dark:text-gray-400"
        >
            Matched Auctions
        </h5>
        <CloseButton onclick={closeDrawer} class="ms-auto" />
    </div>

    {#if alertId && !hidden}
        <div class="mb-6">
            <div class="flex items-center justify-between mb-1">
                <h5
                    class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white"
                >
                    {alertName || 'Alert Details'}
                </h5>
            </div>
        </div>

        <!-- Auctions Table -->
        <div class="mb-1">
            <h6 class="text-lg font-medium text-gray-900 dark:text-white">
                Auctions
            </h6>
        </div>
        <Table hoverable={true} striped={true}>
            <TableBody class="divide-y">
                {#if loading}
                    <TableBodyRow>
                        <TableBodyCell colspan={3} class="text-center py-4">
                            <p class="text-gray-700 dark:text-gray-400">
                                <Spinner size="6" />
                                <span class="ml-2">Loading auctions...</span>
                            </p>
                        </TableBodyCell>
                    </TableBodyRow>
                {:else if error}
                    <TableBodyRow>
                        <TableBodyCell colspan={3} class="text-center py-4">
                            <p class="text-gray-700 dark:text-gray-400">
                                This alert was triggered before auction matching was implemented.
                                No auction data is available for this alert.
                            </p>
                        </TableBodyCell>
                    </TableBodyRow>
                {:else if auctions.length > 0}
                    {#each auctions as auction (auction.id)}
                        <TableBodyRow>
                            <TableBodyCell class="px-1 py-4">
                                <div class="text-sm text-gray-700 dark:text-gray-300">
                                    {auction.cpu}
                                </div>
                                <div
                                    class="text-gray-400 dark:text-gray-500 text-xs mt-1"
                                >
                                    <span class="inline-flex items-center">
                                        Matched {dayjs(auction.matched_at).fromNow()}
                                    </span>
                                </div>
                            </TableBodyCell>
                            <TableBodyCell class="px-2 py-4 text-right">
                                <div class="font-medium">{displayPrice(auction)} €</div>
                                <div class="text-xs text-gray-500">
                                    {auction.datacenter}, {auction.location}
                                </div>
                            </TableBodyCell>
                            <TableBodyCell class="px-2 py-4 text-right">
                                <form
                                    action="https://robot.hetzner.com/order/marketConfirm"
                                    method="POST"
                                    target="_blank"
                                >
                                    <input
                                        type="hidden"
                                        name="id"
                                        value={auction.auction_id}
                                    />
                                    <input
                                        type="hidden"
                                        name="server_id"
                                        value={auction.auction_id}
                                    />
                                    <input
                                        type="hidden"
                                        name="culture"
                                        value="en_GB"
                                    />
                                    <input
                                        type="hidden"
                                        name="ip[1266]"
                                        value="1"
                                    />
                                    <Button
                                        type="submit"
                                        size="md"
                                        aria-label="View on Hetzner"
                                        class="px-4"
                                    >
                                        <Fa icon={faShoppingCart} />
                                    </Button>
                                </form>
                            </TableBodyCell>
                        </TableBodyRow>
                    {/each}
                {:else}
                    <TableBodyRow>
                        <TableBodyCell colspan={3} class="text-center py-4">
                            <p class="text-gray-700 dark:text-gray-400">
                                No matching auctions found.
                            </p>
                        </TableBodyCell>
                    </TableBodyRow>
                {/if}
            </TableBody>
        </Table>
        {#if auctions.length > 0}
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Showing {auctions.length} matched auction{auctions.length !== 1 ? 's' : ''}.
            </p>
        {/if}

        <hr class="my-4 border-gray-200 dark:border-gray-600" />
        <div
            class="text-xs leading-relaxed text-gray-400 dark:text-gray-500 space-y-2"
        >
            <p>
                These are the auctions that matched your alert criteria when it was triggered.
                Click the <Fa icon={faShoppingCart} class="inline mx-1" /> button to see the auction on Hetzner's website.
            </p>
            <p>
                Please note: Auctions may no longer be available as they can be purchased quickly.
                Prices shown include VAT based on your selection, but Hetzner's final
                price may vary.
            </p>
            <p>
                This service is provided "as is" without warranty. The author
                assumes no responsibility for issues or discrepancies on the
                Hetzner platform.
            </p>
        </div>
    {/if}
</Drawer>