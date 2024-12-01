<script>
    import {
        Footer,
        FooterCopyright,
        FooterLink,
        FooterLinkGroup,
    } from "flowbite-svelte";
    const buildDate = __BUILD_STAMP__;
</script>

<Footer class="border-t">
    <div class="p-5 sm:flex sm:items-center sm:justify-between">
        <FooterCopyright
            href="/"
            by="Server Radar."
            year={new Date().getFullYear()}
        />
        <div class="flex md:order-2">
            <FooterLinkGroup
                ulClass="flex flex-wrap order-1 items-center mt-3 text-sm text-gray-500 dark:text-gray-400 sm:mt-0"
            >
                <FooterLink href="/privacy">Privacy</FooterLink>
                <FooterLink href="/terms">Terms</FooterLink>
                <FooterLink href="/contact">Contact</FooterLink>
            </FooterLinkGroup>
        </div>
        <div class="order-1">
            <p class="text-xs text-gray-500 dark:text-gray-400 text-italic">
                Last Update {buildDate} (Europe/Berlin)
            </p>
        </div>
    </div>
</Footer>
