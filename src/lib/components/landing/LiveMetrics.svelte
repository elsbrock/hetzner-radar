<script lang="ts">
    import { faBell, faClock, faEnvelope, faGavel, faUsers } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { cubicOut } from "svelte/easing";
    import { tweened } from "svelte/motion";

    let { data } = $props();

    let loading = $state(true);

    // Create tweened stores for all counters
    const auctionCounter = tweened(0, {
        duration: 1000,
        easing: cubicOut,
    });
    const userCounter = tweened(0, {
        duration: 1000,
        easing: cubicOut,
    });
    const alertCounter = tweened(0, {
        duration: 1000,
        easing: cubicOut,
    });
    const historyCounter = tweened(0, {
        duration: 1000,
        easing: cubicOut,
    });
    const latestBatchCounter = tweened(0, {
        duration: 1000,
        easing: cubicOut,
    });

    // Shake Animation Logic
    const NUM_ICONS = 5;
    const SHAKE_INTERVAL = 5000;
    const SHAKE_DELAY = 150;
    const SHAKE_DURATION = 500;

    let shakingIconIndex = $state(-1);

    $effect(() => {
        let intervalId: ReturnType<typeof setInterval> | undefined;
        let timeoutIds: ReturnType<typeof setTimeout>[] = [];

        const startSequence = () => {
            timeoutIds.forEach(clearTimeout);
            timeoutIds = [];
            shakingIconIndex = -1;

            for (let i = 0; i < NUM_ICONS; i++) {
                const startTimeoutId = setTimeout(() => {
                    shakingIconIndex = i;
                }, i * SHAKE_DELAY);
                timeoutIds.push(startTimeoutId);

                const stopTimeoutId = setTimeout(
                    () => {
                        if (shakingIconIndex === i) {
                            shakingIconIndex = -1;
                        }
                    },
                    i * SHAKE_DELAY + SHAKE_DURATION,
                );
                timeoutIds.push(stopTimeoutId);
            }
        };

        startSequence();
        intervalId = setInterval(startSequence, SHAKE_INTERVAL);

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
            timeoutIds.forEach(clearTimeout);
        };
    });

    // Handle data changes in Svelte 5 runes mode
    $effect(() => {
        if (data) {
            auctionCounter.set(data.auctionStats ?? 0);
            userCounter.set(data.userStats ?? 0);
            alertCounter.set(data.alertStats ?? 0);
            historyCounter.set(data.historyStats ?? 0);
            latestBatchCounter.set(data.latestBatchStats ?? 0);
            loading = false;
        }
    });
</script>

