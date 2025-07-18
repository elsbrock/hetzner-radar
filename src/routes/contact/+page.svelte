<script>
	import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
	import {
		faCoffee,
		faEnvelope,
		faHandsHelping,
		faInfoCircle,
		faRocket
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button, Card } from 'flowbite-svelte';
</script>

<div>
	<div class="mx-auto max-w-4xl p-8">
		<h1 class="mb-6 text-center text-4xl font-bold text-gray-800 dark:text-gray-100">Contact Us</h1>

		<!-- Introduction Section -->
		<div class="mb-12 text-center">
			<p class="mb-5 text-base text-gray-600 dark:text-gray-400">
				Thank you for your interest in Server Radar! We're passionate individuals dedicated to
				providing valuable tools for the community. Whether you have questions, feedback, or just
				want to say hello, we'd love to hear from you.
			</p>
			<p class="text-base text-gray-600 dark:text-gray-400">
				Your support and feedback help me improve and continue developing this project. Feel free to
				reach out through any of the methods below.
			</p>
		</div>

		<!-- Contact Methods Section -->
		<section class="grid grid-cols-1 gap-8 md:grid-cols-3">
			<!-- Email Contact Card -->
			<Card
				class="flex flex-col items-center justify-between text-center shadow-lg dark:bg-gray-800"
			>
				<div>
					<FontAwesomeIcon
						icon={faEnvelope}
						size="3x"
						class="mb-4 text-blue-500 dark:text-blue-400"
					/>
					<h3 class="mb-2 text-2xl font-semibold text-gray-800 dark:text-gray-100">Email Us</h3>
					<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
						Have questions or need support? Reach out to us via email, and I'll get back to you as
						soon as possible.
					</p>
				</div>
				<Button href="mailto:mail@radar.iodev.org" color="primary" class="w-full">
					<FontAwesomeIcon icon={faEnvelope} class="mr-2" />
					Send Email
				</Button>
			</Card>

			<!-- GitHub Sponsorship Card -->
			<Card
				class="flex flex-col items-center justify-between text-center shadow-lg dark:bg-gray-800"
			>
				<div>
					<FontAwesomeIcon
						icon={faHandsHelping}
						size="3x"
						class="mb-4 text-green-500 dark:text-green-400"
					/>
					<h3 class="mb-2 text-2xl font-semibold text-gray-800 dark:text-gray-100">Support Us</h3>
					<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
						If you appreciate what we do and would like to support the project, consider becoming a
						sponsor on GitHub. Your support helps us maintain and improve Server Radar.
					</p>
				</div>

				<Button href="https://github.com/sponsors/elsbrock" color="alternative" class="w-full">
					<FontAwesomeIcon icon={faRocket} class="mr-2 h-5 w-5" />
					Sponsor on Github
				</Button>
			</Card>

			<!-- Buy Me a Coffee Card -->
			<Card
				class="flex flex-col items-center justify-between text-center shadow-lg dark:bg-gray-800"
			>
				<div>
					<FontAwesomeIcon
						icon={faCoffee}
						size="3x"
						class="mb-4 text-amber-500 dark:text-amber-400"
					/>
					<h3 class="mb-2 text-2xl font-semibold text-gray-800 dark:text-gray-100">
						Buy Me a Coffee
					</h3>
					<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
						Enjoy using Server Radar? Consider buying me a coffee to fuel future development and
						show your appreciation for this project.
					</p>
				</div>

				<Button
					href="https://www.buymeacoffee.com/elsbrock"
					color="yellow"
					class="w-full dark:border-amber-600 dark:bg-amber-600 dark:text-white dark:hover:bg-amber-700"
				>
					<FontAwesomeIcon icon={faCoffee} class="mr-2" />
					Buy Me a Coffee
				</Button>
			</Card>
		</section>

		<!-- Additional Information Section -->
		<section class="mt-12 text-center">
			<FontAwesomeIcon
				icon={faInfoCircle}
				size="2x"
				class="mb-4 text-gray-500 dark:text-gray-400"
			/>
			<h2 class="mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
				More Ways to Connect
			</h2>
			<p class="mb-6 text-gray-600 dark:text-gray-400">
				Join our Discord community for real-time discussions, or use GitHub Discussions for
				longer-form conversations. Stay updated with the latest developments and engage with the
				community!
			</p>
			<div class="flex justify-center space-x-4">
				<Button
					href="https://discord.gg/dcuGfURbdc"
					color="primary"
					size="lg"
					class="flex items-center"
				>
					<FontAwesomeIcon icon={faDiscord} class="mr-2" />
					Join Discord
				</Button>
				<Button
					href="https://github.com/elsbrock/hetzner-radar/discussions"
					color="light"
					size="lg"
					class="flex items-center"
				>
					<FontAwesomeIcon icon={faGithub} class="mr-2" />
					GitHub Discussions
				</Button>
			</div>
		</section>
	</div>
</div>
