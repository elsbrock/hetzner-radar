<script>
    import { faDiscord, faGithub } from "@fortawesome/free-brands-svg-icons";
    import {
            faCoffee,
            faEnvelope,
            faHandsHelping,
            faInfoCircle,
            faRocket,
        } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button, Card } from "flowbite-svelte";
</script>

<div>
    <div class="max-w-4xl mx-auto p-8">
        <h1 class="text-4xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">
            Contact Us
        </h1>

        <!-- Introduction Section -->
        <div class="mb-12 text-center">
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-5">
                Thank you for your interest in Server Radar! We're passionate
                individuals dedicated to providing valuable tools for the
                community. Whether you have questions, feedback, or just want to
                say hello, we'd love to hear from you.
            </p>
            <p class="text-lg text-gray-600 dark:text-gray-400">
                Your support and feedback help me improve and continue
                developing this project. Feel free to reach out through any of
                the methods below.
            </p>
        </div>

        <!-- Contact Methods Section -->
        <section class="grid grid-cols-1 gap-8 md:grid-cols-3">
            <!-- Email Contact Card -->
            <Card
                class="flex flex-col items-center text-center shadow-lg justify-between dark:bg-gray-800"
            >
                <div>
                    <FontAwesomeIcon
                        icon={faEnvelope}
                        size="3x"
                        class="text-blue-500 dark:text-blue-400 mb-4"
                    />
                    <h3 class="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        Email Us
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Have questions or need support? Reach out to us via
                        email, and I'll get back to you as soon as possible.
                    </p>
                </div>
                <Button
                    href="mailto:mail@radar.iodev.org"
                    color="primary"
                    class="w-full"
                >
                    <FontAwesomeIcon icon={faEnvelope} class="mr-2" />
                    Send Email
                </Button>
            </Card>

            <!-- GitHub Sponsorship Card -->
            <Card
                class="flex flex-col items-center text-center shadow-lg justify-between dark:bg-gray-800"
            >
                <div>
                    <FontAwesomeIcon
                        icon={faHandsHelping}
                        size="3x"
                        class="text-green-500 dark:text-green-400 mb-4"
                    />
                    <h3 class="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        Support Us
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        If you appreciate what we do and would like to support
                        the project, consider becoming a sponsor on GitHub. Your
                        support helps us maintain and improve Server Radar.
                    </p>
                </div>

                <Button
                    href="https://github.com/sponsors/elsbrock"
                    color="alternative"
                    class="w-full"
                >
                    <FontAwesomeIcon icon={faRocket} class="h-5 w-5 mr-2" />
                    Sponsor on Github
                </Button>
            </Card>

            <!-- Buy Me a Coffee Card -->
            <Card
                class="flex flex-col items-center text-center shadow-lg justify-between dark:bg-gray-800"
            >
                <div>
                    <FontAwesomeIcon
                        icon={faCoffee}
                        size="3x"
                        class="text-amber-500 dark:text-amber-400 mb-4"
                    />
                    <h3 class="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        Buy Me a Coffee
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Enjoy using Server Radar? Consider buying me a coffee to fuel
                        future development and show your appreciation for this project.
                    </p>
                </div>

                <Button
                    href="https://www.buymeacoffee.com/elsbrock"
                    color="yellow"
                    class="w-full"
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
                class="text-gray-500 dark:text-gray-400 mb-4"
            />
            <h2 class="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                More Ways to Connect
            </h2>
            <p class="text-gray-600 dark:text-gray-400 mb-6">
                Join our Discord community for real-time discussions, or use GitHub Discussions for longer-form conversations.
                Stay updated with the latest developments and engage with the community!
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
