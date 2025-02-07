<script lang="ts">
  import { page } from "$app/stores";
  import {
    faBell,
    faBinoculars,
    faChartSimple,
    faCircleInfo,
    faHouse,
    faKey,
    faRightFromBracket,
    faServer,
    faSun,
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
  import { faGithub } from "@fortawesome/free-brands-svg-icons";

  let alertShakeAnim = false;
  $: activeUrl = $page.url.pathname;
</script>

<Navbar class="h-15 w-full">
  <NavBrand href="/">
    <div style="width: 32px; height: 32px">
      <Radar />
    </div>
    <div class="ml-5 leading-none md:-mt-1">
      <p
        class="self-center whitespace-nowrap text-xl font-semibold dark:text-white"
      >
        Server Radar <Badge>beta</Badge>
      </p>
      <span class="text-xs text-gray-500 dark:text-gray-400">
        The Hetzner Auction Price Tracker.
      </span>
    </div>
  </NavBrand>

  <div class="hidden lg:flex md:order-2 items-center gap-2 ml-auto">
    <DarkMode
      class="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xl p-2"
    />
    <div class="border-l border-gray-300 h-6 mx-2"></div>
    <Button
      size="md"
      color="alternative"
      href="https://github.com/elsbrock/hetzner-radar"
      class="border-gray-400 bg-gray-50 p-2 px-4 ring-4 ring-orange-100 hover:ring-orange-200 hover:border-orange-400 text-gray-800 hover:text-gray-800"
    >
      <FontAwesomeIcon class="w-5 h-5 me-2" icon={faGithub} />
      Star
    </Button>
  </div>

  <div class="flex md:order-2 lg:hidden items-center gap-2">
    <Button href="/analyze" aria-label="Analyze" size="xs">
      <FontAwesomeIcon class="w-5 h-5" icon={faBinoculars} />
      <span class="hidden md:inline ml-2">Analyze</span>
    </Button>
    <NavHamburger class="md:flex" />
  </div>

  <NavUl slideParams={{ duration: 250, delay: 0 }} class="order-1" {activeUrl}>
    <NavLi href="/">
      <FontAwesomeIcon class="me-1 w-4 h-4" icon={faHouse} />
      Home
    </NavLi>
    <NavLi href="/configurations">
      <FontAwesomeIcon class="me-1 w-4 h-4" icon={faServer} />
      Configurations
    </NavLi>
    <NavLi href="/analyze">
      <FontAwesomeIcon class="me-1 w-4 h-4" icon={faBinoculars} />
      Analyze
    </NavLi>
    {#if $session}
      <div
        class="border-b"
        role="menuitem"
        tabindex="-1"
        on:mouseenter={() => (alertShakeAnim = true)}
        on:mouseleave={() => (alertShakeAnim = false)}
      >
        <NavLi href="/alerts">
          {#if alertShakeAnim}
            <FontAwesomeIcon
              class="text-orange-500 me-1 w-4 h-4"
              icon={faBell}
              shake
            />
          {:else}
            <FontAwesomeIcon
              class="text-orange-500 me-1 w-4 h-4"
              icon={faBell}
            />
          {/if}
          Alerts
        </NavLi>
      </div>
    {:else}
      <NavLi href="/statistics">
        <FontAwesomeIcon class="me-1 w-4 h-4" icon={faChartSimple} />
        Statistics
      </NavLi>
      <NavLi href="/about">
        <FontAwesomeIcon class="me-1 w-4 h-4" icon={faCircleInfo} />
        About
      </NavLi>
    {/if}

    <!-- Auth actions as part of regular nav -->
    <NavLi class="lg:ml-auto">
      {#if $session}
        <form
          action="/auth/logout"
          method="POST"
          use:enhance={() => {
            session.set(null);
            return goto("/auth/logout");
          }}
        >
          <Button outline class="bg-white dark:bg-inherit" type="submit">
            <FontAwesomeIcon class="me-1 w-4 h-4" icon={faRightFromBracket} />
            Sign Out
          </Button>
        </form>
      {:else}
        <Button outline class="bg-white dark:bg-inherit" href="/auth/login">
          <FontAwesomeIcon class="me-1 w-4 h-4" icon={faKey} />
          Sign In
        </Button>
      {/if}
    </NavLi>

    <!-- Mobile-only DarkMode toggle with label -->
    <NavLi class="lg:hidden">
      <div class="flex items-center gap-2">
        <FontAwesomeIcon class="me-1 w-4 h-4" icon={faSun} />
        Switch Mode
      </div>
      <DarkMode
        class="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xl"
      />
    </NavLi>
  </NavUl>
</Navbar>

<div class="relative w-full h-[2px]">
  <div
    class="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500 to-transparent h-[2px]"
  ></div>
</div>
