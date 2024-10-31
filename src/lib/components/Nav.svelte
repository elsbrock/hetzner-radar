<script lang="ts">
	import { Button, Navbar, NavBrand, NavHamburger, NavLi, NavUl } from 'flowbite-svelte';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
  	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { page } from '$app/stores';
  import { faChartSimple } from '@fortawesome/free-solid-svg-icons';
  import Radar from './Radar.svelte';
	$: activeUrl = $page.url.pathname;
</script>

<Navbar class="h-15 w-full border-b border-gray-200">
	<NavBrand href="/">
			<div style="width: 32px; height: 32px">
					<Radar />
			</div>
			<p class="self-center whitespace-nowrap text-xl font-semibold dark:text-white ml-5">Server Radar</p>
	</NavBrand>

	<!-- Contribute Button for Desktop -->
	<div class="hidden md:flex md:order-2">
			<Button size="sm" href="https://github.com/elsbrock/hetzner-radar">
					<FontAwesomeIcon class="w-5 h-5 me-2" icon={faGithub} /> Contribute
			</Button>
	</div>

	<!-- Analyze Button and Hamburger for Mobile -->
	<div class="flex md:order-2 md:hidden">
			<Button size="sm" href="/analyze">
					<FontAwesomeIcon class="w-5 h-5 me-2" icon={faChartSimple} /> Analyze
			</Button>
			<NavHamburger />
	</div>

	<NavUl class="order-1" {activeUrl}>
			<NavLi href="/">Home</NavLi>
			<NavLi href="/configurations">Configurations</NavLi>
			<NavLi href="/analyze">
					<FontAwesomeIcon class="me-2" icon={faChartSimple} /> Analyze
			</NavLi>
			<NavLi href="/statistics">Statistics</NavLi>
			<!-- Optional: Include "Contribute" in the menu -->
			<!--
			<NavLi href="https://github.com/elsbrock/hetzner-radar">
					<FontAwesomeIcon class="me-2" icon={faGithub} /> Contribute
			</NavLi>
			-->
			<NavLi href="/about">About</NavLi>
	</NavUl>
</Navbar>
