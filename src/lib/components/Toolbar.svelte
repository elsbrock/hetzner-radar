<script lang="ts">
    import { invalidate } from "$app/navigation";
    import {
        faBell,
        faEuroSign,
        faFilter,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button, ButtonGroup, Tooltip } from "flowbite-svelte";
    import AlertModal from "./AlertModal.svelte";
    import type { PriceAlert } from "$lib/api/backend/alerts";

    // Props
    let { 
        alert = $bindable(null),
        timeUnitPrice = $bindable("perHour"),
        user = { notification_preferences: { email: true, discord: false } }
    }: {
        alert: PriceAlert | null;
        timeUnitPrice: "perHour" | "perMonth";
        user?: {
            discord_webhook_url?: string | null;
            notification_preferences: {
                email: boolean;
                discord: boolean;
            };
        };
    } = $props();

    // Local state
    let alertDialogOpen = $state(false);

    // Event handlers
    function handleSave() {
        // Implement save functionality
    }

    function handleDelete() {
        // Implement delete functionality
    }

    function openAlertDialog(event: MouseEvent) {
        alertDialogOpen = true;
        event.stopPropagation();
    }

    function handleAlertSuccess() {
        invalidate((url) => url.pathname === "/analyze");
    }

    function selectTimeUnit(unit: "perHour" | "perMonth") {
        timeUnitPrice = unit;
    }

    // Computed properties
    const alertExists = $derived(alert !== null && alert !== undefined);
</script>

<div
    class="bg-white px-5 sm:border-t md:border-t-0 mb-5 pb-3 md:flex md:justify-between md:items-start text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white md:border-b"
>
    <!-- Left Section -->
    <div class="whitespace-nowrap mb-4 md:mb-0">
        <!-- Filter Actions -->
        <div class="text-sm font-normal mb-1">Filter Actions</div>
        <ButtonGroup class="me-2">
            <div
                class="text-center font-medium inline-flex items-center justify-center px-2 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 first:rounded-l-lg last:rounded-r-lg opacity-90"
            >
                <FontAwesomeIcon icon={faFilter} />
            </div>
            <Button
                size="sm"
                color="alternative"
                class="shadow-sm"
                onclick={handleSave}
            >
                Save
            </Button>
            <Button
                size="sm"
                color="alternative"
                class="shadow-sm"
                onclick={handleDelete}
            >
                Delete
            </Button>
        </ButtonGroup>
        <Tooltip placement="bottom" class="z-50 text-center">
            Store current filter locally<br />
            on your computer.
        </Tooltip>

        <!-- Alerts -->
        <div class="text-sm font-normal mb-1 mt-4">Alerts</div>
        <ButtonGroup>
            <div
                class="text-center font-medium inline-flex items-center justify-center px-2 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 first:rounded-l-lg last:rounded-r-lg opacity-90"
            >
                <FontAwesomeIcon icon={faBell} />
            </div>
            {#if alertExists}
                <AlertModal
                    bind:open={alertDialogOpen}
                    {alert}
                    {user}
                    on:success={handleAlertSuccess}
                />
                <Button
                    color="alternative"
                    size="sm"
                    id="price-alert"
                    onclick={openAlertDialog}
                >
                    Edit
                </Button>
            {:else}
                <AlertModal
                    bind:open={alertDialogOpen}
                    {alert}
                    {user}
                    on:success={handleAlertSuccess}
                />
                <Button
                    color="alternative"
                    size="sm"
                    id="price-alert"
                    onclick={openAlertDialog}
                >
                    Create
                </Button>
                <Tooltip placement="bottom" class="z-50 text-center">
                    Get a notification once your<br />
                    preferred price has been reached.
                </Tooltip>
            {/if}
        </ButtonGroup>
    </div>

    <!-- Right Section -->
    <div class="whitespace-nowrap">
        <!-- Price Display -->
        <div class="text-sm font-normal mb-1">Price Display</div>
        <ButtonGroup>
            <div
                class="text-center font-medium inline-flex items-center justify-center px-2 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 first:rounded-l-lg last:rounded-r-lg opacity-90"
            >
                <FontAwesomeIcon icon={faEuroSign} />
            </div>
            <Button
                class="px-2"
                disabled={timeUnitPrice === "perHour"}
                onclick={() => selectTimeUnit("perHour")}
            >
                Hourly
            </Button>
            <Button
                class="px-2"
                disabled={timeUnitPrice === "perMonth"}
                onclick={() => selectTimeUnit("perMonth")}
            >
                Monthly
            </Button>
        </ButtonGroup>
        <Tooltip placement="left" class="z-50">
            Display prices per hour or per month.
        </Tooltip>
    </div>
</div>
