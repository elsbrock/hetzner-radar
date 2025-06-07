<script lang="ts">
    import {
        Footer,
        FooterCopyright,
        FooterLink,
        FooterLinkGroup,
    } from "flowbite-svelte";
    import ServerIcon from "$lib/components/ServerIcon.svelte";
    const buildDate = import.meta.env.VITE_BUILD_STAMP;
</script>

<Footer class="border-t dark:border-gray-700 bg-white dark:bg-gray-800">
    <div class="p-5 flex flex-col sm:flex-row items-center justify-between">
        <div class="flex items-center">
            <FooterCopyright
                data-testid="footer-copyright"
                href="/"
                by="Server Radar."
                year={new Date().getFullYear()}
            />
            
            {#if buildDate}
                <p class="ml-4 text-xs text-gray-500 dark:text-gray-400 text-italic">
                    Last Update {buildDate} (Europe/Berlin)
                </p>
            {/if}
        </div>
        
        <!-- Server Icon -->
        <div class="my-3 sm:my-0">
            <ServerIcon width="85px" height="auto" className="opacity-70 hover:opacity-100 transition-opacity" />
        </div>
        
        <FooterLinkGroup
            ulClass="flex flex-wrap items-center text-sm text-gray-500 dark:text-gray-400"
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
            <FooterLink data-testid="footer-link-changelog" href="/changelog"
                >Changelog</FooterLink
            >
        </FooterLinkGroup>
    </div>
</Footer>
