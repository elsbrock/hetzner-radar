<script lang="ts">
    import { faBug, faEnvelope } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button } from "flowbite-svelte";
</script>

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