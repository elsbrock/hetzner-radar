<script lang="ts">
    import {
        Footer,
        FooterCopyright,
        FooterLink,
        FooterLinkGroup,
    } from "flowbite-svelte";
    const buildDate = import.meta.env.VITE_BUILD_STAMP;
</script>

<Footer class="border-t dark:border-gray-700 bg-white dark:bg-gray-800">
    <div class="p-5 sm:flex sm:items-center sm:justify-between">
        <FooterCopyright
            data-testid="footer-copyright"
            href="/"
            by="Server Radar."
            year={new Date().getFullYear()}
        />
        <div class="flex md:order-2">
            <FooterLinkGroup
                ulClass="flex flex-wrap order-1 items-center mt-3 text-sm text-gray-500 dark:text-gray-400 sm:mt-0"
            >
                <FooterLink
                    data-testid="footer-link-cloud-status"
                    href="/cloud-status">Cloud Status</FooterLink
                >
                <FooterLink data-testid="footer-link-privacy" href="/privacy"
                    >Privacy</FooterLink
                >
                <FooterLink data-testid="footer-link-terms" href="/terms"
                    >Terms</FooterLink
                >
                <FooterLink data-testid="footer-link-contact" href="/contact"
                    >Contact</FooterLink
                >
            </FooterLinkGroup>
        </div>
        <div class="order-1">
            {#if buildDate}
                <p class="text-xs text-gray-500 dark:text-gray-400 text-italic">
                    Last Update {buildDate} (Europe/Berlin)
                </p>
            {/if}
        </div>
    </div>
</Footer>
