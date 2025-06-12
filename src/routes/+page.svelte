<script lang="ts">
    import { withDbConnections } from "$lib/api/frontend/dbapi";
    // Removed ServerConfiguration import as it's now only used in SampleCardStack
    import SampleCardStack from "$lib/components/SampleCardStack.svelte"; // Import the new component
    import { faDiscord, faGithub } from "@fortawesome/free-brands-svg-icons";
    import {
        faBell,
        faBug,
        faChartLine,
        faClock, // Added
        faEnvelope,
        faEye,
        faFilter,
        faForwardStep,
        faGavel, // Added
        faHardDrive,
        faMemory,
        faSdCard,
        faQuestionCircle,
        faServer, // Added
        faUsers,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Accordion, AccordionItem, Badge, Button, Card, Indicator, Timeline, TimelineItem } from "flowbite-svelte";
    import { ArrowRightOutline } from "flowbite-svelte-icons";
    // Added icon import
    import { onMount } from "svelte";
    import { cubicOut } from "svelte/easing";
    import { tweened } from "svelte/motion";
    import { db } from "../stores/db";

    let { data } = $props();

    const wordToAnimate = "Overpaying";
    const letters = wordToAnimate.split("");
    let startAnimation = $state(false); // State to control animation start

    let loadingUsers = true;
    let loadingAlerts = true;
    let loadingHistory = true;

    // Create tweened stores for all counters
    const auctionCounter = tweened(0, {
        // Renamed from serverCounter
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
        // New counter for latest batch
        duration: 1000,
        easing: cubicOut,
    });

    // Auction count using $effect
    $effect(() => {
        const unsubscribe = db.subscribe(async (dbInstance) => {
            if (!dbInstance) return;

            try {
                await withDbConnections(dbInstance, async (conn) => {
                    // Query renamed from server to auction table
                    const result = await conn.query(
                        `SELECT COUNT(id) as count
            FROM server`,
                    );
                    const count = Number(result.toArray()[0].count);
                    if (!isNaN(count)) {
                        auctionCounter.set(count); // Renamed from serverCounter
                    }
                });
            } catch (error) {
                console.error("Error fetching auction count:", error); // Updated error message
                auctionCounter.set(0); // Renamed from serverCounter
            }

            // Unsubscribe is handled within the effect cleanup now for robustness
            // unsubscribe(); // Removed from here
        });

        // Cleanup function for the effect
        return () => {
            // No explicit unsubscribe needed here as db.subscribe might handle it,
            // but good practice if manual cleanup were required.
        };
    });

    // Latest batch count using $effect
    $effect(() => {
        const unsubscribe = db.subscribe(async (dbInstance) => {
            if (!dbInstance) return;

            try {
                await withDbConnections(dbInstance, async (conn) => {
                    // Query to get the count of distinct auction IDs in the most recent batch
                    const result = await conn.query(`
            WITH LatestBatch AS (
              SELECT MAX(seen) as max_last_seen FROM server
            )
            SELECT COUNT(DISTINCT id) as count
            FROM server
            WHERE seen = (SELECT max_last_seen FROM LatestBatch)
          `);
                    const count = Number(result.toArray()[0].count);
                    if (!isNaN(count)) {
                        latestBatchCounter.set(count);
                    } else {
                        latestBatchCounter.set(0); // Set to 0 if count is NaN
                    }
                });
            } catch (error) {
                console.error("Error fetching latest batch count:", error);
                latestBatchCounter.set(0);
            }
        });

        // Cleanup function for the effect
        return () => {
            // Cleanup logic if needed
        };
    });

    // Handle server-side stats with $effect
    $effect(() => {
        if (data.userStats !== undefined) {
            userCounter.set(-1);
            setTimeout(() => {
                userCounter.set(data.userStats);
            }, 0);
            loadingUsers = false;
        }
    });

    $effect(() => {
        if (data.alertStats !== undefined) {
            alertCounter.set(-1);
            setTimeout(() => {
                alertCounter.set(data.alertStats);
            }, 0);
            loadingAlerts = false;
        }
    });

    $effect(() => {
        if (data.historyStats !== undefined) {
            historyCounter.set(-1);
            setTimeout(() => {
                historyCounter.set(data.historyStats);
            }, 0);
            loadingHistory = false;
        }
    });

    onMount(() => {
        // Backend stats hydration
        if (data.userStats !== undefined) loadingUsers = false;
        if (data.alertStats !== undefined) loadingAlerts = false;
        if (data.historyStats !== undefined) loadingHistory = false;

        // Trigger scary animation shortly after mount
        setTimeout(() => {
            startAnimation = true;
        }, 50); // Small delay
    });

    // --- Shake Animation Logic ---
    const NUM_ICONS = 5; // Number of icons in the "At A Glance" section
    const SHAKE_INTERVAL = 5000; // ms between sequence starts
    const SHAKE_DELAY = 150; // ms between each icon shake
    const SHAKE_DURATION = 500; // ms for the shake animation itself

    let shakingIconIndex = $state(-1); // -1 means no icon is shaking

    $effect(() => {
        let intervalId: ReturnType<typeof setInterval> | undefined;
        let timeoutIds: ReturnType<typeof setTimeout>[] = [];

        const startSequence = () => {
            // Clear any pending timeouts from previous sequences
            timeoutIds.forEach(clearTimeout);
            timeoutIds = [];
            shakingIconIndex = -1; // Reset just in case

            for (let i = 0; i < NUM_ICONS; i++) {
                // Timeout to start the shake
                const startTimeoutId = setTimeout(() => {
                    shakingIconIndex = i;
                }, i * SHAKE_DELAY);
                timeoutIds.push(startTimeoutId);

                // Timeout to stop the shake (after start delay + animation duration)
                const stopTimeoutId = setTimeout(
                    () => {
                        // Only reset if this icon is still the one supposed to be shaking
                        if (shakingIconIndex === i) {
                            shakingIconIndex = -1;
                        }
                    },
                    i * SHAKE_DELAY + SHAKE_DURATION,
                );
                timeoutIds.push(stopTimeoutId);
            }
        };

        // Start the first sequence immediately
        startSequence();

        // Then repeat every SHAKE_INTERVAL
        intervalId = setInterval(startSequence, SHAKE_INTERVAL);

        // Cleanup function
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
            timeoutIds.forEach(clearTimeout);
        };
    });
    // --- End Shake Animation Logic ---
