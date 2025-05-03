<script lang="ts">
  import { navigating, page } from "$app/stores"; // <-- Import navigating
  import {
    faBell,
    faBinoculars,
    faChartSimple,
    faCircleInfo,
    faHouse,
    faKey,
    faRightFromBracket,
    faServer,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    Badge,
    Button,
    DarkMode,
    Navbar,
    NavBrand,
    NavHamburger,
    NavLi,
    NavUl,
  } from "flowbite-svelte";
  import Radar from "./Radar.svelte";

  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { session } from "$lib/stores/session";
  import { settingsStore } from "$lib/stores/settings";
  import { faGithub } from "@fortawesome/free-brands-svg-icons";

  let activeUrl = $derived($page.url.pathname);
  let isHoveringAlerts = $state(false);
  let isNavOpen = $state(false); // State for mobile nav visibility
  let isActuallyNavigating = $derived($navigating !== null);
  let isVisible = $state(false); // Controls opacity
  let isAnimating = $state(false); // Controls animation class
  let hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Effect to manage the loading bar states gracefully
  $effect(() => {
    if (isActuallyNavigating) {
      // --- Navigation Started ---
      // Clear any pending hide/fade timeouts
      if (hideTimeoutId) clearTimeout(hideTimeoutId);
      if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
      hideTimeoutId = null;
      fadeTimeoutId = null;
  
      // Make visible and start animating immediately
      isVisible = true;
      isAnimating = true;
  
    } else {
      // --- Navigation Ended (or initial load) ---
      // Only proceed if it was previously visible/animating
      if (isVisible || isAnimating) {
          // Don't start hiding if already scheduled
          if (!hideTimeoutId && !fadeTimeoutId) {
              // Let the animation complete its current cycle
              // The animation duration is 0.7s (700ms) as defined in the CSS
              const animationDuration = 700;
              
              // Wait for the current animation cycle to complete
              // This ensures we don't interrupt mid-animation
              hideTimeoutId = setTimeout(() => {
                  // Let the animation finish its current cycle completely
                  // before stopping it and fading out
                  isAnimating = false; // Stop animation at the end of cycle
                  hideTimeoutId = null;
                  
                  // Schedule fade out after animation stops
                  fadeTimeoutId = setTimeout(() => {
                      isVisible = false; // Fade out
                      fadeTimeoutId = null;
                  }, 200);
                  
              }, animationDuration); // Wait exactly one animation cycle
          }
      }
    }
  
    // Cleanup timeouts on component destroy
    return () => {
      if (hideTimeoutId) clearTimeout(hideTimeoutId);
      if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
    };
  });


  // Local reactive state for the theme, initialized from the store
  let theme = $state($settingsStore.theme);

  // Effect to update the store when the local theme state changes
  $effect(() => {
    // Avoid writing back to the store if the change originated from the store itself
    if (theme !== $settingsStore.theme) {
      settingsStore.updateSetting("theme", theme);
    }
  });

  // Effect to update local state if the store changes externally (e.g., another tab)
  // Using .pre ensures this runs before the effect above if both trigger in the same tick
  $effect.pre(() => {
    if ($settingsStore.theme !== theme) {
      theme = $settingsStore.theme;
    }
  });

  // Close nav on navigation
  $effect(() => {
    if ($page.url) {
      // Ensure url is available
      isNavOpen = false;
    }
  });
</script>

