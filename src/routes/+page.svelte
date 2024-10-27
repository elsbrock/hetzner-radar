<script>
	import { Card, Button } from 'flowbite-svelte';
	import {
		faChartLine,
		faMagnifyingGlassChart,
		faFilter,
		faEye,
		faChartPie,
		faHandHoldingDollar,
		faForwardStep,
		faUsers,
	} from '@fortawesome/free-solid-svg-icons';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import Radar from '$lib/components/Radar.svelte';
</script>

<main class="min-h-screen p-8 bg-gray-50">
	<!-- Hero Section -->
	<section class="mx-auto my-12 max-w-7xl text-center">
		<h1 class="mb-6 text-5xl font-extrabold text-gray-800">Find the Best Deals on Hetzner Dedicated Servers</h1>
		<p class="text-lg text-gray-600 mb-10">
			<strong>Server Radar</strong> monitors Hetzner Auctions' prices, providing valuable insights to help you navigate the marketplace confidently. Track daily price updates, analyze server configurations, and make informed decisions effortlessly.
		</p>
		<div class="flex justify-center space-x-4">
			<Button color="primary" href="/analyze" class="px-8 py-4 text-xl">Start Analyzing</Button>
			<Button color="light" href="/about" class="px-8 py-4 text-xl">Learn More</Button>
		</div>
	</section>
	
	<!-- Features Section -->
	<section id="features" class="mx-auto my-10 max-w-7xl">
		<h2 class="mb-10 text-center text-4xl font-semibold text-gray-800">Key Features</h2>
		<div class="grid grid-cols-1 justify-items-center gap-x-4 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
			<Card class="flex flex-col items-center text-center shadow-lg">
				<FontAwesomeIcon class="mb-4 text-blue-500" icon={faChartLine} size="2x" />
				<h3 class="mb-4 text-2xl font-bold text-gray-800">Price History Tracking</h3>
				<p class="text-gray-600">
					Monitor price trends over time for specific server configurations to ensure you get the best deal.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center shadow-lg">
				<FontAwesomeIcon class="mb-4 text-blue-500" icon={faMagnifyingGlassChart} size="2x" />
				<h3 class="mb-4 text-2xl font-bold text-gray-800">Best Price Analysis</h3>
				<p class="text-gray-600">
					Instantly see the best price ever offered for any server configuration in the auction.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center shadow-lg">
				<FontAwesomeIcon class="mb-4 text-blue-500" icon={faFilter} size="2x" />
				<h3 class="mb-4 text-2xl font-bold text-gray-800">Advanced Filtering</h3>
				<p class="text-gray-600">
					Filter servers by precise specs, such as exact disk configurations, ensuring you find exactly what you need.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center shadow-lg">
				<FontAwesomeIcon class="mb-4 text-blue-500" icon={faEye} size="2x" />
				<h3 class="mb-4 text-2xl font-bold text-gray-800">Availability Tracking</h3>
				<p class="text-gray-600">
					Keep track of how often your preferred configurations are available and their historical availability.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center shadow-lg">
				<FontAwesomeIcon class="mb-4 text-blue-500" icon={faChartPie} size="2x" />
				<h3 class="mb-4 text-2xl font-bold text-gray-800">Datacenter Insights</h3>
				<p class="text-gray-600">
					Analyze server availability and pricing trends by datacenter location, helping you optimize latency.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center shadow-lg">
				<FontAwesomeIcon class="mb-4 text-blue-500" icon={faHandHoldingDollar} size="2x" />
				<h3 class="mb-4 text-2xl font-bold text-gray-800">Price per Component</h3>
				<p class="text-gray-600">
					Break down prices by RAM, storage type, and more to make informed purchasing decisions.
				</p>
			</Card>
		</div>
	</section>

	<!-- How It Works Section -->
	<section id="how-it-works" class="mx-auto my-10 max-w-7xl">
		<h2 class="mb-10 text-center text-4xl font-semibold text-gray-800">How It Works</h2>
		<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
			<Card class="flex flex-col items-center text-center shadow-lg h-full">
				<FontAwesomeIcon class="mb-4 text-green-500" icon={faForwardStep} size="2x" />
				<h3 class="mb-4 text-2xl font-bold text-gray-800">Step 1: Select Your Preferences</h3>
				<p class="text-gray-600">
					Choose the server specifications that meet your needs, including RAM, storage, and datacenter location.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center shadow-lg h-full">
				<FontAwesomeIcon class="mb-4 text-green-500" icon={faChartLine} size="2x" />
				<h3 class="mb-4 text-2xl font-bold text-gray-800">Step 2: Analyze Price Trends and History</h3>
				<p class="text-gray-600">
					Utilize our analytics tools to review price histories and availability trends for your selected configurations.
				</p>
			</Card>

			<Card class="flex flex-col items-center text-center shadow-lg h-full">
				<FontAwesomeIcon class="mb-4 text-green-500" icon={faUsers} size="2x" />
				<h3 class="mb-4 text-2xl font-bold text-gray-800">Step 3: Make Informed Decisions</h3>
				<p class="text-gray-600">
					Leverage the insights gained to purchase servers at the optimal price and configuration.
				</p>
			</Card>
		</div>
	</section>

	<!-- Testimonials Section -->
	<section id="testimonials" class="mx-auto my-10 max-w-7xl">
		<h2 class="mb-10 text-center text-4xl font-semibold text-gray-800">What Our Users Say</h2>
		<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
			<Card class="shadow-lg">
				<p class="mb-4 text-gray-600">
					"Server Radar has been instrumental in helping me find the best deals on Hetzner servers. The price tracking feature is a game-changer!"
				</p>
				<div class="flex items-center">
					<img src="/images/user1.jpg" alt="Alex Johnson" class="w-12 h-12 rounded-full mr-4" loading="lazy"/>
					<div>
						<p class="text-gray-800 font-semibold">Alex Johnson</p>
						<p class="text-gray-500 text-sm">Web Developer</p>
					</div>
				</div>
			</Card>

			<Card class="shadow-lg">
				<p class="mb-4 text-gray-600">
					"Thanks to Server Radar, I've been able to optimize my server purchases and save a significant amount of money. Highly recommended!"
				</p>
				<div class="flex items-center">
					<img src="/images/user2.jpg" alt="Maria Lopez" class="w-12 h-12 rounded-full mr-4" loading="lazy"/>
					<div>
						<p class="text-gray-800 font-semibold">Maria Lopez</p>
						<p class="text-gray-500 text-sm">System Administrator</p>
					</div>
				</div>
			</Card>

			<Card class="shadow-lg">
				<p class="mb-4 text-gray-600">
					"The advanced filtering options make it easy to find exactly what I need. Server Radar is an invaluable tool for anyone serious about server management."
				</p>
				<div class="flex items-center">
					<img src="/images/user3.jpg" alt="Liam Smith" class="w-12 h-12 rounded-full mr-4" loading="lazy"/>
					<div>
						<p class="text-gray-800 font-semibold">Liam Smith</p>
						<p class="text-gray-500 text-sm">IT Consultant</p>
					</div>
				</div>
			</Card>
		</div>
	</section>

	<!-- Open Source Commitment Section -->
	<section id="open-source" class="mx-auto my-20 max-w-7xl text-center bg-white shadow-lg rounded-lg md:p-8 overflow-hidden">
		<!-- Heading -->
		<h2 class="mb-6 text-4xl font-semibold text-gray-800">Open Source Commitment</h2>

		<!-- Image and content container -->
		<div class="relative">
			<!-- Background Image -->
			<img src="/images/code.png" alt="GitHub Repository" class="w-full h-64
			object-cover" style="opacity: 0.3;" loading="lazy" />

			<!-- Gradient Overlay -->
			<div class="absolute inset-0" style="background: linear-gradient(to bottom, white 5%, transparent 15%, transparent 15%, white 100%);"></div>

			<!-- Content over image -->
			<div class="absolute inset-0 flex flex-col items-center justify-center p-4">
				<p class="mx-20 mb-4 text-gray-700">
					Server Radar is proudly open-source. We believe in transparency and community collaboration to continuously improve our tool. Explore our code, contribute to the project, or suggest new features on GitHub.
				</p>
				<Button color="secondary" href="https://github.com/elsbrock/hetzner-radar" class="px-6 pb-3 text-lg flex items-center justify-center">
					<FontAwesomeIcon icon={faGithub} class="mr-2" />
					View on GitHub
				</Button>
			</div>
		</div>
	</section>

	<!-- Contact & Support Section -->
	<section id="contact" class="mx-auto mt-10 max-w-7xl text-center">
		<h2 class="mb-6 text-4xl font-semibold text-gray-800">Get in Touch</h2>
		<p class="mb-8 text-gray-600">
			Have questions or need support? We'd love to hear from you! Reach out to us through our channels below.
		</p>
		<div class="flex justify-center space-x-4">
			<Button color="light" href="/contact" class="px-6 py-3 text-lg flex items-center">
				Contact Us
			</Button>
			<Button color="light" href="https://github.com/elsbrock/hetzner-radar/issues" class="px-6 py-3 text-lg flex items-center">
				Report an Issue
			</Button>
		</div>
	</section>
</main>
