<script lang="ts">
	import { Button, Navbar, NavBrand, NavHamburger, NavLi, NavUl, Badge } from 'flowbite-svelte';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
  	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { page } from '$app/stores';
  import { faHouse, faChartSimple, faServer, faBinoculars, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
  import Radar from './Radar.svelte';
	$: activeUrl = $page.url.pathname;
</script>

<Navbar class="h-15 w-full border-b border-gray-200">
	<NavBrand href="/">
			<div style="width: 32px; height: 32px">
					<Radar />
			</div>
			<div class="ml-5 leading-none -mt-1">
				<p class="self-center whitespace-nowrap text-xl font-semibold
			dark:text-white">Server Radar <Badge>beta</Badge></p>
			<span class="text-xs text-gray-500 dark:text-gray-400">The Hetzner Auction
			Price Tracker.</span></div>
	</NavBrand>

	<!-- Contribute Button for Desktop -->
	<div class="hidden md:flex md:order-2">
			<Button size="sm" href="https://github.com/elsbrock/hetzner-radar">
					<FontAwesomeIcon class="w-5 h-5 me-1" icon={faGithub} /> Contribute
			</Button>
	</div>

	<!-- Analyze Button and Hamburger for Mobile -->
	<div class="flex md:order-2 md:hidden">
			<Button size="xs" href="/analyze">
					<FontAwesomeIcon class="w-5 h-5 me-2" icon={faBinoculars} /> Analyze
			</Button>
			<NavHamburger />
	</div>

	<NavUl class="order-1" {activeUrl}>
			<NavLi href="/">
				<FontAwesomeIcon class="me-1" icon={faHouse} />
				Home
			</NavLi>
			<NavLi href="/configurations">
				<FontAwesomeIcon class="me-1" icon={faServer} />
				Configurations
			</NavLi>
			<NavLi href="/analyze">
					<FontAwesomeIcon class="me-1" icon={faBinoculars} /> Analyze
			</NavLi>
			<NavLi href="/statistics">
					<FontAwesomeIcon class="me-1" icon={faChartSimple} /> Statistics
			</NavLi>
			<!-- Optional: Include "Contribute" in the menu -->
			<!--
			<NavLi href="https://github.com/elsbrock/hetzner-radar">
					<FontAwesomeIcon class="me-2" icon={faGithub} /> Contribute
			</NavLi>
			-->
			<NavLi href="/about">
				<FontAwesomeIcon class="me-1" icon={faCircleInfo} /> About</NavLi>
	</NavUl>
</Navbar>
