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
                  // Start fade-in immediately without additional delay
                  isVisible = false; // Fade out
                  fadeTimeoutId = null;
                  
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

<Navbar class="px-2 sm:px-4 py-2.5 w-full">
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

  <div class="flex md:hidden ml-auto">
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
    class="{!isNavOpen ? 'hidden md:flex' : 'flex'} flex-col md:flex-row md:space-x-8 md:mt-0 md:text-sm md:font-medium"
    {activeUrl}
  >
    <NavLi
      href="/"
      data-testid="nav-link-home"
      active={activeUrl === '/'}
      class="{activeUrl === '/' ? 'text-primary-700 dark:text-primary-500' : 'text-gray-700 dark:text-gray-400'}"
    >
      <FontAwesomeIcon class="me-2 w-4 h-4 {activeUrl === '/' ? 'nav-icon-active' : ''}" icon={faHouse} />
      <span class="{activeUrl === '/' ? 'border-b-2 nav-underline-active pb-0.5' : ''}">Home</span>
    </NavLi>
    <NavLi
      href="/configurations"
      data-testid="nav-link-configurations"
      active={activeUrl === '/configurations'}
      class="{activeUrl === '/configurations' ? 'text-primary-700 dark:text-primary-500' : 'text-gray-700 dark:text-gray-400'}"
    >
      <FontAwesomeIcon class="me-2 w-4 h-4 {activeUrl === '/configurations' ? 'nav-icon-active' : ''}" icon={faServer} />
      <span class="{activeUrl === '/configurations' ? 'border-b-2 nav-underline-active pb-0.5' : ''}">Configurations</span>
    </NavLi>
    <NavLi
      href="/analyze"
      data-testid="nav-link-analyze"
      active={activeUrl === '/analyze'}
      class="{activeUrl === '/analyze' ? 'text-primary-700 dark:text-primary-500' : 'text-gray-700 dark:text-gray-400'}"
    >
      <FontAwesomeIcon class="me-2 w-4 h-4 {activeUrl === '/analyze' ? 'nav-icon-active' : ''}" icon={faBinoculars} />
      <span class="{activeUrl === '/analyze' ? 'border-b-2 nav-underline-active pb-0.5' : ''}">Analyze</span>
    </NavLi>
    {#if $session}
      <NavLi
        href="/alerts"
        data-testid="nav-link-alerts"
        active={activeUrl === '/alerts'}
        class="{activeUrl === '/alerts' ? 'text-primary-700 dark:text-primary-500' : 'text-gray-700 dark:text-gray-400'}"
        onmouseenter={() => (isHoveringAlerts = true)}
        onmouseleave={() => (isHoveringAlerts = false)}
      >
        {#if isHoveringAlerts}
          <FontAwesomeIcon
            class="me-2 w-4 h-4 {activeUrl === '/alerts' ? 'nav-icon-active' : 'text-orange-500'}"
            icon={faBell}
            shake
          />
        {:else}
          <FontAwesomeIcon class="me-2 w-4 h-4 {activeUrl === '/alerts' ? 'nav-icon-active' : 'text-orange-500'}" icon={faBell} />
        {/if}
        <span class="{activeUrl === '/alerts' ? 'border-b-2 nav-underline-active pb-0.5' : ''}">Alerts</span>
      </NavLi>
    {:else}
      <NavLi
        href="/statistics"
        data-testid="nav-link-statistics"
        active={activeUrl === '/statistics'}
        class="{activeUrl === '/statistics' ? 'text-primary-700 dark:text-primary-500' : 'text-gray-700 dark:text-gray-400'}"
      >
        <FontAwesomeIcon class="me-2 w-4 h-4 {activeUrl === '/statistics' ? 'nav-icon-active' : ''}" icon={faChartSimple} />
        <span class="{activeUrl === '/statistics' ? 'border-b-2 nav-underline-active pb-0.5' : ''}">Statistics</span>
      </NavLi>
      <NavLi
        href="/about"
        data-testid="nav-link-about"
        active={activeUrl === '/about'}
        class="{activeUrl === '/about' ? 'text-primary-700 dark:text-primary-500' : 'text-gray-700 dark:text-gray-400'}"
      >
        <FontAwesomeIcon class="me-2 w-4 h-4 {activeUrl === '/about' ? 'nav-icon-active' : ''}" icon={faCircleInfo} />
        <span class="{activeUrl === '/about' ? 'border-b-2 nav-underline-active pb-0.5' : ''}">About</span>
      </NavLi>
    {/if}

    {#if $session}
      <NavLi
        href="/settings"
        data-testid="nav-link-settings"
        active={activeUrl === '/settings'}
        class="{activeUrl === '/settings' ? 'text-primary-700 dark:text-primary-500' : 'text-gray-700 dark:text-gray-400'}"
      >
        <FontAwesomeIcon class="me-2 w-4 h-4 {activeUrl === '/settings' ? 'nav-icon-active' : ''}" icon={faUser} />
        <span class="{activeUrl === '/settings' ? 'border-b-2 nav-underline-active pb-0.5' : ''}">Settings</span>
      </NavLi>
    {/if}
    
    <!-- Mobile only container for controls -->
    <div class="md:hidden flex items-center justify-between p-2 mt-2 border-t dark:border-gray-700">
      {#if $session}
        <form
          action="/auth/logout"
          method="POST"
          use:enhance={() => {
            session.set(null);
            return goto("/auth/logout");
          }}
          class="grow mr-2"
        >
          <Button
            data-testid="nav-signout-mobile"
            outline
            class="w-full"
            type="submit"
          >
            <FontAwesomeIcon class="me-2 w-4 h-4" icon={faRightFromBracket} />
            Sign Out
          </Button>
        </form>
      {:else}
        <Button
          data-testid="nav-signin-mobile"
          outline
          class="grow mr-2"
          href="/auth/login"
        >
          <FontAwesomeIcon class="me-2 w-4 h-4" icon={faKey} />
          Sign In
        </Button>
      {/if}
      <DarkMode />
    </div>
  </NavUl>

  <div class="hidden md:flex items-center space-x-3 md:order-2">
    {#if $session}
      <form
        action="/auth/logout"
        method="POST"
        use:enhance={() => {
          session.set(null);
          return goto("/auth/logout");
        }}
      >
        <Button
          data-testid="nav-signout-desktop"
          size="sm"
          color="light"
          type="submit"
        >
          <FontAwesomeIcon class="w-4 h-4 me-2" icon={faRightFromBracket} />
          Sign Out
        </Button>
      </form>
    {:else}
      <Button
        data-testid="nav-signin-desktop"
        size="sm"
        color="light"
        href="/auth/login"
      >
        <FontAwesomeIcon class="w-4 h-4 me-2" icon={faKey} />
        Sign In
      </Button>
    {/if}
    <Button
      size="sm"
      color="light"
      href="https://github.com/elsbrock/hetzner-radar"
    >
      <FontAwesomeIcon class="w-4 h-4 me-2" icon={faGithub} />
      Star
    </Button>
    <DarkMode />
  </div>

  <div
    class="{isVisible ? 'fade-out-gradient' : 'fade-in-gradient'} absolute inset-x-0 bottom-0 translate-y-[0px] h-[50px] overflow-hidden"
    style="background: radial-gradient(ellipse 80% 50px at 50% 100%, rgba(249, 115, 22, 0.15), transparent 60%); pointer-events: none;"
  ></div>
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
    class="absolute inset-0 h-[2px] w-[300%] -left-full bg-gradient-to-r from-transparent via-orange-500 to-transparent bg-repeat-x transition-opacity duration-300 {isVisible
      ? 'opacity-100'
      : 'opacity-0'} {isAnimating ? 'animate-loading-bar' : ''}"
    style="background-size: 33.33% 100%;"
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
  
  /* Separate transition durations for fade-in and fade-out */
  .fade-out-gradient {
    opacity: 0;
    transition: opacity 300ms ease;
  }
  
  .fade-in-gradient {
    opacity: 1;
    transition: opacity 300ms ease; /* Faster fade-in */
  }
  
  /* Force icon colors */
  :global(.nav-icon-active) {
    color: #FE795D !important;
  }
  
  :global(.dark .nav-icon-active) {
    color: #FE795D !important;
  }
  
  /* Force underline color */
  :global(.nav-underline-active) {
    border-bottom-color: #FE795D !important;
  }
</style>
