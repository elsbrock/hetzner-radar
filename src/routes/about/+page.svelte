<script>
	import { faDatabase, faChartLine, faTools, faInfoCircle, faSpaceShuttle, faLightbulb, faUser } from '@fortawesome/free-solid-svg-icons';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
</script>

<main class="p-8 bg-gray-50">
	<section class="mx-auto my-12 max-w-7xl text-center">
		<h1 class="mb-6 text-5xl font-extrabold text-gray-800">About Server Radar</h1>
	</section>

	<div class="max-w-4xl mx-auto pb-8">
		<!-- Introduction Section -->
		<div class="mb-12 text-center">
				<p class="text-lg text-gray-600 mb-5">
						Server Radar is your go-to tool for finding the best deals on Hetzner Dedicated Servers. Whether you're a developer, system administrator, or just someone looking to optimize your server purchases, Server Radar provides you with the insights and data you need to make informed decisions.
				</p>
				<p class="text-lg text-gray-600">
						Built with passion and dedication, Server Radar aims to simplify the process of tracking server prices, analyzing trends, and ensuring you get the best value for your investment.
				</p>
		</div>

		<!-- Who Are We Section -->
		<section class="mb-12">
				<h2 class="text-3xl font-semibold text-gray-800 mb-6 text-center">Who Are We</h2>
				<div class="flex flex-col items-center md:flex-row md:space-x-8 text-justif bg-white p-6 rounded-lg shadow-md">
						<!-- Profile Image -->
						<img src="/images/operator.png" alt="Profile Picture of Simon"
						class="w-48 h-48 rounded-full mb-6 md:mb-0 drop-shadow-lg" />
						<!-- About Text -->
						<div class="text-justify">
								<p class="text-gray-600 mb-4">
										Hi, I'm Simon – the creator and maintainer of Server Radar.
										With a background in software engineering and a keen
										interest in running my own servers, I embarked on this project to bridge the gap
										between Hetzner Auctions and users seeking the best deals.
								</p>
								<p class="text-gray-600">
										As a passionate developer, I believe in the power of open-source projects to foster community collaboration and innovation. Server Radar is not just a tool; it's a community-driven project aimed at empowering users with the data and insights they need to make smarter server purchasing decisions.
								</p>
						</div>
				</div>
		</section>

		<!-- Call to Action Section -->
		<section class="text-center">
				<p class="text-lg text-gray-600 mb-6">
						Whether you're looking to contribute to the project, suggest new features, or simply want to stay updated with the latest developments, there are plenty of ways to get involved!
				</p>
				<div class="flex justify-center space-x-4">
						<Button href="https://github.com/elsbrock/hetzner-radar" class="shadow-sm">
								<FontAwesomeIcon icon={faGithub} class="mr-2" />
								Visit Our GitHub
						</Button>
						<Button href="/contact" color="alternative" class="shadow-sm">
								<FontAwesomeIcon icon={faUser} class="mr-2" />
								Contact
						</Button>
				</div>
		</section>
	</div>
</main>
