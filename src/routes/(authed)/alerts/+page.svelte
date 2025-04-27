<script lang="ts">
    import { enhance } from "$app/forms";
    import AlertModal from "$lib/components/AlertModal.svelte";
    import { encodeFilter } from "$lib/filter";
    import { addToast } from "$lib/stores/toast";
    import {
        faFire,
        faFlagCheckered,
        faMagnifyingGlass,
        faPenToSquare,
        faTrash,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { A, Banner, Button, ButtonGroup, Spinner } from "flowbite-svelte";
    import type { PriceAlert } from "$lib/api/backend/alerts";

    import dayjs from "dayjs";
    import localizedFormat from "dayjs/plugin/localizedFormat";
    import timezone from "dayjs/plugin/timezone";
    import utc from "dayjs/plugin/utc";
    dayjs.extend(localizedFormat);
    dayjs.extend(utc);
    dayjs.extend(timezone);

    import { invalidate, invalidateAll } from "$app/navigation";
    import { MAX_ALERTS } from "$lib/api/backend/alerts.js";

    /** @type {{ data: import('./$types').PageData }} */
    export let data;

    let showEdit = false;
    let selectedAlert: PriceAlert | null = null;
</script>

<AlertModal
    bind:alert={selectedAlert}
    bind:open={showEdit}
    on:success={() => invalidateAll()}
/>

<div class="p-8 bg-gray-50 dark:bg-gray-900">
    <div class="w-full max-w-4xl mx-auto pb-8 space-y-8">
        <!-- Alerts Section -->
        <section>
            <h2
                class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6"
            >
                <FontAwesomeIcon
                    icon={faFire}
                    class="text-orange-500 w-6 h-6 mr-1"
                />
                Active Alerts
            </h2>
            <p class="pb-5 text-gray-600 dark:text-gray-300">
                All alerts that you have set up will be displayed here. Server
                Radar will continuously monitor the prices and notify you once
                the trigger price has been reached. You can edit or delete them
                at any time. New alerts can be created from existing search
                results (head over to <A href="/analyze">analyze</A>).
            </p>
            {#await data.alerts.active}
                <div class="text-center"><Spinner /></div>
            {:then active}
                <p class="pb-5 text-gray-600 dark:text-gray-300">
                    You are currently using {active.length} out of {MAX_ALERTS}
                    active alerts.
                </p>
                {#if active.length === 0}
                    <div
                        class="text-center bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm"
                    >
                        <p class="text-lg text-gray-700 dark:text-gray-300">
                            There are no active alerts.
                        </p>
                        <p class="mt-2">
                            <Button
                                href="/analyze"
                                color="primary"
                                size="sm"
                                class="shadow-sm">Create Alert</Button
                            >
                        </p>
                    </div>
                {:else}
                    <div class="space-y-4">
                        {#each active as alert}
                            <div
                                class="flex flex-col md:flex-row md:items-start p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-l-gray-300 dark:border-l-gray-700"
                            >
                                <div class="mb-4 md:mb-0 w-full md:w-1/3">
                                    <span
                                        class="block text-sm font-medium text-gray-600 dark:text-gray-400"
                                        >Name</span
                                    >
                                    <span
                                        class="text-xl font-semibold text-gray-900 dark:text-white"
                                    >
                                        {alert.name}
                                    </span>
                                </div>
                                <div class="mb-4 md:mb-0 w-full md:w-1/3">
                                    <span
                                        class="block text-sm font-medium text-gray-600 dark:text-gray-400"
                                        >Target Price</span
                                    >
                                    <div>
                                        <span
                                            class="text-xl font-semibold text-gray-900 dark:text-white"
                                        >
                                            {alert.price} €
                                        </span>
                                        <span
                                            class="block text-xs text-gray-500 dark:text-gray-400"
                                        >
                                            (incl. {alert.vat_rate}% VAT)
                                        </span>
                                    </div>
                                </div>
                                <div class="mb-4 md:mb-0 w-full md:w-1/3">
                                    <span
                                        class="block text-sm font-medium text-gray-600 dark:text-gray-400"
                                        >Created</span
                                    >
                                    <span
                                        class="text-xl font-semibold text-gray-900 dark:text-white"
                                    >
                                        {dayjs
                                            .utc(alert.created_at)
                                            .local()
                                            .format("DD.MM.YYYY HH:mm")}
                                    </span>
                                </div>
                                <div class="mt-4 md:mt-0 self-center">
                                    <ButtonGroup>
                                        <Button
                                            size="xs"
                                            href={`/analyze?filter=${encodeFilter(
                                                JSON.parse(alert.filter),
                                            )}`}
                                        >
                                            <FontAwesomeIcon
                                                icon={faMagnifyingGlass}
                                            />
                                        </Button>
                                        <Button
                                            size="xs"
                                            onclick={() => {
                                                selectedAlert = alert;
                                                showEdit = true;
                                            }}
                                        >
                                            <FontAwesomeIcon
                                                icon={faPenToSquare}
                                            />
                                        </Button>
                                        <form
                                            method="POST"
                                            action="?/delete"
                                            use:enhance={() => {
                                                addToast({
                                                    color: "green",
                                                    message:
                                                        "Alert deleted successfully.",
                                                    icon: "success",
                                                });
                                                invalidate("/alerts");
                                            }}
                                            class="inline"
                                        >
                                            <input
                                                type="hidden"
                                                name="alertId"
                                                value={alert.id}
                                            />
                                            <Button type="submit" size="xs">
                                                <FontAwesomeIcon
                                                    icon={faTrash}
                                                />
                                            </Button>
                                        </form>
                                    </ButtonGroup>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            {:catch error}
                <Banner color="red"
                    ><strong>Error:</strong> Could not load the list of alerts.</Banner
                >
            {/await}
        </section>

        <!-- Triggered Alerts Section -->
        <section>
            <h2
                class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6"
            >
                <FontAwesomeIcon
                    icon={faFlagCheckered}
                    class="text-green-500 w-6 h-6 mr-1"
                />
                Triggered Alerts
            </h2>
            <p class="pb-5 text-gray-600 dark:text-gray-300">
                Once an alert has triggered you will be notified and it will
                show up here. An alert that triggered will automatically be
                disabled and no more notifications will be sent. You can
                recreate them any time. We show the last 10 triggered alerts.
            </p>
            {#await data.alerts.triggered}
                <div class="text-center"><Spinner /></div>
            {:then triggered}
                {#if triggered.length === 0}
                    <div
                        class="text-center bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm"
                    >
                        <p class="text-lg text-gray-700 dark:text-gray-300">
                            No alerts have triggered yet.
                        </p>
                    </div>
                {:else}
                    <div class="space-y-4">
                        {#each triggered as alert}
                            <div
                                class="flex flex-col md:flex-row md:items-start p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-l-green-500"
                            >
                                <div class="mb-4 md:mb-0 w-full md:w-1/5">
                                    <span
                                        class="block text-sm font-medium text-gray-600 dark:text-gray-400"
                                        >Name</span
                                    >
                                    <span
                                        class="text-xl font-semibold text-gray-900
                                    dark:text-white whitespace-break-spaces"
                                        >{alert.name}</span
                                    >
                                </div>
                                <div class="mb-4 md:mb-0 w-full md:w-1/6">
                                    <span
                                        class="block text-sm font-medium text-gray-600 dark:text-gray-400"
                                        >Target Price</span
                                    >
                                    <div>
                                        <span
                                            class="text-xl font-semibold text-gray-900 dark:text-white"
                                            >{alert.price} €</span
                                        >
                                        <span
                                            class="block text-xs text-gray-500 dark:text-gray-400"
                                        >
                                            (incl. {alert.vat_rate}%)
                                        </span>
                                    </div>
                                </div>
                                <div class="mb-4 md:mb-0 w-full md:w-1/6">
                                    <span
                                        class="block text-sm font-medium text-gray-600 dark:text-gray-400"
                                        >Trigger Price</span
                                    >
                                    <div>
                                        <span
                                            class="text-xl font-semibold text-gray-900 dark:text-white"
                                            >{alert.trigger_price} €</span
                                        >
                                        <span
                                            class="block text-xs text-gray-500 dark:text-gray-400"
                                        >
                                            (incl. {alert.vat_rate}%)
                                        </span>
                                    </div>
                                </div>
                                <div class="mb-4 md:mb-0 w-full md:w-1/4">
                                    <span
                                        class="block text-sm font-medium text-gray-600 dark:text-gray-400"
                                        >Created</span
                                    >
                                    <span
                                        class="text-xl font-semibold text-gray-900 dark:text-white"
                                        >{dayjs
                                            .utc(alert.created_at)
                                            .local()
                                            .format("DD.MM.YYYY HH:mm")}</span
                                    >
                                </div>
                                <div class="mb-4 md:mb-0 w-full md:w-1/4">
                                    <span
                                        class="block text-sm font-medium text-gray-600 dark:text-gray-400"
                                        >Triggered</span
                                    >
                                    <span
                                        class="text-xl font-semibold text-gray-900 dark:text-white"
                                        >{dayjs
                                            .utc(alert.triggered_at)
                                            .local()
                                            .format("DD.MM.YYYY HH:mm")}</span
                                    >
                                </div>
                                <div class="mt-4 md:mt-0 self-center">
                                    <Button
                                        size="xs"
                                        color="alternative"
                                        href={`/analyze?filter=${encodeFilter(
                                            JSON.parse(alert.filter),
                                        )}`}
                                    >
                                        <FontAwesomeIcon
                                            icon={faMagnifyingGlass}
                                        />
                                    </Button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            {:catch error}
                <Banner color="red"
                    ><strong>Error:</strong> Could not load the list of alerts.</Banner
                >
            {/await}
        </section>
    </div>
</div>
