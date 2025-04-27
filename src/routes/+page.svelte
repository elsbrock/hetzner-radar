<script lang="ts">
  import { withDbConnections } from "$lib/api/frontend/dbapi";
  import { faGithub } from "@fortawesome/free-brands-svg-icons";
  import {
    faBell,
    faBinoculars,
    faBug,
    faChartLine,
    faEnvelope,
    faEye,
    faFilter,
    faForwardStep,
  } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    Button,
    Card,
    Timeline,
    TimelineItem,
    // Reverted: Removed Avatar, Blockquote
  } from "flowbite-svelte";
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";
  import { db } from "../stores/db";

  let { data } = $props();

  let loadingUsers = true;
  let loadingAlerts = true;
  let loadingHistory = true;

  // Create tweened stores for all counters
  const serverCounter = tweened(0, {
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

  // Server count using $effect
  $effect(() => {
    const unsubscribe = db.subscribe(async (dbInstance) => {
      if (!dbInstance) return;

      try {
        await withDbConnections(dbInstance, async (conn) => {
          const result = await conn.query(
            `SELECT COUNT(id) as count
            FROM server`
          );
          const count = Number(result.toArray()[0].count);
          if (!isNaN(count)) {
            serverCounter.set(count);
          }
        });
      } catch (error) {
        console.error("Error fetching server count:", error);
        serverCounter.set(0);
      }

      unsubscribe();
    });
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
  });
</script>

<main class="p-8 bg-gray-50 dark:bg-gray-900">
  <!-- Hero Section -->
  <section class="mx-auto my-10 max-w-7xl text-center">
    <h1 class="mb-6 text-5xl font-extrabold text-gray-800 dark:text-gray-100">
      Stop Overpaying for Hetzner Auction Servers
    </h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-5">
      Tired of missing the best deals on Hetzner's Server Auction? <strong>Server Radar</strong> tracks prices over time, providing the historical insights, advanced filtering, and <span class="underline decoration-orange-500 decoration-2">free email alerts</span> you need. Find the right server at the right price, effortlessly.
    </p>

    <!-- Product Demo Section -->
    <section id="demo" class="mx-auto max-w-7xl text-center mb-5">
      <!--ARCADE EMBED START--><div style="position: relative; padding-bottom: calc(55.677083333333336% + 41px); height: 0; width: 100%;"><iframe src="https://demo.arcade.software/KVRZCAXbeIJw0GyOs6Ob?embed&embed_mobile=tab&embed_desktop=inline&show_copy_link=true" title="Effortlessly Track and Optimize Server Auction Prices with Server Radar" frameborder="0" loading="lazy" allowfullscreen allow="clipboard-write" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; color-scheme: light;" ></iframe></div><!--ARCADE EMBED END-->
    </section>

    <div class="flex justify-center space-x-4">
      <Button
        color="primary"
        href="/analyze"
        class="px-5 py-3 text-lg shadow-sm"
      >
        <FontAwesomeIcon icon={faBinoculars} class="mr-2" />Start Analyzing</Button
      >
      <Button
        color="alternative"
        href="https://github.com/elsbrock/hetzner-radar"
        class="px-5 py-3 text-lg shadow-sm"
      >
        <FontAwesomeIcon icon={faGithub} class="mr-2" />
        View on GitHub
      </Button>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="mx-auto mb-20 max-w-7xl">
    <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
      Key Features
    </h2>
    <p class="mb-10 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400">
      <strong>Server Radar</strong> equips you with the tools to navigate the Hetzner Server Auction market effectively. Save time, save money, and find the perfect configuration with features designed for smart purchasing:
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
        <h3 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
          Price History Tracking
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          Monitor price trends for specific server configurations. Understand
          market fluctuations and make strategic purchasing decisions based on
          historical data to secure the best value.
        </p>
      </Card>

      <Card class="flex flex-col items-center text-center shadow-md">
        <FontAwesomeIcon
          class="mb-4 w-8 h-8 text-orange-500"
          icon={faFilter}
          size="3x"
        />
        <h3 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
          Advanced Filtering
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          Filter servers by precise specs, including CPU, RAM, and exact disk
          configurations. Find exactly what you need quickly and customize
          your search to match specific requirements.
        </p>
      </Card>

      <Card class="flex flex-col items-center text-center shadow-md">
        <FontAwesomeIcon
          class="mb-4 w-8 h-8 text-orange-500"
          icon={faEye}
          size="3x"
        />
        <h3 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">Price Alerts</h3>
        <p class="text-gray-600 dark:text-gray-400">
          Set your target price and get notified via email when a matching server
          hits the auction. Plan your purchases effectively and never miss out
          on the perfect deal again – completely free!
        </p>
      </Card>
    </div>
  </section>

  <!-- How It Works Section -->
  <section id="how-it-works" class="mx-auto my-20 max-w-7xl">
    <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
      How It Works
    </h2>
    <p class="mb-10 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400">
      Finding the right Hetzner auction server at the best price is simple with <strong>Server Radar</strong>. Follow these steps to make smarter purchasing decisions:
    </p>
    <Timeline order="vertical" class="mx-auto max-w-3xl bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
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
        <p class="text-base font-normal text-gray-500 dark:text-gray-400">
          Use advanced filters to specify the exact server specifications you
          need – CPU, RAM, storage, location, and more. Instantly see all
          matching configurations observed in the auction history.
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
        <p class="text-base font-normal text-gray-500 dark:text-gray-400">
          Review detailed price histories and availability trends for your
          chosen configurations. Understand market movements and make
          data-driven decisions based on comprehensive historical insights.
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
        <p class="text-base font-normal text-gray-500 dark:text-gray-400 -mb-10">
          Set your target price for desired configurations and receive free
          email notifications the moment a matching server appears in the
          auction. Purchase confidently, knowing you've secured a great deal.
        </p>
      </TimelineItem>
    </Timeline>
  </section>

  <section id="features" class="mx-auto mb-20 max-w-7xl">
    <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
      At A Glance
    </h2>
    <p class="mb-10 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400">
      Key metrics showcasing the activity and reach of the Server Radar platform.
    </p>
    <div
      class="mx-auto my-12 max-w-7xl p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-8 sm:gap-0 items-center sm:items-center justify-center"
    >
      <!-- Servers Tracked -->
      <div class="flex flex-col items-center relative px-20">
        {#if $serverCounter === 0}
          <div class="h-12 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        {:else}
          <p
            class="text-4xl font-semibold pb-2 text-gray-700 dark:text-gray-200 tracking-tight leading-tight antialiased"
          >
            {Math.round($serverCounter).toLocaleString()}
          </p>
        {/if}
        <p class="text-base text-gray-500 dark:text-gray-400 antialiased">Auctions Tracked</p>
        <div
          class="hidden sm:block absolute right-[-12px] top-1/2 h-24 w-px bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 transform -translate-y-1/2"
        ></div>
      </div>

      <!-- Active Users -->
      <div class="flex flex-col items-center relative px-20">
        {#if $userCounter < 0}
          <div class="h-12 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        {:else}
          <p
            class="text-4xl font-semibold pb-2 text-gray-700 dark:text-gray-200 tracking-tight leading-tight antialiased"
          >
            {Math.round($userCounter).toLocaleString()}
          </p>
        {/if}
        <p class="text-base text-gray-500 dark:text-gray-400 antialiased">Active Users</p>
        <div
          class="hidden sm:block absolute right-[-12px] top-1/2 h-24 w-px bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 transform -translate-y-1/2"
        ></div>
      </div>

      <!-- Active Alerts -->
      <div class="flex flex-col items-center relative px-20">
        {#if $alertCounter < 0}
          <div class="h-12 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        {:else}
          <p
            class="text-4xl font-semibold pb-2 text-gray-700 dark:text-gray-200 tracking-tight leading-tight antialiased"
          >
            {Math.round($alertCounter).toLocaleString()}
          </p>
        {/if}
        <p class="text-base text-gray-500 dark:text-gray-400 antialiased">Active Alerts</p>
        <div
          class="hidden sm:block absolute right-[-12px] top-1/2 h-24 w-px bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 transform -translate-y-1/2"
        ></div>
      </div>

      <!-- Alerts Triggered -->
      <div class="flex flex-col items-center px-20">
        {#if $historyCounter < 0}
          <div class="h-12 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        {:else}
          <p
            class="text-4xl font-semibold pb-2 text-gray-700 dark:text-gray-200 tracking-tight leading-tight antialiased"
          >
            {Math.round($historyCounter).toLocaleString()}
          </p>
        {/if}
        <p class="text-base text-gray-500 dark:text-gray-400 antialiased">Alerts Triggered</p>
      </div>
    </div>
  </section>

  <!-- Testimonials Section -->
  <section id="testimonials" class="mx-auto my-20 max-w-7xl">
    <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
      What Our Users Say
    </h2>
    <p class="mb-10 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400">
      Join the community of satisfied users who have optimized their server
      purchases with <strong>Server Radar</strong>'s comprehensive tools and
      real-time alerts. Hear from those who have benefited from our advanced
      features and seamless monitoring.
    </p>

    <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
      <Card class="shadow-sm flex flex-col justify-between border-l-8">
        <p class="text-gray-600 dark:text-gray-400 mb-3 italic">
          "Server Radar has been instrumental in helping me find the best deals
          on Hetzner servers. The price tracking feature is a game-changer!"
        </p>
        <div class="flex items-center">
          <img
            src="/images/user1.webp"
            alt="Alex Johnson"
            class="w-12 h-12 rounded-full mr-4"
            loading="lazy"
          />
          <div>
            <p class="text-gray-800 dark:text-gray-100 font-semibold">Alex Johnson</p>
            <p class="text-gray-500 dark:text-gray-400 text-sm">Web Developer</p>
          </div>
        </div>
      </Card>

      <Card class="shadow-sm flex flex-col justify-between border-l-8">
        <p class="text-gray-600 dark:text-gray-400 mb-3 italic">
          "Thanks to Server Radar, I've been able to optimize my server
          purchases and save a significant amount of money. The email alerts
          ensure I never miss a great deal!"
        </p>
        <div class="flex items-center">
          <img
            src="/images/user2.webp"
            alt="Maria Lopez"
            class="w-12 h-12 rounded-full mr-4"
            loading="lazy"
          />
          <div>
            <p class="text-gray-800 dark:text-gray-100 font-semibold">Maria Lopez</p>
            <p class="text-gray-500 dark:text-gray-400 text-sm">System Administrator</p>
          </div>
        </div>
      </Card>

      <Card class="shadow-sm flex flex-col justify-between border-l-8">
        <p class="text-gray-600 dark:text-gray-400 mb-3 italic">
          "The advanced filtering options make it easy to find exactly what I
          need. Server Radar is an invaluable tool for anyone serious about
          server management. The notifications keep me updated instantly."
        </p>
        <div class="flex items-center">
          <img
            src="/images/user3.webp"
            alt="Liam Smith"
            class="w-12 h-12 rounded-full mr-4"
            loading="lazy"
          />
          <div>
            <p class="text-gray-800 dark:text-gray-100 font-semibold">Liam Smith</p>
            <p class="text-gray-500 dark:text-gray-400 text-sm">IT Consultant</p>
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
  <div class="absolute inset-0 w-full h-full bg-transparent dark:bg-black/60 z-[5]"></div>
    <div class="relative z-10">
      <!-- Heading -->
      <h2 class="mb-6 text-4xl font-semibold text-black dark:text-gray-100">
        Open Source Commitment
      </h2>

      <!-- Paragraph and Button -->
      <p class="md:w-2/3 mx-auto mb-6 text-gray-700 dark:text-gray-400">
        <strong>Server Radar</strong> is proudly open-source. We believe in transparency
        and community collaboration to continuously improve our tool. Explore our
        code, contribute to the project, or suggest new features on GitHub.
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
    <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
      Get in Touch
    </h2>
    <p class="mx-auto md:w-2/3 mb-8 text-gray-600 dark:text-gray-400">
      Have questions or need support? We'd love to hear from you! Whether it's
      about our new email alert feature, optimizing your server configurations,
      or any other aspect of <strong>Server Radar</strong>, our team is here to
      help.
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
      Server Radar is an independent project and is not affiliated with, endorsed, or sponsored by Hetzner Online GmbH. "Hetzner" is a trademark of Hetzner Online GmbH. Data accuracy is not guaranteed. Use at your own risk. See <a href="/terms" class="underline hover:text-orange-500 dark:hover:text-orange-400">Terms</a> and <a href="/privacy" class="underline hover:text-orange-500 dark:hover:text-orange-400">Privacy Policy</a>.
    </p>
  </section>
</main>