<Navbar class="h-15 w-full">
  <NavBrand href="/">
    <div style="width: 32px; height: 32px">
      <Radar />
    </div>
    <div class="ml-5 leading-none md:-mt-1">
      <p
        class="self-center whitespace-nowrap text-xl font-semibold text-black dark:text-white"
      >
        Server Radar <Badge>beta</Badge>
      </p>
      <span class="text-xs text-gray-500 dark:text-gray-200"
        >The Hetzner Auction Price Tracker.</span
      >
    </div>
  </NavBrand>

  <div class="hidden lg:flex items-center md:order-2">
    <Button
      size="md"
      color="alternative"
      href="https://github.com/elsbrock/hetzner-radar"
      class="
            border-gray-400 dark:border-gray-500
            bg-gray-50 dark:bg-gray-700
            p-2
            px-4
            ring-4
            ring-orange-100 dark:ring-orange-900/50
            hover:ring-orange-200 dark:hover:ring-orange-800/50
            hover:border-orange-400 dark:hover:border-orange-500
            text-gray-800 dark:text-gray-200
            hover:text-gray-800 dark:hover:text-gray-100
        "
    >
      <FontAwesomeIcon class="w-5 h-5 me-2" icon={faGithub} />
      Star
    </Button>
    <div class="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-3"></div>
    <div class="flex items-center">
      <!-- Use DarkMode component directly -->
      <DarkMode />
    </div>
  </div>

  <div class="flex md:order-2 lg:hidden">
    <Button href="/analyze" aria-label="Analyze" size="xs">
      <FontAwesomeIcon class="w-5 h-5" icon={faBinoculars} /><span
        class="hidden md:inline ml-2"
      >
        Analyze</span
      >
    </Button>
    <NavHamburger
      data-testid="nav-hamburger"
      class="md:flex"
      onclick={() => (isNavOpen = !isNavOpen)}
    />
  </div>

  <NavUl
    hidden={!isNavOpen}
    slideParams={{ duration: 250, delay: 0 }}
    class="order-1"
    {activeUrl}
  >
    <NavLi
      href="/"
      data-testid="nav-link-home"
      class="flex items-center !bg-transparent"
    >
      <FontAwesomeIcon class="me-2 w-4 h-4" icon={faHouse} />
      <span
        class="text-black dark:text-gray-200 {activeUrl === '/'
          ? 'border-b-2 border-primary-500'
          : ''}">Home</span
      >
    </NavLi>
    <NavLi
      href="/configurations"
      data-testid="nav-link-configurations"
      class="flex items-center !bg-transparent"
    >
      <FontAwesomeIcon class="me-2 w-4 h-4" icon={faServer} />
      <span
        class="text-black dark:text-gray-200 {activeUrl === '/configurations'
          ? 'border-b-2 border-primary-500'
          : ''}">Configurations</span
      >
    </NavLi>
    <NavLi
      href="/analyze"
      data-testid="nav-link-analyze"
      class="flex items-center !bg-transparent"
    >
      <FontAwesomeIcon class="me-2 w-4 h-4" icon={faBinoculars} />
      <span
        class="text-black dark:text-gray-200 {activeUrl === '/analyze'
          ? 'border-b-2 border-primary-500'
          : ''}">Analyze</span
      >
    </NavLi>
    {#if $session}
      <NavLi
        href="/alerts"
        data-testid="nav-link-alerts"
        class="flex items-center !bg-transparent"
        onmouseenter={() => (isHoveringAlerts = true)}
        onmouseleave={() => (isHoveringAlerts = false)}
      >
        {#if isHoveringAlerts}
          <FontAwesomeIcon
            class="text-orange-500 me-2 w-4 h-4"
            icon={faBell}
            shake
          />
        {:else}
          <FontAwesomeIcon class="text-orange-500 me-2 w-4 h-4" icon={faBell} />
        {/if}
        <span
          class="text-black dark:text-gray-200 {activeUrl === '/alerts'
            ? 'border-b-2 border-primary-500'
            : ''}">Alerts</span
        >
      </NavLi>
    {:else}
      <NavLi
        href="/statistics"
        data-testid="nav-link-statistics"
        class="flex items-center !bg-transparent"
      >
        <FontAwesomeIcon class="me-2 w-4 h-4" icon={faChartSimple} />
        <span
          class="text-black dark:text-gray-200 {activeUrl === '/statistics'
            ? 'border-b-2 border-primary-500'
            : ''}">Statistics</span
        >
      </NavLi>
      <NavLi
        href="/about"
        data-testid="nav-link-about"
        class="flex items-center !bg-transparent"
      >
        <FontAwesomeIcon class="me-2 w-4 h-4" icon={faCircleInfo} />
        <span
          class="text-black dark:text-gray-200 {activeUrl === '/about'
            ? 'border-b-2 border-primary-500'
            : ''}">About</span
        >
      </NavLi>
    {/if}

    {#if $session}
      <NavLi
        href="/settings"
        data-testid="nav-link-settings"
        class="flex items-center !bg-transparent"
      >
        <FontAwesomeIcon class="me-2 w-4 h-4" icon={faUser} />
        <span
          class="text-black dark:text-gray-300 {activeUrl === '/settings'
            ? 'border-b-2 border-primary-500'
            : ''}">Settings</span
        >
      </NavLi>
      <!-- Mobile only container for controls -->
      <div
        class="md:hidden flex items-center justify-between p-2 mt-2 border-t dark:border-gray-700"
      >
        <form
          action="/auth/logout"
          method="POST"
          use:enhance={() => {
            session.set(null);
            return goto("/auth/logout");
          }}
          class="flex-grow mr-2"
        >
          <Button
            data-testid="nav-signout-mobile"
            outline
            class="w-full bg-white dark:bg-inherit"
            type="submit"
          >
            <FontAwesomeIcon class="me-2 w-4 h-4" icon={faRightFromBracket} /> Sign
            Out
          </Button>
        </form>
        <!-- Use DarkMode component directly -->
        <DarkMode />
      </div>
      <!-- Desktop only Sign Out -->
      <form
        action="/auth/logout"
        method="POST"
        use:enhance={() => {
          session.set(null);
          return goto("/auth/logout");
        }}
        class="hidden md:block"
      >
        <Button
          data-testid="nav-signout-desktop"
          outline
          class="md:w-auto md:-m-2 md:p-2 bg-white dark:bg-inherit"
          type="submit"
        >
          <FontAwesomeIcon class="me-2 w-4 h-4" icon={faRightFromBracket} /> Sign
          Out
        </Button>
      </form>
    {:else}
      <!-- Mobile only container for controls -->
      <div
        class="md:hidden flex items-center justify-between p-2 mt-2 border-t dark:border-gray-700"
      >
        <Button
          data-testid="nav-signin-mobile"
          outline
          class="flex-grow mr-2 bg-white dark:bg-inherit"
          href="/auth/login"
        >
          <FontAwesomeIcon class="me-2 w-4 h-4" icon={faKey} /> Sign In
        </Button>
        <!-- Use DarkMode component directly -->
        <DarkMode />
      </div>

      <!-- Desktop only Sign In -->
      <Button
        data-testid="nav-signin-desktop"
        outline
        class="hidden md:block md:w-auto md:-m-2 md:p-2 bg-white dark:bg-inherit"
        href="/auth/login"
      >
        <FontAwesomeIcon class="me-2 w-4 h-4" icon={faKey} /> Sign In
      </Button>
    {/if}
    <!-- Removed separate mobile DarkMode NavLi -->
  </NavUl>
</Navbar>

<!-- Loading Indicator -->
<div class="relative w-full h-[2px] overflow-hidden">
  <!-- Static bar, visible when animated bar is not -->
  <div
    class="absolute inset-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent transition-opacity duration-300 {isVisible
      ? 'opacity-0'
      : 'opacity-100'}"
  ></div>
  <!-- Animated bar -->
  <div
    class="absolute inset-0 h-[2px] w-[300%] left-[-100%] bg-gradient-to-r from-transparent via-orange-500 to-transparent bg-[length:33.33%_100%] bg-repeat-x transition-opacity duration-300 {isVisible
      ? 'opacity-100'
      : 'opacity-0'} {isAnimating ? 'animate-loading-bar' : ''}"
  ></div>
</div>

<style>
  @keyframes loading-bar {
    0% {
      transform: translateX(0%);
    }
    100% {
      transform: translateX(33.33%); /* Move exactly one pattern width */
    }
  }
  .animate-loading-bar {
    animation: loading-bar 0.7s infinite linear;
  }
</style>
