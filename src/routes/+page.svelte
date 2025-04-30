<script lang="ts">
    import { withDbConnections } from "$lib/api/frontend/dbapi";
    // Removed ServerConfiguration import as it's now only used in SampleCardStack
    import SampleCardStack from "$lib/components/SampleCardStack.svelte"; // Import the new component
    import { faGithub } from "@fortawesome/free-brands-svg-icons";
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
        faUsers,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button, Card, Timeline, TimelineItem } from "flowbite-svelte";
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

<main class="p-8 bg-gray-50 dark:bg-gray-900">
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
                Tired of missing the best deals? <strong>Server Radar</strong>
                tracks prices, provides historical insights, advanced filtering,
                and
                <span class="underline decoration-orange-500 decoration-2"
                    >free email alerts</span
                >. Find the right server at the right price, effortlessly.
            </p>
            <div class="flex flex-col sm:flex-row gap-4">
                <Button
                    color="primary"
                    href="/analyze"
                    size="lg"
                    class="shadow-sm"
                >
                    Get Started
                    <ArrowRightOutline class="ms-2 w-5 h-5" />
                </Button>
                <Button
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
            Key Features
        </h2>
        <p
            class="mb-10 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
        >
            <strong>Server Radar</strong> equips you with the tools to navigate the
            Hetzner Server Auction market effectively. Save time, save money, and
            find the perfect configuration with features designed for smart purchasing:
        </p>
        <div
            class="grid grid-cols-1 justify-items-center gap-x-4 gap-y-10 md:grid-cols-2 lg:grid-cols-3"
        >
            <Card class="flex flex-col items-center text-center shadow-md">
                <FontAwesomeIcon
                    class="mb-4 w-8 h-8 text-orange-500"
                    icon={faChartLine}
                    size="3x"
                />
                <h3
                    class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100"
                >
                    Price History Tracking
                </h3>
                <p class="text-gray-600 dark:text-gray-400">
                    Monitor price trends for specific server configurations.
                    Understand market fluctuations and make strategic purchasing
                    decisions based on historical data to secure the best value.
                </p>
            </Card>

            <Card class="flex flex-col items-center text-center shadow-md">
                <FontAwesomeIcon
                    class="mb-4 w-8 h-8 text-orange-500"
                    icon={faFilter}
                    size="3x"
                />
                <h3
                    class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100"
                >
                    Advanced Filtering
                </h3>
                <p class="text-gray-600 dark:text-gray-400">
                    Filter servers by precise specs, including CPU, RAM, and
                    exact disk configurations. Find exactly what you need
                    quickly and customize your search to match specific
                    requirements.
                </p>
            </Card>

            <Card class="flex flex-col items-center text-center shadow-md">
                <FontAwesomeIcon
                    class="mb-4 w-8 h-8 text-orange-500"
                    icon={faEye}
                    size="3x"
                />
                <h3
                    class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100"
                >
                    Price Alerts
                </h3>
                <p class="text-gray-600 dark:text-gray-400">
                    Set your target price and get notified via email when a
                    matching server hits the auction. Plan your purchases
                    effectively and never miss out on the perfect deal again –
                    completely free!
                </p>
            </Card>
        </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="mx-auto my-20 max-w-7xl">
        <h2
            class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
        >
            How It Works
        </h2>
        <p
            class="mb-10 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
        >
            Finding the right Hetzner auction server at the best price is simple
            with <strong>Server Radar</strong>. Follow these steps to make
            smarter purchasing decisions:
        </p>
        <Timeline
            order="vertical"
            class="mx-auto max-w-3xl bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700"
        >
            <TimelineItem title="Step 1: Filter & Find">
                <svelte:fragment slot="icon">
                    <span
                        class="flex absolute -left-3 justify-center items-center w-8 h-8 bg-orange-200 rounded-full ring-8 ring-white dark:ring-gray-900 dark:bg-orange-900"
                    >
                        <FontAwesomeIcon
                            icon={faForwardStep}
                            class=" text-orange-600 dark:text-orange-300"
                        />
                    </span>
                </svelte:fragment>
                <p
                    class="text-base font-normal text-gray-500 dark:text-gray-400"
                >
                    Use advanced filters to specify the exact server
                    specifications you need – CPU, RAM, storage, location, and
                    more. Instantly see all matching configurations observed in
                    the auction history.
                </p>
            </TimelineItem>
            <TimelineItem title="Step 2: Analyze Price Trends">
                <svelte:fragment slot="icon">
                    <span
                        class="flex absolute -left-3 justify-center items-center w-8 h-8 bg-orange-200 rounded-full ring-8 ring-white dark:ring-gray-900 dark:bg-orange-900"
                    >
                        <FontAwesomeIcon
                            icon={faChartLine}
                            class=" text-orange-600 dark:text-orange-300"
                        />
                    </span>
                </svelte:fragment>
                <p
                    class="text-base font-normal text-gray-500 dark:text-gray-400"
                >
                    Review detailed price histories and availability trends for
                    your chosen configurations. Understand market movements and
                    make data-driven decisions based on comprehensive historical
                    insights.
                </p>
            </TimelineItem>
            <TimelineItem title="Step 3: Configure Alerts">
                <svelte:fragment slot="icon">
                    <span
                        class="flex absolute -left-3 justify-center items-center w-8 h-8 bg-orange-200 rounded-full ring-8 ring-white dark:ring-gray-900 dark:bg-orange-900"
                    >
                        <FontAwesomeIcon
                            icon={faBell}
                            class=" text-orange-600 dark:text-orange-300"
                        />
                    </span>
                </svelte:fragment>
                <p
                    class="text-base font-normal text-gray-500 dark:text-gray-400 -mb-10"
                >
                    Set your target price for desired configurations and receive
                    free email notifications the moment a matching server
                    appears in the auction. Purchase confidently, knowing you've
                    secured a great deal.
                </p>
            </TimelineItem>
        </Timeline>
    </section>

    <section id="features" class="mx-auto mb-20 max-w-7xl">
        <h2
            class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
        >
            At A Glance
        </h2>
        <p
            class="mb-10 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
        >
            Key metrics showcasing the activity and reach of the Server Radar
            platform.
        </p>
        <div
            class="mx-auto my-12 max-w-7xl flex flex-col sm:flex-row flex-wrap gap-y-8 gap-x-4 items-center justify-around"
        >
            <!-- Auctions Tracked -->
            <div class="flex flex-col items-center text-center px-4">
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
            <div class="flex flex-col items-center text-center px-4">
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
            <div class="flex flex-col items-center text-center px-4">
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
            <div class="flex flex-col items-center text-center px-4">
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
            <div class="flex flex-col items-center text-center px-4">
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
                    "Server Radar has been instrumental in helping me find the
                    best deals on Hetzner servers. The price tracking feature is
                    a game-changer!"
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
                    "Thanks to Server Radar, I've been able to optimize my
                    server purchases and save a significant amount of money. The
                    email alerts ensure I never miss a great deal!"
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
                    "The advanced filtering options make it easy to find exactly
                    what I need. Server Radar is an invaluable tool for anyone
                    serious about server management. The notifications keep me
                    updated instantly."
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

    <!-- Open Source Commitment Section -->
    <section
        id="open-source"
        class="mx-auto my-20 max-w-7xl text-center bg-white shadow-sm rounded-lg p-4 lg:p-8 overflow-hidden relative border border-gray-200 dark:border-gray-700"
    >
        <!-- Background image container -->
        <div
            class="absolute inset-0 w-full h-full"
            style="
            background-image: url('/images/code.webp');
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center;
            background-attachment: local;
            filter: blur(4px) opacity(0.7);
        "
        ></div>

        <!-- Content -->
        <!-- Dark Overlay for Dark Mode -->
        <div
            class="absolute inset-0 w-full h-full bg-transparent dark:bg-black/60 z-[5]"
        ></div>
        <div class="relative z-10">
            <!-- Heading -->
            <h2
                class="mb-6 text-4xl font-semibold text-black dark:text-gray-100"
            >
                Open Source Commitment
            </h2>

            <!-- Paragraph and Button -->
            <p class="md:w-2/3 mx-auto mb-6 text-gray-700 dark:text-gray-400">
                <strong>Server Radar</strong> is proudly open-source. We believe
                in transparency and community collaboration to continuously improve
                our tool. Explore our code, contribute to the project, or suggest
                new features on GitHub.
            </p>
            <Button
                size="sm"
                href="https://github.com/elsbrock/hetzner-radar"
                class="px-6 pb-3 text-lg items-center justify-center dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
            >
                <FontAwesomeIcon icon={faGithub} class="mr-2" />
                View on GitHub
            </Button>
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
