<script lang="ts">
    import { reloadDB } from "$lib/api/frontend/dbapi";
    import { faRefresh } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import dayjs from "dayjs";
    import { Alert, Button, Spinner } from "flowbite-svelte";
    import { onDestroy } from "svelte";
    import { db } from "../../stores/db";

    export let lastUpdate: number;
    export let threshold = 60 * 65; // in seconds

    let reloading = false;
    let showElement = false;
    let timer: any;

    $: if (lastUpdate) {
        const now = dayjs();
        const lastUpdateDate = dayjs(lastUpdate * 1000);
        console.log("last update", lastUpdateDate);
        const elapsedSeconds = now.diff(lastUpdateDate, "second");
        console.log("elapsed seconds", elapsedSeconds);
        const remainingTime = threshold - elapsedSeconds;
        console.log("remaining time", remainingTime);

        if (elapsedSeconds > threshold) {
            showElement = true;
        } else {
            timer = setTimeout(() => {
                showElement = true;
            }, remainingTime * 1000);
        }
    }

    onDestroy(() => {
        if (timer) {
            clearTimeout(timer);
        }
    });
</script>

{#if showElement}
    <Alert
        class="border-b border-x border-x-orange-200 rounded-none text-center py-5"
    >
        <p class="pb-3">Newer data is available.</p>
        <Button
            color="primary"
            size="xs"
            disabled={reloading}
            on:click={async () => {
                reloading = true;
                await reloadDB($db);
                $db = $db;
                showElement = false;
                reloading = false;
            }}
        >
            {#if reloading}
                <Spinner size="4" class="me-2" />
            {:else}
                <FontAwesomeIcon icon={faRefresh} class="me-2 w-4 h-4" />
            {/if}
            Refresh Database</Button
        >
    </Alert>
{/if}
