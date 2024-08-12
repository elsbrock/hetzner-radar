<script>
	import { Card, Button } from 'flowbite-svelte';
	import {
		faChartLine,
		faMagnifyingGlassChart,
		faFilter,
		faEye,
		faChartPie,
		faHandHoldingDollar
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<main class="min-h-screen p-8">
	<!-- Hero Section -->
	<section class="mx-auto my-12 max-w-7xl text-center">
		<h2 class="mb-4 text-5xl font-extrabold">Find the Best Deal on Hetzner Dedicated Servers</h2>
		<p class="text-lg text-gray-400">
			Server Radar monitors the prices of Hetzner Auctions, offering valuable insights to help you
			navigate the marketplace with confidence. By tracking daily price updates and analyzing server
			configurations, Server Radar equips you with the knowledge needed to make informed decisions.
			Whether you’re looking for the best deal or specific server specs, our tool ensures you stay
			ahead of the curve without missing out on opportunities.
		</p>
		<Button color="primary" href="/search" class="mt-8 px-8 py-4 text-xl">Start Analyzing</Button>
	</section>

	<!-- Features Section -->
	<section id="features" class="mx-auto my-10 max-w-7xl">
		<h3 class="mb-10 text-center text-4xl font-semibold">Key Features</h3>
		<div
			class="grid grid-cols-1 justify-items-center gap-x-2 gap-y-8 md:grid-cols-2 lg:grid-cols-3"
		>
			<Card class="flex flex-col items-center text-center">
				<h4 class="mb-4 text-2xl font-bold">
					<FontAwesomeIcon class="me-2" icon={faChartLine} />
					Price History Tracking
				</h4>
				<p class="text-gray-400">
					Monitor price trends over time for specific server configurations to ensure you get the
					best deal.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center">
				<h4 class="mb-4 text-2xl font-bold">
					<FontAwesomeIcon class="me-2" icon={faMagnifyingGlassChart} />
					Best Price Analysis
				</h4>
				<p class="text-gray-400">
					Instantly see the best price ever offered for any server configuration in the auction.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center">
				<h4 class="mb-4 text-2xl font-bold">
					<FontAwesomeIcon class="me-2" icon={faFilter} />
					Advanced Filtering
				</h4>
				<p class="text-gray-400">
					Filter servers by precise specs, such as exact disk configurations, ensuring you find
					exactly what you need.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center">
				<h4 class="mb-4 text-2xl font-bold">
					<FontAwesomeIcon class="me-2" icon={faEye} />
					Availability Tracking
				</h4>
				<p class="text-gray-400">
					Keep track of how often your preferred configurations are available and their historical
					availability.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center">
				<h4 class="mb-4 text-2xl font-bold">
					<FontAwesomeIcon class="me-2" icon={faChartPie} />
					Datacenter Insights
				</h4>
				<p class="text-gray-400">
					Analyze server availability and pricing trends by datacenter location, helping you
					optimize latency.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center">
				<h4 class="mb-4 text-2xl font-bold">
					<FontAwesomeIcon class="me-2" icon={faHandHoldingDollar} />
					Price per Component
				</h4>
				<p class="text-gray-400">
					Break down prices by RAM, storage type, and more to make informed purchasing decisions.
				</p>
			</Card>
		</div>
	</section>

	<!-- Disclaimer Section -->
	<section id="disclaimer" class="my-16">
		<h3 class="mb-10 text-center text-3xl font-semibold">Disclaimer</h3>
		<div class="mx-auto max-w-4xl text-center text-gray-400">
			<p class="mb-4">
				This tool is independently developed with the intention of helping users make informed
				decisions when participating in the Hetzner auction. Data is collected and visualized for
				personal use only, and no sales or promotions are linked to this site.
			</p>
			<p class="mb-4">
				By using this tracker, you're better equipped to find the best deals, ultimately benefiting
				both you and Hetzner through potentially increased sales.
			</p>
			<p>
				Data is updated daily and retained for a period of 3 months. If you have any concerns,
				please reach out. We are committed to transparency and fairness.
			</p>
		</div>
	</section>
</main>