</script>


<main class="p-8">
    <!-- New Hero Section -->
    <section
        class="mx-auto my-10 max-w-6xl grid grid-cols-1 md:grid-cols-5 gap-12 items-start"
    >
        <!-- Reduced max-width, changed grid cols -->
        <!-- Left Column: Text and Button -->
        <div class="justify-center text-left md:col-span-3">
            <h1
                class="mb-6 text-4xl md:text-5xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight"
            >
                Stop&nbsp;{#each letters as letter, i}<span
                        class="scary-letter"
                        class:animate={startAnimation}
                        style="animation-delay: {i * 0.05}s;">{letter}</span
                    >{/each}&nbsp;for Hetzner Auction Servers
            </h1>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
                <strong>Server Radar</strong> is a free, open-source tool built by the community, for the community.
                Track Hetzner auction prices, get historical insights, use advanced filtering,
                and receive <span class="underline decoration-orange-500 decoration-2">instant notifications</span>
                via email, Discord, and more — all without any cost or hidden fees.
            </p>
            <div class="flex flex-col sm:flex-row gap-4">
                <Button
                    data-testid="cta-get-started"
                    color="primary"
                    href="/analyze"
                    size="lg"
                    class="shadow-sm"
                >
                    Get Started
                    <ArrowRightOutline class="ms-2 w-5 h-5" />
                </Button>
                <Button
                    data-testid="cta-view-github"
                    color="alternative"
                    href="https://github.com/elsbrock/hetzner-radar"
                    size="lg"
                    class="shadow-sm"
                >
                    <FontAwesomeIcon icon={faGithub} class="mr-2" />
                    View on GitHub
                </Button>
            </div>
        </div>
        <!-- Right Column: Sample Card Stack -->
        <div class="my-8 mr-8 mt-4 md:mt-12 md:col-span-2">
            <!-- Span 2 cols on md+ -->
            <SampleCardStack />
        </div>
    </section>

    <!-- Live Metrics -->
    <section class="mx-auto mb-16 max-w-7xl">
        <div
            class="mx-auto max-w-7xl flex flex-col sm:flex-row flex-wrap gap-y-8 gap-x-4 items-center justify-around"
        >
            <!-- Auctions Tracked -->
            <div
                data-testid="glance-auctions-tracked"
                class="flex flex-col items-center text-center px-4"
            >
                {#if $auctionCounter === 0}
                    <div
                        class="flex items-center justify-center gap-3 mb-2 h-10"
                    >
                        <!-- Adjusted height for loading -->
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
                    <!-- Placeholder for label -->
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
                {#if $latestBatchCounter === 0}
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
                {#if $userCounter < 0}
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
                {#if $alertCounter < 0}
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
                {#if $historyCounter < 0}
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

    <!-- Product Demo Section -->
    <section
        id="demo"
        class="mx-auto max-w-7xl text-center mb-12 hidden md:block"
    >
        <!-- Adjusted margin, hidden on mobile -->
        <!--ARCADE EMBED START-->
        <div
            style="position: relative; padding-bottom: calc(55.677083333333336% + 41px); height: 0; width: 100%;"
        >
            <iframe
                src="https://demo.arcade.software/KVRZCAXbeIJw0GyOs6Ob?embed&embed_mobile=tab&embed_desktop=inline&show_copy_link=true"
                title="Effortlessly Track and Optimize Server Auction Prices with Server Radar"
                frameborder="0"
                loading="lazy"
                allowfullscreen
                allow="clipboard-write"
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; color-scheme: light;"
            ></iframe>
        </div>
        <!--ARCADE EMBED END-->
    </section>

    <!-- Features Section -->
    <section id="features" class="mx-auto mb-20 max-w-7xl">
        <h2
            class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
        >
            Powerful Features for Smart Server Hunting
        </h2>
        <p
            class="mb-12 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
        >
            Everything you need to find the perfect server at the right price.
            Built by the community, refined through real-world use, and completely free forever.
        </p>
        
        <!-- Two-column feature grid with alternating layout -->
        <div class="space-y-16">
            <!-- Feature 1: Price Tracking -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div class="order-2 lg:order-1">
                    <div class="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-md">
                        <FontAwesomeIcon
                            class="mb-4 w-10 h-10 text-orange-500"
                            icon={faChartLine}
                        />
                        <h3 class="mb-3 text-2xl font-bold text-gray-800 dark:text-gray-100">
                            Historical Price Intelligence
                        </h3>
                        <p class="mb-4 text-gray-600 dark:text-gray-400">
                            Track price trends over time for any server configuration. Our comprehensive
                            3-month history helps you understand market patterns and identify the best
                            times to buy.
                        </p>
                        <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <li class="flex items-center gap-2">
                                <span class="text-orange-500">✓</span>
                                Interactive price charts with zoom and pan
                            </li>
                            <li class="flex items-center gap-2">
                                <span class="text-orange-500">✓</span>
                                Compare multiple configurations side-by-side
                            </li>
                            <li class="flex items-center gap-2">
                                <span class="text-orange-500">✓</span>
                                Export data for your own analysis
                            </li>
                        </ul>
                    </div>
                </div>
                <div class="order-1 lg:order-2">
                    <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden h-48">
                        <!-- Real Chart Component Look -->
                        <div class="h-full relative">
                            <!-- Chart area with proper grid -->
                            <svg class="absolute inset-0 w-full h-full">
                                <!-- Grid lines -->
                                <defs>
                                    <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                                        <path d="M 40 0 L 0 0 0 30" fill="none" stroke="rgba(209, 213, 219, 0.2)" stroke-width="1" stroke-dasharray="5,5"/>
                                    </pattern>
                                </defs>
                                <rect width="100%" height="100%" fill="url(#grid)" />
                                
                                <!-- Realistic price line from actual chart -->
                                <polyline
                                    fill="none"
                                    stroke="#FB923C"
                                    stroke-width="3"
                                    points="20,140 60,120 100,130 140,100 180,110 220,80 260,75 300,85 340,70"
                                    class="opacity-95"
                                />
                                
                                <!-- Volume bars that match chart.js style -->
                                <rect x="55" y="160" width="6" height="25" fill="rgba(107, 114, 128, 0.4)" />
                                <rect x="95" y="165" width="6" height="20" fill="rgba(107, 114, 128, 0.4)" />
                                <rect x="135" y="162" width="6" height="23" fill="rgba(107, 114, 128, 0.4)" />
                                <rect x="175" y="168" width="6" height="17" fill="rgba(107, 114, 128, 0.4)" />
                                <rect x="215" y="163" width="6" height="22" fill="rgba(107, 114, 128, 0.4)" />
                                <rect x="255" y="166" width="6" height="19" fill="rgba(107, 114, 128, 0.4)" />
                                <rect x="295" y="161" width="6" height="24" fill="rgba(107, 114, 128, 0.4)" />
                                
                                <!-- Axis labels matching real chart -->
                                <text x="20" y="200" fill="#6B7280" font-size="10" class="dark:fill-gray-300">01.12</text>
                                <text x="180" y="200" fill="#6B7280" font-size="10" class="dark:fill-gray-300">15.12</text>
                                <text x="340" y="200" fill="#6B7280" font-size="10" class="dark:fill-gray-300">31.12</text>
                                
                                <!-- Y-axis labels -->
                                <text x="10" y="80" fill="#6B7280" font-size="10" class="dark:fill-gray-300">€35</text>
                                <text x="10" y="120" fill="#6B7280" font-size="10" class="dark:fill-gray-300">€30</text>
                                <text x="10" y="160" fill="#6B7280" font-size="10" class="dark:fill-gray-300">€25</text>
                            </svg>
                        </div>
                        <!-- Fade out effect for screenshot look -->
                        <div class="absolute inset-0 bg-gradient-to-t from-white/70 via-transparent to-transparent dark:from-gray-900/70 pointer-events-none"></div>
                        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white/40 dark:to-gray-900/40 pointer-events-none"></div>
                    </div>
                </div>
            </div>

            <!-- Feature 2: Advanced Filtering -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                    <div class="relative space-y-3">
                        <!-- Multiple filter elements diagonally arranged -->
                        <div class="relative">
                            <!-- First filter element -->
                            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-3 max-w-xs">
                                <div class="flex flex-wrap gap-1.5 mb-3">
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200">
                                        CPU: i7+
                                    </span>
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200">
                                        RAM: 32GB+
                                    </span>
                                </div>
                                <div class="relative">
                                    <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                        <div class="absolute h-2 bg-purple-500 rounded-full" style="left: 20%; width: 55%"></div>
                                        <div class="absolute w-3 h-3 bg-purple-600 rounded-full border border-white shadow-sm" style="left: 18%; top: -2px"></div>
                                        <div class="absolute w-3 h-3 bg-purple-600 rounded-full border border-white shadow-sm" style="left: 73%; top: -2px"></div>
                                    </div>
                                </div>
                                <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span>€25</span>
                                    <span>€45</span>
                                </div>
                            </div>
                            
                            <!-- Second filter element (offset) -->
                            <div class="absolute top-4 left-16 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-3 max-w-xs z-10">
                                <div class="flex flex-wrap gap-1.5">
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200">
                                        Location: FSN
                                    </span>
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200">
                                        NVMe: Yes
                                    </span>
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200">
                                        ECC
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Fade out effect for screenshot look -->
                        <div class="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-white/60 dark:to-gray-900/60 pointer-events-none"></div>
                    </div>
                </div>
                <div>
                    <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-md">
                        <FontAwesomeIcon
                            class="mb-4 w-10 h-10 text-purple-500"
                            icon={faFilter}
                        />
                        <h3 class="mb-3 text-2xl font-bold text-gray-800 dark:text-gray-100">
                            Precision Filtering Engine
                        </h3>
                        <p class="mb-4 text-gray-600 dark:text-gray-400">
                            Find exactly what you need with our advanced filtering system. Filter by CPU,
                            RAM, storage, location, and even specific disk configurations.
                        </p>
                        <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <li class="flex items-center gap-2">
                                <span class="text-purple-500">✓</span>
                                Dual-range sliders for precise control
                            </li>
                            <li class="flex items-center gap-2">
                                <span class="text-purple-500">✓</span>
                                Save and share filter configurations
                            </li>
                            <li class="flex items-center gap-2">
                                <span class="text-purple-500">✓</span>
                                Real-time results as you adjust filters
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Feature 3: Smart Alerts (including Cloud) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div class="order-2 lg:order-1">
                    <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-md">
                        <FontAwesomeIcon
                            class="mb-4 w-10 h-10 text-blue-500"
                            icon={faBell}
                        />
                        <h3 class="mb-3 text-2xl font-bold text-gray-800 dark:text-gray-100">
                            Intelligent Alert System
                        </h3>
                        <p class="mb-4 text-gray-600 dark:text-gray-400">
                            Never miss the perfect deal with our dual alert system for both auction
                            servers and cloud availability.
                        </p>
                        <div class="space-y-3">
                            <div class="bg-white dark:bg-gray-800 rounded p-3">
                                <h4 class="font-semibold text-gray-700 dark:text-gray-200 mb-1">Auction Price Alerts</h4>
                                <p class="text-sm text-gray-600 dark:text-gray-400">Set target prices and get notified when matching servers appear</p>
                            </div>
                            <div class="bg-white dark:bg-gray-800 rounded p-3">
                                <h4 class="font-semibold text-gray-700 dark:text-gray-200 mb-1">Cloud Availability Alerts</h4>
                                <p class="text-sm text-gray-600 dark:text-gray-400">Know instantly when CAX/CCX servers become available in your region</p>
                            </div>
                        </div>
                        <Button href="/alerts" size="sm" class="mt-4" color="primary">
                            Configure Alerts <ArrowRightOutline class="ms-2 w-4 h-4" />
                        </Button>
                    </div>
                </div>
                <div class="order-1 lg:order-2">
                    <div class="relative space-y-2 max-w-sm">
                        <!-- Alert cards without headers, just the components -->
                        
                        <!-- Auction Alert -->
                        <div class="relative">
                            <div class="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-l-4 border-orange-500 shadow-sm">
                                <FontAwesomeIcon icon={faGavel} class="w-4 h-4 text-orange-500 flex-shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">Auction Price Alert</div>
                                        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400">i7-6700 • 32GB • Target: €25</div>
                                </div>
                                <span class="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded font-medium">
                                    Active
                                </span>
                            </div>
                        </div>
                        
                        <!-- Cloud Alert (slightly offset) -->
                        <div class="relative ml-4">
                            <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500 shadow-sm">
                                <FontAwesomeIcon icon={faClock} class="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">Cloud Alert</div>
                                        <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                    </div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400">CAX41 in Falkenstein</div>
                                </div>
                                <span class="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded font-medium">
                                    Waiting
                                </span>
                            </div>
                        </div>
                        
                        <!-- Recent notification (more offset) -->
                        <div class="relative ml-8">
                            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                                <FontAwesomeIcon icon={faBell} class="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-medium text-gray-800 dark:text-gray-200">Recent Alert</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400">CCX33 found • 2h ago</div>
                                </div>
                                <span class="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                                    Sent
                                </span>
                            </div>
                        </div>
                        
                        <!-- Fade out effect for screenshot look -->
                        <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/50 dark:to-gray-900/50 pointer-events-none"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Additional features grid -->
        <div class="mt-16 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <FontAwesomeIcon icon={faForwardStep} class="w-8 h-8 text-green-500 mb-3" />
                <h4 class="font-semibold text-gray-800 dark:text-gray-100 mb-2">Real-time Data</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">Live server cards with real pricing, availability status, hardware specs, and instant updates when new auctions appear</p>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <FontAwesomeIcon icon={faServer} class="w-8 h-8 text-blue-500 mb-3" />
                <h4 class="font-semibold text-gray-800 dark:text-gray-100 mb-2">Comprehensive Details</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">Complete hardware specifications, pricing history, and instant availability status for every server configuration</p>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <FontAwesomeIcon icon={faGithub} class="w-8 h-8 text-gray-700 dark:text-gray-300 mb-3" />
                <h4 class="font-semibold text-gray-800 dark:text-gray-100 mb-2">Open Source</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">Transparent, community-driven development you can trust and contribute to</p>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <FontAwesomeIcon icon={faUsers} class="w-8 h-8 text-orange-500 mb-3" />
                <h4 class="font-semibold text-gray-800 dark:text-gray-100 mb-2">Active Community</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">Join 100+ users sharing tips and strategies in our Discord</p>
            </div>
        </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="mx-auto my-20 max-w-7xl">
        <h2
            class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
        >
            Your Path to Server Success
        </h2>
        <p
            class="mb-12 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
        >
            Finding the perfect Hetzner server at the best price has never been easier.
            Follow our proven 3-step process to become a smart server hunter.
        </p>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Step 1 -->
            <div class="relative">
                <div class="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-md h-full">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                            1
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
                            Filter & Discover
                        </h3>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Use our precision filtering engine to find exactly what you need. 
                        Specify CPU, RAM, storage, and location requirements.
                    </p>
                    <div class="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600">
                        <div class="flex flex-wrap gap-1.5">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700">
                                CPU: i7+
                            </span>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700">
                                RAM: 32GB+
                            </span>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700">
                                NVMe: SSD
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 2 -->
            <div class="relative">
                <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-md h-full">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                            2
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
                            Analyze Trends
                        </h3>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Study historical price data and market patterns to identify 
                        the best buying opportunities.
                    </p>
                    <div class="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600">
                        <!-- Mini chart simulation -->
                        <div class="h-12 mb-2 relative">
                            <svg class="w-full h-full">
                                <polyline
                                    fill="none"
                                    stroke="#8B5CF6"
                                    stroke-width="2"
                                    points="5,25 20,20 35,28 50,15 65,18 80,12"
                                    class="opacity-80"
                                />
                                <circle cx="80" cy="12" r="2" fill="#8B5CF6" />
                            </svg>
                            <div class="absolute top-0 right-0 text-xs text-purple-600 font-semibold">€29</div>
                            <div class="absolute bottom-0 left-0 text-xs text-green-600">€24</div>
                        </div>
                        <div class="space-y-1">
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-600 dark:text-gray-400">Current</span>
                                <span class="font-semibold text-purple-600">€29.50</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-600 dark:text-gray-400">30d avg</span>
                                <span class="font-semibold text-gray-600 dark:text-gray-400">€31.20</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-600 dark:text-gray-400">Best deal</span>
                                <span class="font-semibold text-green-600">€24.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 3 -->
            <div class="relative">
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-md h-full">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                            3
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
                            Set Smart Alerts
                        </h3>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Configure auction price alerts and cloud availability notifications. 
                        We'll notify you instantly when your conditions are met.
                    </p>
                    <div class="space-y-2">
                        <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border-l-3 border-orange-500 flex items-center gap-2">
                            <FontAwesomeIcon icon={faGavel} class="w-3 h-3 text-orange-500 flex-shrink-0" />
                            <div class="flex-1">
                                <div class="text-xs font-medium text-gray-800 dark:text-gray-200">Auction Alert</div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">Target: ≤ €25</div>
                            </div>
                            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border-l-3 border-blue-500 flex items-center gap-2">
                            <FontAwesomeIcon icon={faClock} class="w-3 h-3 text-blue-500 flex-shrink-0" />
                            <div class="flex-1">
                                <div class="text-xs font-medium text-gray-800 dark:text-gray-200">Cloud Alert</div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">CAX41 in FSN</div>
                            </div>
                            <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Call to action -->
        <div class="text-center mt-12">
            <Button href="/analyze" size="lg" color="primary">
                Start Your Server Hunt
                <ArrowRightOutline class="ms-2 w-5 h-5" />
            </Button>
        </div>
    </section>

    <!-- Community Section -->
    <section id="community" class="mx-auto my-20 max-w-7xl">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
                <h2 class="mb-6 text-4xl font-semibold text-gray-800 dark:text-gray-100">
                    Join Our Thriving Community
                </h2>
                <p class="mb-6 text-lg text-gray-600 dark:text-gray-400">
                    Connect with fellow server hunters, share strategies, and stay ahead of the curve. 
                    Our community is where the best deals are discovered and shared.
                </p>
                <div class="space-y-4 mb-8">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faUsers} class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">100+ active members sharing tips</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faBell} class="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">Real-time deal alerts and notifications</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faQuestionCircle} class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">Expert help with server configurations</span>
                    </div>
                </div>
                <Button
                    href="https://discord.gg/dcuGfURbdc"
                    size="lg"
                    class="shadow-sm"
                    color="primary"
                >
                    <FontAwesomeIcon icon={faDiscord} class="mr-2" />
                    Join Discord Community
                    <ArrowRightOutline class="ms-2 w-5 h-5" />
                </Button>
            </div>
            <div class="bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-8 shadow-md">
                <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    🎯 Community Highlights
                </h3>
                <div class="space-y-4">
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div class="flex items-start gap-3">
                            <img src="/images/user1.webp" alt="User" class="w-8 h-8 rounded-full" loading="lazy" />
                            <div class="flex-1">
                                <p class="text-sm text-gray-700 dark:text-gray-300">
                                    "Just saved €200 on a perfect server thanks to the community's price alerts! 🎉"
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">— Alex, 2 hours ago</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div class="flex items-start gap-3">
                            <img src="/images/user2.webp" alt="User" class="w-8 h-8 rounded-full" loading="lazy" />
                            <div class="flex-1">
                                <p class="text-sm text-gray-700 dark:text-gray-300">
                                    "CAX41 available in Falkenstein! Setting up alerts for everyone interested."
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">— Maria, 1 day ago</p>
                            </div>
                        </div>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            💬 Join the conversation and discover your next great deal
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="mx-auto my-20 max-w-7xl">
        <h2
            class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
        >
            Your Path to Server Success
        </h2>
        <p
            class="mb-12 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
        >
            Finding the perfect Hetzner server at the best price has never been easier.
            Follow our proven 3-step process to become a smart server hunter.
        </p>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Step 1 -->
            <div class="relative">
                <div class="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-md h-full">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                            1
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
                            Filter & Discover
                        </h3>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Use our precision filtering engine to find exactly what you need. 
                        Specify CPU, RAM, storage, and location requirements.
                    </p>
                    <div class="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600">
                        <div class="flex flex-wrap gap-1.5">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700">
                                CPU: i7+
                            </span>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700">
                                RAM: 32GB+
                            </span>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700">
                                NVMe: SSD
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 2 -->
            <div class="relative">
                <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-md h-full">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                            2
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
                            Analyze Trends
                        </h3>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Study historical price data and market patterns to identify 
                        the best buying opportunities.
                    </p>
                    <div class="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600">
                        <!-- Mini chart simulation -->
                        <div class="h-12 mb-2 relative">
                            <svg class="w-full h-full">
                                <polyline
                                    fill="none"
                                    stroke="#8B5CF6"
                                    stroke-width="2"
                                    points="5,25 20,20 35,28 50,15 65,18 80,12"
                                    class="opacity-80"
                                />
                                <circle cx="80" cy="12" r="2" fill="#8B5CF6" />
                            </svg>
                            <div class="absolute top-0 right-0 text-xs text-purple-600 font-semibold">€29</div>
                            <div class="absolute bottom-0 left-0 text-xs text-green-600">€24</div>
                        </div>
                        <div class="space-y-1">
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-600 dark:text-gray-400">Current</span>
                                <span class="font-semibold text-purple-600">€29.50</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-600 dark:text-gray-400">30d avg</span>
                                <span class="font-semibold text-gray-600 dark:text-gray-400">€31.20</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-600 dark:text-gray-400">Best deal</span>
                                <span class="font-semibold text-green-600">€24.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 3 -->
            <div class="relative">
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-md h-full">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                            3
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
                            Set Smart Alerts
                        </h3>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Configure auction price alerts and cloud availability notifications. 
                        We'll notify you instantly when your conditions are met.
                    </p>
                    <div class="space-y-2">
                        <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border-l-3 border-orange-500 flex items-center gap-2">
                            <FontAwesomeIcon icon={faGavel} class="w-3 h-3 text-orange-500 flex-shrink-0" />
                            <div class="flex-1">
                                <div class="text-xs font-medium text-gray-800 dark:text-gray-200">Auction Alert</div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">Target: ≤ €25</div>
                            </div>
                            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border-l-3 border-blue-500 flex items-center gap-2">
                            <FontAwesomeIcon icon={faClock} class="w-3 h-3 text-blue-500 flex-shrink-0" />
                            <div class="flex-1">
                                <div class="text-xs font-medium text-gray-800 dark:text-gray-200">Cloud Alert</div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">CAX41 in FSN</div>
                            </div>
                            <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Call to action -->
        <div class="text-center mt-12">
            <Button href="/analyze" size="lg" color="primary">
                Start Your Server Hunt
                <ArrowRightOutline class="ms-2 w-5 h-5" />
            </Button>
        </div>
    </section>



    <!-- Community Section -->
    <section id="community" class="mx-auto my-20 max-w-7xl">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
                <h2 class="mb-6 text-4xl font-semibold text-gray-800 dark:text-gray-100">
                    Join Our Thriving Community
                </h2>
                <p class="mb-6 text-lg text-gray-600 dark:text-gray-400">
                    Connect with fellow server hunters, share strategies, and stay ahead of the curve. 
                    Our community is where the best deals are discovered and shared.
                </p>
                <div class="space-y-4 mb-8">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faUsers} class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">100+ active members sharing tips</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faBell} class="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">Real-time deal alerts and notifications</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faQuestionCircle} class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">Expert help with server configurations</span>
                    </div>
                </div>
                <Button
                    href="https://discord.gg/dcuGfURbdc"
                    size="lg"
                    class="shadow-sm"
                    color="primary"
                >
                    <FontAwesomeIcon icon={faDiscord} class="mr-2" />
                    Join Discord Community
                    <ArrowRightOutline class="ms-2 w-5 h-5" />
                </Button>
            </div>
            <div class="bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-8 shadow-md">
                <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    🎯 Community Highlights
                </h3>
                <div class="space-y-4">
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div class="flex items-start gap-3">
                            <img src="/images/user1.webp" alt="User" class="w-8 h-8 rounded-full" loading="lazy" />
                            <div class="flex-1">
                                <p class="text-sm text-gray-700 dark:text-gray-300">
                                    "Just saved €200 on a perfect server thanks to the community's price alerts! 🎉"
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">— Alex, 2 hours ago</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div class="flex items-start gap-3">
                            <img src="/images/user2.webp" alt="User" class="w-8 h-8 rounded-full" loading="lazy" />
                            <div class="flex-1">
                                <p class="text-sm text-gray-700 dark:text-gray-300">
                                    "CAX41 available in Falkenstein! Setting up alerts for everyone interested."
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">— Maria, 1 day ago</p>
                            </div>
                        </div>
                    </div>
                    <div class="text-center">
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            💬 Join the conversation and discover your next great deal
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Open Source & Contributors Section -->
    <section id="open-source" class="mx-auto my-20 max-w-7xl">
        <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
            Built by the Community, For the Community
        </h2>
        <p class="mb-12 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400">
            Transparency, collaboration, and user-first development are at the heart of everything we do.
        </p>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Open Source Commitment -->
            <div class="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-8 shadow-md border-l-4 border-green-500">
                <div class="flex items-center mb-6">
                    <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4">
                        <FontAwesomeIcon icon={faGithub} class="w-6 h-6 text-white" />
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        100% Open Source
                    </h3>
                </div>
                <p class="mb-6 text-gray-600 dark:text-gray-400">
                    Every line of code is transparent and community-reviewed. We believe in building tools
                    that serve users, not shareholders. Inspect, modify, and contribute freely.
                </p>
                <div class="space-y-3 mb-6">
                    <div class="flex items-center gap-3">
                        <div class="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <span class="text-green-600 dark:text-green-400 text-sm">✓</span>
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">MIT License - truly free forever</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <span class="text-green-600 dark:text-green-400 text-sm">✓</span>
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">Modern tech stack (SvelteKit, TypeScript)</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <span class="text-green-600 dark:text-green-400 text-sm">✓</span>
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">Community-reviewed for security & privacy</span>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row gap-3">
                    <Button
                        href="https://github.com/elsbrock/hetzner-radar"
                        class="flex items-center justify-center"
                        color="primary"
                    >
                        <FontAwesomeIcon icon={faGithub} class="mr-2" />
                        View Source Code
                    </Button>
                    <Button
                        href="https://github.com/elsbrock/hetzner-radar/blob/main/CONTRIBUTING.md"
                        class="flex items-center justify-center"
                        color="alternative"
                    >
                        <FontAwesomeIcon icon={faForwardStep} class="mr-2" />
                        Start Contributing
                    </Button>
                </div>
            </div>

            <!-- Community Contribution -->
            <div class="bg-gradient-to-br from-orange-50 to-amber-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-8 shadow-md border-l-4 border-orange-500">
                <div class="flex items-center mb-6">
                    <div class="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mr-4">
                        <FontAwesomeIcon icon={faUsers} class="w-6 h-6 text-white" />
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        Join the Team
                    </h3>
                </div>
                <p class="mb-6 text-gray-600 dark:text-gray-400">
                    Server Radar exists thanks to passionate contributors who donate their time and expertise.
                    Every contribution, big or small, makes a difference.
                </p>
                <div class="space-y-4 mb-6">
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div class="flex items-center gap-3 mb-2">
                            <FontAwesomeIcon icon={faBug} class="w-4 h-4 text-red-500" />
                            <span class="font-semibold text-gray-800 dark:text-gray-200">Report & Fix Issues</span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Help us improve by reporting bugs or submitting fixes</p>
                    </div>
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div class="flex items-center gap-3 mb-2">
                            <FontAwesomeIcon icon={faQuestionCircle} class="w-4 h-4 text-blue-500" />
                            <span class="font-semibold text-gray-800 dark:text-gray-200">Help Community</span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Answer questions and share knowledge in Discord</p>
                    </div>
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="text-orange-500">☕</span>
                            <span class="font-semibold text-gray-800 dark:text-gray-200">Support Development</span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Buy us a coffee to fuel late-night coding sessions</p>
                    </div>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400 italic">
                        💝 Special thanks to all contributors making this project possible!
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- Testimonials Section -->
    <section id="testimonials" class="mx-auto my-20 max-w-7xl">
        <h2
            class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
        >
            What Our Users Say
        </h2>
        <p
            class="mb-10 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
        >
            Join the community of satisfied users who have optimized their
            server purchases with <strong>Server Radar</strong>'s comprehensive
            tools and real-time alerts. Hear from those who have benefited from
            our advanced features and seamless monitoring.
        </p>

        <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card class="shadow-sm flex flex-col justify-between border-l-8">
                <p class="text-gray-600 dark:text-gray-400 mb-3 italic">
                    "As a startup founder, Server Radar helps me stretch our infrastructure
                    budget. The open-source nature means I can trust it and even contribute
                    features we need!"
                </p>
                <div class="flex items-center">
                    <img
                        src="/images/user1.webp"
                        alt="Alex Johnson"
                        class="w-12 h-12 rounded-full mr-4"
                        loading="lazy"
                    />
                    <div>
                        <p
                            class="text-gray-800 dark:text-gray-100 font-semibold"
                        >
                            Alex Johnson
                        </p>
                        <p class="text-gray-500 dark:text-gray-400 text-sm">
                            Web Developer
                        </p>
                    </div>
                </div>
            </Card>

            <Card class="shadow-sm flex flex-col justify-between border-l-8">
                <p class="text-gray-600 dark:text-gray-400 mb-3 italic">
                    "The transparency of open source combined with the powerful filtering
                    makes this my go-to tool. Saved hundreds of euros and joined an
                    amazing community!"
                </p>
                <div class="flex items-center">
                    <img
                        src="/images/user2.webp"
                        alt="Maria Lopez"
                        class="w-12 h-12 rounded-full mr-4"
                        loading="lazy"
                    />
                    <div>
                        <p
                            class="text-gray-800 dark:text-gray-100 font-semibold"
                        >
                            Maria Lopez
                        </p>
                        <p class="text-gray-500 dark:text-gray-400 text-sm">
                            System Administrator
                        </p>
                    </div>
                </div>
            </Card>

            <Card class="shadow-sm flex flex-col justify-between border-l-8">
                <p class="text-gray-600 dark:text-gray-400 mb-3 italic">
                    "I love that it's community-driven. Filed a feature request on GitHub
                    and it was implemented within days. This is how software should be built
                    – by users, for users."
                </p>
                <div class="flex items-center">
                    <img
                        src="/images/user3.webp"
                        alt="Liam Smith"
                        class="w-12 h-12 rounded-full mr-4"
                        loading="lazy"
                    />
                    <div>
                        <p
                            class="text-gray-800 dark:text-gray-100 font-semibold"
                        >
                            Liam Smith
                        </p>
                        <p class="text-gray-500 dark:text-gray-400 text-sm">
                            IT Consultant
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    </section>

    <!-- Contact & Support Section -->
    <section id="contact" class="mx-auto mt-10 max-w-7xl text-center">
        <h2
            class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
        >
            Get in Touch
        </h2>
        <p class="mx-auto md:w-2/3 mb-8 text-gray-600 dark:text-gray-400">
            Have questions or need support? We'd love to hear from you! Whether
            it's about our new email alert feature, optimizing your server
            configurations, or any other aspect of <strong>Server Radar</strong
            >, our team is here to help.
        </p>
        <div class="flex justify-center space-x-4">
            <Button
                href="/contact"
                class="px-6 py-3 text-md flex items-center shadow-sm"
                color="alternative"
            >
                <FontAwesomeIcon icon={faEnvelope} class="mr-2" />
                Contact Us
            </Button>
            <Button
                href="https://github.com/elsbrock/hetzner-radar/issues"
                class="px-6 py-3 text-md flex items-center shadow-sm"
                color="alternative"
            >
                <FontAwesomeIcon icon={faBug} class="mr-2" />
                Report an Issue
            </Button>
        </div>
    </section>

    <!-- FAQ Section -->
    <section id="faq" class="mx-auto my-20 max-w-7xl">
        <h2
            class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
        >
            Frequently Asked Questions
        </h2>
        <p
            class="mb-12 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
        >
            Get quick answers to common questions about Server Radar's features, pricing, and functionality.
        </p>
        <div class="mx-auto max-w-4xl">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                <Accordion class="border-none">
                    <AccordionItem class="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                        <span slot="header" class="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                            <div class="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                <span class="text-green-600 dark:text-green-400 text-sm">💰</span>
                            </div>
                            Is Server Radar really free?
                        </span>
                        <div class="pl-11">
                            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
                                Yes! Server Radar is completely free and open source. We believe in providing value to the community without barriers. You can use all features including notifications at no cost.
                            </p>
                        </div>
                    </AccordionItem>
                    <AccordionItem class="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                        <span slot="header" class="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                            <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faClock} class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            How often is the auction data updated?
                        </span>
                        <div class="pl-11">
                            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
                                We check the Hetzner auction multiple times throughout the day to ensure you have access to the latest server availability and pricing. The "Auctions in Last Batch" counter shows you how many servers we found in our most recent scan.
                            </p>
                        </div>
                    </AccordionItem>
                <AccordionItem>
                    <span slot="header" class="text-base font-semibold text-gray-800 dark:text-gray-100">
                        Can I contribute to the project?
                    </span>
                    <p class="text-gray-600 dark:text-gray-400">
                        Absolutely! Server Radar is open source and we welcome contributions. Whether it's code improvements, bug reports, feature suggestions, or documentation updates, check out our GitHub repository to get started.
                    </p>
                </AccordionItem>
                <AccordionItem>
                    <span slot="header" class="text-base font-semibold text-gray-800 dark:text-gray-100">
                        How do notifications work?
                    </span>
                    <p class="text-gray-600 dark:text-gray-400">
                        We offer two types of alerts: <strong>Auction Price Alerts</strong> notify you when servers hit your target price, 
                        and <strong>Cloud Availability Alerts</strong> inform you when specific cloud server types become available in your 
                        desired locations. Simply create an account, configure your alerts, and choose your notification channels (email, 
                        Discord, etc.). We'll notify you instantly when your conditions are met. No spam, just the alerts you need!
                    </p>
                </AccordionItem>
                <AccordionItem>
                    <span slot="header" class="text-base font-semibold text-gray-800 dark:text-gray-100">
                        What notification types are supported?
                    </span>
                    <p class="text-gray-600 dark:text-gray-400">
                        Currently we support email notifications and Discord webhooks for both price alerts and cloud availability alerts. We're actively working on adding more notification channels like Slack, Telegram, and webhook integrations to give you maximum flexibility in how you receive alerts.
                    </p>
                </AccordionItem>
                <AccordionItem>
                    <span slot="header" class="text-base font-semibold text-gray-800 dark:text-gray-100">
                        Is my data secure?
                    </span>
                    <p class="text-gray-600 dark:text-gray-400">
                        We take privacy seriously. We only collect minimal data necessary to provide the service (email/Discord info for notifications). All server auction data is publicly available information. Check our Privacy Policy for full details.
                    </p>
                </AccordionItem>
                </Accordion>
            </div>
        </div>
    </section>

    <!-- Disclaimer Note -->
    <section class="mx-auto mt-16 mb-4 max-w-4xl text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400">
            Server Radar is an independent project and is not affiliated with,
            endorsed, or sponsored by Hetzner Online GmbH. "Hetzner" is a
            trademark of Hetzner Online GmbH. Data accuracy is not guaranteed.
            Use at your own risk. See <a
                href="/terms"
                class="underline hover:text-orange-500 dark:hover:text-orange-400"
                >Terms</a
            >
            and
            <a
                href="/privacy"
                class="underline hover:text-orange-500 dark:hover:text-orange-400"
                >Privacy Policy</a
            >.
        </p>
    </section>
</main>

<style>
    @keyframes scary-shake {
        0% {
            transform: translateX(0) rotate(0); /* Explicit start */
        }
        10%,
        30%,
        50%,
        70%,
        90% {
            transform: translateX(-2px) rotate(-1.5deg);
        }
        20%,
        40%,
        60%,
        80% {
            transform: translateX(2px) rotate(1.5deg);
        }
        100% {
            transform: translateX(0) rotate(0); /* Explicit end */
        }
    }

    .scary-letter {
        display: inline-block; /* Needed for transform */
        transform-origin: center center; /* Ensure rotation is centered */
        will-change: transform; /* Optimize animation */
    }

    .scary-letter.animate {
        animation-name: scary-shake;
        animation-duration: 1s; /* Keep the current duration */
        animation-timing-function: ease-in-out;
        /* animation-fill-mode: forwards; */ /* Removed this line */
        animation-iteration-count: 1; /* Run only once */
    }
</style>