<section class="mx-auto mb-16 max-w-7xl">
    <div
        class="mx-auto max-w-7xl flex flex-col sm:flex-row flex-wrap gap-y-8 gap-x-4 items-center justify-around"
    >
        <!-- Auctions Tracked -->
        <div
            data-testid="glance-auctions-tracked"
            class="flex flex-col items-center text-center px-4"
        >
            {#if loading}
                <div
                    class="flex items-center justify-center gap-3 mb-2 h-10"
                >
                    <div
                        class="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                    <div
                        class="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                </div>
                <div
                    class="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                ></div>
            {:else}
                <div class="flex items-center justify-center gap-3 mb-2">
                    <FontAwesomeIcon
                        icon={faGavel}
                        class="w-6 h-6 text-orange-500 {shakingIconIndex ===
                        0
                            ? 'subtle-bounce-it'
                            : ''}"
                    />
                    <p
                        class="text-4xl font-semibold text-gray-700 dark:text-gray-200 tracking-tight leading-tight antialiased"
                    >
                        {Math.round($auctionCounter).toLocaleString()}
                    </p>
                </div>
                <span
                    class="text-base text-gray-500 dark:text-gray-400 antialiased"
                    >Total Auctions Tracked</span
                >
            {/if}
        </div>

        <!-- Auctions in Last Batch -->
        <div
            data-testid="glance-last-batch"
            class="flex flex-col items-center text-center px-4"
        >
            {#if loading}
                <div
                    class="flex items-center justify-center gap-3 mb-2 h-10"
                >
                    <div
                        class="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                    <div
                        class="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                </div>
                <div
                    class="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                ></div>
            {:else}
                <div class="flex items-center justify-center gap-3 mb-2">
                    <FontAwesomeIcon
                        icon={faClock}
                        class="w-6 h-6 text-orange-500 {shakingIconIndex ===
                        1
                            ? 'subtle-bounce-it'
                            : ''}"
                    />
                    <p
                        class="text-4xl font-semibold text-gray-700 dark:text-gray-200 tracking-tight leading-tight antialiased"
                    >
                        {Math.round($latestBatchCounter).toLocaleString()}
                    </p>
                </div>
                <span
                    class="text-base text-gray-500 dark:text-gray-400 antialiased"
                    >Auctions in Last Batch</span
                >
            {/if}
        </div>

        <!-- Active Users -->
        <div
            data-testid="glance-active-users"
            class="flex flex-col items-center text-center px-4"
        >
            {#if loading}
                <div
                    class="flex items-center justify-center gap-3 mb-2 h-10"
                >
                    <div
                        class="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                    <div
                        class="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                </div>
                <div
                    class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                ></div>
            {:else}
                <div class="flex items-center justify-center gap-3 mb-2">
                    <FontAwesomeIcon
                        icon={faUsers}
                        class="w-6 h-6 text-orange-500 {shakingIconIndex ===
                        2
                            ? 'subtle-bounce-it'
                            : ''}"
                    />
                    <p
                        class="text-4xl font-semibold text-gray-700 dark:text-gray-200 tracking-tight leading-tight antialiased"
                    >
                        {Math.round($userCounter).toLocaleString()}
                    </p>
                </div>
                <span
                    class="text-base text-gray-500 dark:text-gray-400 antialiased"
                    >Active Users</span
                >
            {/if}
        </div>

        <!-- Active Alerts -->
        <div
            data-testid="glance-active-alerts"
            class="flex flex-col items-center text-center px-4"
        >
            {#if loading}
                <div
                    class="flex items-center justify-center gap-3 mb-2 h-10"
                >
                    <div
                        class="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                    <div
                        class="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                </div>
                <div
                    class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                ></div>
            {:else}
                <div class="flex items-center justify-center gap-3 mb-2">
                    <FontAwesomeIcon
                        icon={faBell}
                        class="w-6 h-6 text-orange-500 {shakingIconIndex ===
                        3
                            ? 'subtle-bounce-it'
                            : ''}"
                    />
                    <p
                        class="text-4xl font-semibold text-gray-700 dark:text-gray-200 tracking-tight leading-tight antialiased"
                    >
                        {Math.round($alertCounter).toLocaleString()}
                    </p>
                </div>
                <span
                    class="text-base text-gray-500 dark:text-gray-400 antialiased"
                    >Active Alerts</span
                >
            {/if}
        </div>

        <!-- Notifications sent -->
        <div
            data-testid="glance-notifications-sent"
            class="flex flex-col items-center text-center px-4"
        >
            {#if loading}
                <div
                    class="flex items-center justify-center gap-3 mb-2 h-10"
                >
                    <div
                        class="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                    <div
                        class="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                </div>
                <div
                    class="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                ></div>
            {:else}
                <div class="flex items-center justify-center gap-3 mb-2">
                    <FontAwesomeIcon
                        icon={faEnvelope}
                        class="w-6 h-6 text-orange-500 {shakingIconIndex ===
                        4
                            ? 'subtle-bounce-it'
                            : ''}"
                    />
                    <p
                        class="text-4xl font-semibold text-gray-700 dark:text-gray-200 tracking-tight leading-tight antialiased"
                    >
                        {Math.round($historyCounter).toLocaleString()}
                    </p>
                </div>
                <span
                    class="text-base text-gray-500 dark:text-gray-400 antialiased"
                    >Notifications Sent</span
                >
            {/if}
        </div>
    </div>
</section>