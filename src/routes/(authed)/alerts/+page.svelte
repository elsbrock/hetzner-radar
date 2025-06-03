<script lang="ts">
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import AlertModal from "$lib/components/AlertModal.svelte";
    import AlertAuctionsDrawer from "$lib/components/AlertAuctionsDrawer.svelte";
    import CloudAlertModal from "$lib/components/CloudAlertModal.svelte";
    import { encodeFilter } from "$lib/filter";
    import { addToast } from "$lib/stores/toast";
    import { invalidate, invalidateAll } from "$app/navigation";
    import { MAX_ALERTS } from "$lib/api/backend/alerts.js";
    import { MAX_CLOUD_ALERTS } from "$lib/api/backend/cloud-alerts.js";
    import { page } from "$app/stores";
    import type { PriceAlert } from "$lib/api/backend/alerts";

    import dayjs from "dayjs";
    import localizedFormat from "dayjs/plugin/localizedFormat";
    import timezone from "dayjs/plugin/timezone";
    import utc from "dayjs/plugin/utc";
    dayjs.extend(localizedFormat);
    dayjs.extend(utc);
    dayjs.extend(timezone);

    import {
        Tabs, TabItem, Card, Badge, Button, Spinner, Alert, 
        Modal, Label, Input, MultiSelect, Radio, Toggle, ButtonGroup
    } from "flowbite-svelte";
    import {
        BellRingSolid, BullhornSolid, PlusOutline, PenSolid, TrashBinSolid, 
        CheckCircleSolid, CloseCircleSolid, ExclamationCircleSolid,
        SearchOutline, EyeSolid, InfoCircleSolid
    } from "flowbite-svelte-icons";

    let { data } = $props();

    // Tabs state
    let activeTab = 'price-alerts';

    // Price alerts state
    let showEdit = false;
    let selectedAlert: PriceAlert | null = null;
    let drawerHidden = true;
    let selectedAlertId: string | null = null;
    let selectedVatRate = 0;

    // Cloud alerts state  
    let showCloudAlertModal = false;
    let editingCloudAlert: any = null;
    let deletingCloudAlertId: string | null = null;

    // Check URL parameters and hash on mount
    onMount(async () => {
        // Check for tab parameter to set active tab
        const tabParam = $page.url.searchParams.get('tab');
        if (tabParam === 'cloud-alerts') {
            activeTab = 'cloud-alerts';
        }

        const viewParam = $page.url.searchParams.get('view');
        if (viewParam && drawerHidden) {
            try {
                const response = await fetch(`/alerts/${viewParam}/auctions`);
                
                if (!response.ok) {
                    addToast({
                        message: "Alert not found or auctions unavailable.",
                        type: "error",
                        dismissible: true,
                        timeout: 3000
                    });
                    
                    const url = new URL(window.location.href);
                    url.searchParams.delete('view');
                    goto(url.toString(), { replaceState: true, keepFocus: true });
                    return;
                }
                
                selectedAlertId = viewParam;
                selectedVatRate = 0;
                drawerHidden = false;
            } catch (err) {
                console.error("Error checking alert:", err);
                addToast({
                    message: "Failed to check alert. Please try again later.",
                    type: "error",
                    dismissible: true,
                    timeout: 3000
                });
                
                const url = new URL(window.location.href);
                url.searchParams.delete('view');
                goto(url.toString(), { replaceState: true, keepFocus: true });
            }
        }
    });
    
    // Reset selectedAlertId when drawer is closed
    $effect(() => {
        if (drawerHidden) {
            selectedAlertId = null;
        }
    });

    // Watch for URL parameter changes to switch tabs
    $effect(() => {
        const tabParam = $page.url.searchParams.get('tab');
        if (tabParam === 'cloud-alerts') {
            activeTab = 'cloud-alerts';
        }
    });

    // Cloud alerts functions
    async function deleteCloudAlert(alertId: string) {
        if (!confirm('Are you sure you want to delete this alert?')) {
            return;
        }

        deletingCloudAlertId = alertId;
        try {
            const response = await fetch(`/cloud-alerts/${alertId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                addToast({
                    message: 'Cloud alert deleted successfully',
                    type: 'success',
                    dismissible: true,
                    timeout: 3000
                });
                await invalidateAll();
            } else {
                const result = await response.json();
                throw new Error(result.error || 'Failed to delete alert');
            }
        } catch (error) {
            addToast({
                message: error instanceof Error ? error.message : 'Failed to delete alert',
                type: 'error',
                dismissible: true,
                timeout: 5000
            });
        } finally {
            deletingCloudAlertId = null;
        }
    }

    function openCreateCloudAlertModal() {
        editingCloudAlert = null;
        showCloudAlertModal = true;
    }

    function openEditCloudAlertModal(alert: any) {
        editingCloudAlert = alert;
        showCloudAlertModal = true;
    }

    // Generate server type and location options from cloud status data
    const serverTypeOptions = $derived(
        data.cloudStatusData?.serverTypes?.map(st => ({
            value: st.id,
            name: `${st.name.toUpperCase()} - ${st.cores} Core${st.cores > 1 ? 's' : ''} / ${(st.memory / 1024).toFixed(0)} GB RAM`
        })) || []
    );

    const locationOptions = $derived(
        data.cloudStatusData?.locations?.map(loc => ({
            value: loc.id,
            name: `${loc.city}, ${loc.country} (${loc.name})`
        })) || []
    );
</script>

<AlertModal
    bind:alert={selectedAlert}
    bind:open={showEdit}
    user={data.user}
    on:success={() => invalidateAll()}
/>

{#if !drawerHidden && selectedAlertId}
    <AlertAuctionsDrawer
        alertId={selectedAlertId}
        bind:hidden={drawerHidden}
        vatRate={selectedVatRate}
    />
{/if}

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
    <div class="max-w-5xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
            <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">Alert Management</h1>
            <p class="text-lg text-gray-600 dark:text-gray-400">
                Monitor server prices and cloud availability with smart notifications
            </p>
        </div>

        <!-- Tabs -->
        <Tabs bind:activeTabValue={activeTab} contentClass="mt-6">
            <TabItem open value="price-alerts">
                <div slot="title" class="flex items-center gap-2">
                    <BellRingSolid class="w-4 h-4" />
                    Price Alerts
                </div>

                <div class="space-y-6">
                    <!-- Price Alerts Header -->
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Price Alerts</h2>
                            <p class="text-gray-600 dark:text-gray-400 mt-1">
                                Get notified when server prices drop below your target
                            </p>
                        </div>
                        <Button href="/analyze" class="rounded-xl px-6 py-3 font-medium">
                            <BellRingSolid class="w-4 h-4 mr-2" />
                            Create Price Alert
                        </Button>
                    </div>

                    <!-- Active Price Alerts -->
                    {#await data.alerts.active}
                        <div class="flex justify-center py-12">
                            <Spinner size="8" />
                        </div>
                    {:then active}
                        <div class="grid gap-4">
                            <div class="flex items-center justify-between">
                                <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                                    Active Alerts ({active.length}/{MAX_ALERTS})
                                </h3>
                            </div>
                            
                            {#if active.length === 0}
                                <div class="text-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                    <p class="text-lg text-gray-700 dark:text-gray-300">
                                        There are no active alerts.
                                    </p>
                                    <p class="mt-2">
                                        <Button href="/analyze" color="primary" size="sm" class="shadow-sm">
                                            Create Alert
                                        </Button>
                                    </p>
                                </div>
                            {:else}
                                <div class="space-y-3">
                                    {#each active as alert}
                                        <div class="flex flex-col md:flex-row md:items-start p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-l-gray-300 dark:border-l-gray-700">
                                            <div class="mb-3 md:mb-0 w-full md:w-1/3">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Name</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white text-ellipsis whitespace-nowrap">
                                                    {alert.name}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/3">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Target Price</span>
                                                <div>
                                                    <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                        €{alert.price.toFixed(2)}
                                                    </span>
                                                    <span class="block text-xs text-gray-500 dark:text-gray-400">
                                                        (incl. {alert.vat_rate}% VAT)
                                                    </span>
                                                </div>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/3">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Created</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {dayjs.utc(alert.created_at).local().format("MMM D, YYYY")}
                                                </span>
                                            </div>
                                            <div class="mt-3 md:mt-0 self-center">
                                                <ButtonGroup>
                                                    <Button
                                                        size="xs"
                                                        href={`/analyze?filter=${encodeFilter(JSON.parse(alert.filter))}`}
                                                    >
                                                        <SearchOutline class="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        on:click={() => {
                                                            selectedAlert = alert;
                                                            showEdit = true;
                                                        }}
                                                    >
                                                        <PenSolid class="w-4 h-4" />
                                                    </Button>
                                                    <form
                                                        method="POST"
                                                        action="?/delete"
                                                        use:enhance={() => {
                                                            addToast({
                                                                type: "success",
                                                                message: "Alert deleted successfully.",
                                                                dismissible: true,
                                                                timeout: 3000
                                                            });
                                                            invalidate("/alerts");
                                                        }}
                                                        class="inline"
                                                    >
                                                        <input type="hidden" name="alertId" value={alert.id} />
                                                        <Button type="submit" size="xs">
                                                            <TrashBinSolid class="w-4 h-4" />
                                                        </Button>
                                                    </form>
                                                </ButtonGroup>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {:catch error}
                        <Alert color="red" class="rounded-2xl">
                            <ExclamationCircleSolid slot="icon" class="w-4 h-4" />
                            <strong>Error:</strong> Could not load price alerts.
                        </Alert>
                    {/await}

                    <!-- Triggered Price Alerts -->
                    {#await data.alerts.triggered}
                        <div class="flex justify-center py-8">
                            <Spinner size="6" />
                        </div>
                    {:then triggered}
                        <div class="grid gap-4">
                            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                                Recently Triggered ({triggered.length})
                            </h3>
                            
                            {#if triggered.length === 0}
                                <div class="text-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                    <p class="text-lg text-gray-700 dark:text-gray-300">
                                        No alerts have triggered yet.
                                    </p>
                                </div>
                            {:else}
                                <div class="space-y-3">
                                    {#each triggered as alert}
                                        <div class="flex flex-col md:flex-row md:items-start p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-l-green-500">
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Name</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white text-ellipsis whitespace-nowrap">
                                                    {alert.name}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Target</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    €{alert.price.toFixed(2)}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Triggered At</span>
                                                <span class="text-lg font-semibold text-green-600 dark:text-green-400">
                                                    €{alert.trigger_price.toFixed(2)}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Date</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {dayjs.utc(alert.triggered_at).local().format("MMM D, HH:mm")}
                                                </span>
                                            </div>
                                            <div class="mt-3 md:mt-0 self-center w-full md:w-1/5">
                                                <ButtonGroup>
                                                    <Button
                                                        size="xs"
                                                        href={`/analyze?filter=${encodeFilter(JSON.parse(alert.filter))}`}
                                                    >
                                                        <SearchOutline class="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        on:click={async () => {
                                                            try {
                                                                const response = await fetch(`/alerts/${alert.id}/auctions`);
                                                                if (!response.ok) {
                                                                    addToast({
                                                                        message: "Alert not found or auctions unavailable.",
                                                                        type: "error",
                                                                        dismissible: true,
                                                                        timeout: 3000
                                                                    });
                                                                    return;
                                                                }
                                                                selectedAlertId = alert.id;
                                                                selectedVatRate = alert.vat_rate;
                                                                drawerHidden = false;
                                                            } catch (err) {
                                                                console.error("Error checking alert:", err);
                                                                addToast({
                                                                    message: "Failed to check alert. Please try again later.",
                                                                    type: "error",
                                                                    dismissible: true,
                                                                    timeout: 3000
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <EyeSolid class="w-4 h-4" />
                                                    </Button>
                                                </ButtonGroup>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {:catch error}
                        <Alert color="red" class="rounded-2xl">
                            <ExclamationCircleSolid slot="icon" class="w-4 h-4" />
                            <strong>Error:</strong> Could not load triggered alerts.
                        </Alert>
                    {/await}
                </div>
            </TabItem>

            <TabItem value="cloud-alerts">
                <div slot="title" class="flex items-center gap-2">
                    <BullhornSolid class="w-4 h-4" />
                    Cloud Alerts
                </div>

                <div class="space-y-6">
                    <!-- Cloud Alerts Header -->
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Cloud Availability Alerts</h2>
                            <p class="text-gray-600 dark:text-gray-400 mt-1">
                                Monitor cloud server availability changes in real-time
                            </p>
                        </div>
                        <Button 
                            on:click={openCreateCloudAlertModal} 
                            class="rounded-xl px-6 py-3 font-medium"
                        >
                            <BellRingSolid class="w-4 h-4 mr-2" />
                            Create Cloud Alert
                        </Button>
                    </div>

                    <!-- Active Cloud Alerts -->
                    {#if data.cloudAlerts}
                        <div class="grid gap-4">
                            <div class="flex items-center justify-between">
                                <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                                    Active Alerts ({data.cloudAlerts.activeAlerts.length}/{MAX_CLOUD_ALERTS})
                                </h3>
                            </div>
                            
                            {#if data.cloudAlerts.activeAlerts.length === 0}
                                <div class="text-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                    <p class="text-lg text-gray-700 dark:text-gray-300">
                                        There are no active cloud alerts.
                                    </p>
                                    <p class="mt-2">
                                        <Button on:click={openCreateCloudAlertModal} color="primary" size="sm" class="shadow-sm">
                                            Create Alert
                                        </Button>
                                    </p>
                                </div>
                            {:else}
                                <div class="space-y-3">
                                    {#each data.cloudAlerts.activeAlerts as alert}
                                        <div class="flex flex-col md:flex-row md:items-start p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-l-blue-500">
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Name</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white text-ellipsis whitespace-nowrap">
                                                    {alert.name}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Alert Type</span>
                                                <Badge 
                                                    color={alert.alert_on === 'available' ? 'green' : alert.alert_on === 'unavailable' ? 'red' : 'yellow'}
                                                    class="text-xs"
                                                >
                                                    {alert.alert_on}
                                                </Badge>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Server Types</span>
                                                <div class="flex flex-wrap gap-1">
                                                    {#each alert.server_type_ids.slice(0, 2) as typeId}
                                                        {@const serverType = serverTypeOptions.find(st => st.value === typeId)}
                                                        {#if serverType}
                                                            <Badge color="blue" class="text-xs">
                                                                {serverType.name.split(' - ')[0]}
                                                            </Badge>
                                                        {/if}
                                                    {/each}
                                                    {#if alert.server_type_ids.length > 2}
                                                        <Badge color="gray" class="text-xs">+{alert.server_type_ids.length - 2}</Badge>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Locations</span>
                                                <div class="flex flex-wrap gap-1">
                                                    {#each alert.location_ids.slice(0, 2) as locId}
                                                        {@const location = locationOptions.find(loc => loc.value === locId)}
                                                        {#if location}
                                                            <Badge color="purple" class="text-xs">
                                                                {location.name.split(' (')[1]?.replace(')', '') || location.name}
                                                            </Badge>
                                                        {/if}
                                                    {/each}
                                                    {#if alert.location_ids.length > 2}
                                                        <Badge color="gray" class="text-xs">+{alert.location_ids.length - 2}</Badge>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Notifications</span>
                                                <div class="flex items-center gap-2 text-sm">
                                                    {#if alert.email_notifications}
                                                        <div class="flex items-center gap-1">
                                                            <CheckCircleSolid class="w-3 h-3 text-green-500" />
                                                            <span class="text-gray-900 dark:text-white">Email</span>
                                                        </div>
                                                    {/if}
                                                    {#if alert.discord_notifications}
                                                        <div class="flex items-center gap-1">
                                                            <CheckCircleSolid class="w-3 h-3 text-blue-500" />
                                                            <span class="text-gray-900 dark:text-white">Discord</span>
                                                        </div>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="mt-3 md:mt-0 self-center">
                                                <ButtonGroup>
                                                    <Button
                                                        size="xs"
                                                        on:click={() => openEditCloudAlertModal(alert)}
                                                    >
                                                        <PenSolid class="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        disabled={deletingCloudAlertId === alert.id}
                                                        on:click={() => deleteCloudAlert(alert.id)}
                                                    >
                                                        <TrashBinSolid class="w-4 h-4" />
                                                    </Button>
                                                </ButtonGroup>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>

                        <!-- Cloud Alert History -->
                        {#if data.cloudAlerts.triggeredAlerts.length > 0}
                            <div class="grid gap-4">
                                <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                                    Recent Triggers ({data.cloudAlerts.triggeredAlerts.length})
                                </h3>
                                
                                <div class="space-y-3">
                                    {#each data.cloudAlerts.triggeredAlerts.slice(0, 10) as trigger}
                                        <div class="flex flex-col md:flex-row md:items-start p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 {trigger.event_type === 'available' ? 'border-l-green-500' : 'border-l-red-500'}">
                                            <div class="mb-3 md:mb-0 w-full md:w-1/4">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Server Type</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {trigger.server_type_name.toUpperCase()}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/4">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Location</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {trigger.location_name}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/4">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Status</span>
                                                <div class="flex items-center gap-2">
                                                    {#if trigger.event_type === 'available'}
                                                        <CheckCircleSolid class="w-4 h-4 text-green-500" />
                                                        <span class="text-lg font-semibold text-green-600 dark:text-green-400">Available</span>
                                                    {:else}
                                                        <CloseCircleSolid class="w-4 h-4 text-red-500" />
                                                        <span class="text-lg font-semibold text-red-600 dark:text-red-400">Unavailable</span>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/4">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Date</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {dayjs(trigger.triggered_at).format('MMM D, HH:mm')}
                                                </span>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {:else}
                        <Alert color="yellow" class="rounded-2xl">
                            <InfoCircleSolid slot="icon" class="w-4 h-4" />
                            Unable to load cloud alerts data.
                        </Alert>
                    {/if}
                </div>
            </TabItem>
        </Tabs>
    </div>
</div>

<!-- Cloud Alert Modal -->
<CloudAlertModal 
    bind:open={showCloudAlertModal}
    bind:alert={editingCloudAlert}
    {serverTypeOptions}
    {locationOptions}
    on:success={() => invalidateAll()}
/>