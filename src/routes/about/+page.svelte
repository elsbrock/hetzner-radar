<script>
	import { faDatabase, faChartLine, faTools, faInfoCircle, faSpaceShuttle, faLightbulb, faUser } from '@fortawesome/free-solid-svg-icons';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<div class="max-w-4xl mx-auto p-8">
	<h1 class="text-4xl font-bold mb-6 text-center text-gray-800">About Server Radar</h1>

	<!-- Introduction Section -->
	<div class="mb-12 text-center">
			<p class="text-lg text-gray-600 mb-5">
					**Server Radar** is your go-to tool for finding the best deals on Hetzner Dedicated Servers. Whether you're a developer, system administrator, or just someone looking to optimize your server purchases, Server Radar provides you with the insights and data you need to make informed decisions.
			</p>
			<p class="text-lg text-gray-600">
					Built with passion and dedication, Server Radar aims to simplify the process of tracking server prices, analyzing trends, and ensuring you get the best value for your investment.
			</p>
	</div>

	<!-- Who Are We Section -->
	<section class="mb-12">
			<h2 class="text-3xl font-semibold text-gray-800 mb-6 text-center">Who Are We</h2>
			<div class="flex flex-col items-center md:flex-row md:space-x-8">
					<!-- Profile Image -->
					<img src="/images/operator.png" alt="Profile Picture of Simon" class="w-48 h-48 rounded-full mb-6 md:mb-0" />
					<!-- About Text -->
					<div>
							<p class="text-gray-600 mb-4">
									Hi, I'm Simon – the creator and maintainer of Server Radar. With a background in web development and a keen interest in server management, I embarked on this project to bridge the gap between server providers and users seeking the best deals.
							</p>
							<p class="text-gray-600">
									As a passionate developer, I believe in the power of open-source projects to foster community collaboration and innovation. Server Radar is not just a tool; it's a community-driven project aimed at empowering users with the data and insights they need to make smarter server purchasing decisions.
							</p>
					</div>
			</div>
	</section>

	<!-- Mission & Vision Section -->
	<section class="mb-12">
			<h2 class="text-3xl font-semibold text-gray-800 mb-6 text-center">Our Mission & Vision</h2>
			<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
					<!-- Mission Card -->
					<div class="flex flex-col items-center text-center bg-white p-6 rounded-lg shadow-lg">
							<FontAwesomeIcon icon={faSpaceShuttle} size="3x" class="text-blue-500 mb-4" />
							<h3 class="text-2xl font-semibold text-gray-800 mb-2">Our Mission</h3>
							<p class="text-gray-600">
								To provide accurate and up-to-date server pricing information, enabling users to make informed decisions when purchasing Hetzner Dedicated Servers.
							</p>
					</div>

					<!-- Vision Card -->
					<div class="flex flex-col items-center text-center bg-white p-6 rounded-lg shadow-lg">
							<FontAwesomeIcon icon={faLightbulb} size="3x" class="text-green-500 mb-4" />
							<h3 class="text-2xl font-semibold text-gray-800 mb-2">Our Vision</h3>
							<p class="text-gray-600">
								To create a reliable resource for tracking server prices and identifying the best deals, supporting users in making cost-effective decisions for their server needs.
							</p>
					</div>
			</div>
	</section>

	<!-- How It Works Section -->
	<section class="mb-12">
			<h2 class="text-3xl font-semibold text-gray-800 mb-6 text-center">How It Works</h2>
			<div class="space-y-8">
					<!-- Data Collection -->
					<div class="flex flex-col items-center bg-white p-6 rounded-lg shadow-md">
							<FontAwesomeIcon icon={faDatabase} size="3x" class="text-blue-500 mb-4" aria-hidden="true" />
							<h3 class="text-2xl font-semibold text-gray-800 mb-2">Data Collection</h3>
							<p class="text-gray-600 text-center">
									Every hour, we collect data from the Hetzner auction API, including server model, price, location, and other relevant details. This data is stored in our database and used to generate graphs and statistics, allowing you to understand trends and make better purchasing decisions.
							</p>
					</div>

					<!-- Data Management -->
					<div class="flex flex-col items-center bg-white p-6 rounded-lg shadow-md">
							<FontAwesomeIcon icon={faChartLine} size="3x" class="text-green-500 mb-4" aria-hidden="true" />
							<h3 class="text-2xl font-semibold text-gray-800 mb-2">Data Management</h3>
							<p class="text-gray-600 text-center">
									Data is updated hourly and retained for three months, enabling you to view historical trends and make comparisons over time. We also offer tools to filter and search the data, helping you find the servers that best meet your needs.
							</p>
					</div>

					<!-- Data Analysis -->
					<div class="flex flex-col items-center bg-white p-6 rounded-lg shadow-md">
							<FontAwesomeIcon icon={faTools} size="3x" class="text-blue-500 mb-4" aria-hidden="true" />
							<h3 class="text-2xl font-semibold text-gray-800 mb-2">Data Analysis</h3>
							<p class="text-gray-600 text-center">
									In addition to auction data, we gather information on server configurations and prices, letting you compare average prices for different server types against auction prices. Our comparison tool further helps you evaluate how different server prices stack up, so you can secure the best deal and save money.
							</p>
					</div>

					<!-- Statistical Insights -->
					<div class="flex flex-col items-center bg-white p-6 rounded-lg shadow-md">
							<FontAwesomeIcon icon={faChartLine} size="3x" class="text-green-500 mb-4" aria-hidden="true" />
							<h3 class="text-2xl font-semibold text-gray-800 mb-2">Statistical Insights</h3>
							<p class="text-gray-600 text-center">
									We also provide statistics on price trends for RAM, SSD, and HDD storage, helping you identify trends and determine the optimal time to purchase storage-heavy configurations.
							</p>
					</div>

					<!-- Our Goal -->
					<div class="flex flex-col items-center bg-white p-6 rounded-lg shadow-md">
							<FontAwesomeIcon icon={faInfoCircle} size="3x" class="text-blue-500 mb-4" aria-hidden="true" />
							<h3 class="text-2xl font-semibold text-gray-800 mb-2">Our Goal</h3>
							<p class="text-gray-600 text-center">
									Our goal is to equip you with the information needed to secure the best deals on Hetzner servers, whether you're seeking a budget option or a high-performance machine.
							</p>
					</div>
			</div>
	</section>

	<!-- Call to Action Section -->
	<section class="mb-12 text-center">
			<p class="text-lg text-gray-600 mb-6">
					Whether you're looking to contribute to the project, suggest new features, or simply want to stay updated with the latest developments, there are plenty of ways to get involved!
			</p>
			<div class="flex justify-center space-x-4">
					<a href="https://github.com/elsbrock/hetzner-radar" class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded flex items-center">
							<FontAwesomeIcon icon={faGithub} class="mr-2" />
							Visit Our GitHub
					</a>
					<a href="mailto:simon+radar@iodev.org" class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded flex items-center">
							<FontAwesomeIcon icon={faUser} class="mr-2" />
							Contact Simon
					</a>
			</div>
	</section>
</div>
