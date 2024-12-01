<script lang="ts">
    import Footer from "$lib/components/Footer.svelte";
    import Nav from "$lib/components/Nav.svelte";
    import Toast from "$lib/components/Toast.svelte";
    import "../app.css";

    import Banner from "$lib/components/Banner.svelte";
    import { session } from "$lib/stores/session";
    import { onDestroy, onMount } from "svelte";
    import { initializeDB, tearDownDB } from "../stores/db";

    export let data;
    session.set(data.session);

    onMount(async () => {
        return initializeDB();
    });

    onDestroy(async () => {
        await tearDownDB();
    });
</script>

<svelte:head>
    <!-- Primary Meta Tags -->
    <title>Server Radar - Track Hetzner Auction Server Prices</title>
    <meta
        name="description"
        content="Server Radar helps you find the best deals on Hetzner dedicated servers. Monitor prices, set up email alerts, and make informed purchasing decisions effortlessly."
    />
    <meta
        name="keywords"
        content="Hetzner servers, server deals, price tracking, email alerts, server monitoring, dedicated servers, notifications, server configurations, server price alerts"
    />
    <meta name="author" content="Simon Elsbrock" />

    <!-- Viewport -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Robots -->
    <meta name="robots" content="index, follow" />

    <!-- Canonical URL -->
    <link rel="canonical" href="https://radar.iodev.org/" />

    <!-- Favicon -->
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />

    <!-- Open Graph Meta Tags -->
    <meta
        property="og:title"
        content="Server Radar - Track Hetzner Server Prices & Receive Email Alerts"
    />
    <meta
        property="og:description"
        content="Discover the best deals on Hetzner dedicated servers with Server Radar. Monitor prices, set up email alerts, and make informed purchasing decisions effortlessly."
    />
    <meta property="og:url" content="https://radar.iodev.org/" />
    <meta property="og:type" content="website" />
    <meta
        property="og:image"
        content="https://radar.iodev.org/images/og-image.webp"
    />
    <meta property="og:image:alt" content="Server Radar Dashboard" />

    <!-- Structured Data (JSON-LD) -->
    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Server Radar",
            "url": "https://radar.iodev.org/",
            "description": "Server Radar helps you find the best deals on Hetzner dedicated servers. Track prices, set up email alerts, and make informed purchasing decisions effortlessly.",
            "publisher": {
                "@type": "Person",
                "name": "Simon Elsbrock",
                "url": "https://radar.iodev.org/",
                "sameAs": ["https://github.com/elsbrock"]
            }
        }
    </script>

    <!-- Additional Meta Tags -->
    <meta http-equiv="Content-Language" content="en-US" />
    <meta name="theme-color" content="#FF7F50" />
</svelte:head>

<div class="bg-gray-50">
    <Banner>
        <strong>New Feature:</strong> Price Alerts 🚀
    </Banner>
    <Nav />

    <slot></slot>
</div>
<Footer />

<Toast duration={2000} />
