<script lang="ts">
    import CommunitySection from "$lib/components/landing/CommunitySection.svelte";
    import ContactSection from "$lib/components/landing/ContactSection.svelte";
    import FAQSection from "$lib/components/landing/FAQSection.svelte";
    import FeaturesSection from "$lib/components/landing/FeaturesSection.svelte";
    import HeroSection from "$lib/components/landing/HeroSection.svelte";
    import HowItWorksSection from "$lib/components/landing/HowItWorksSection.svelte";
    import LiveMetrics from "$lib/components/landing/LiveMetrics.svelte";
    import OpenSourceSection from "$lib/components/landing/OpenSourceSection.svelte";
    import TestimonialsSection from "$lib/components/landing/TestimonialsSection.svelte";

    let { data } = $props();
</script>

<main class="p-8">
    <!-- Hero Section -->
    <HeroSection />

    <!-- Live Metrics -->
    <LiveMetrics {data} />

    <!-- Product Demo Section -->
    <section
        id="demo"
        class="mx-auto max-w-7xl text-center mb-12 hidden md:block dark:hidden"
    >
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
    <FeaturesSection />

    <!-- How It Works Section -->
    <HowItWorksSection />

    <!-- Community Section -->
    <CommunitySection />

    <!-- Open Source & Contributors Section -->
    <OpenSourceSection />

    <!-- Testimonials Section -->
    <TestimonialsSection />

    <!-- Contact & Support Section -->
    <ContactSection />

    <!-- FAQ Section -->
    <FAQSection />

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