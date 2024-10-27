<script>
    import { Card, Button } from 'flowbite-svelte';
    import { faEnvelope, faHandsHelping, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
    import { faGithub } from '@fortawesome/free-brands-svg-icons';
    import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<div class="p-8 bg-gray-50">
    <div class="max-w-4xl mx-auto p-8">
        <h1 class="text-4xl font-bold mb-6 text-center text-gray-800">Contact Us</h1>

        <!-- Introduction Section -->
        <div class="mb-12 text-center">
            <p class="text-lg text-gray-600 mb-5">
                Thank you for your interest in Server Radar! I'm a passionate individual dedicated to providing valuable tools for the community. Whether you have questions, feedback, or just want to say hello, I'd love to hear from you.
            </p>
            <p class="text-lg text-gray-600">
                Your support and feedback help me improve and continue developing this project. Feel free to reach out through any of the methods below.
            </p>
        </div>

        <!-- Contact Methods Section -->
        <section class="grid grid-cols-1 gap-8 md:grid-cols-2">
            <!-- Email Contact Card -->
            <Card class="flex flex-col items-center text-center shadow-lg">
                <FontAwesomeIcon icon={faEnvelope} size="3x" class="text-blue-500 mb-4" />
                <h3 class="text-2xl font-semibold text-gray-800 mb-2">Email Us</h3>
                <p class="text-gray-600 mb-4">
                    Have questions or need support? Reach out to us via email, and I'll get back to you as soon as possible.
                </p>
                <Button href="mailto:simon+radar@iodev.org" color="primary" class="w-full">
                    <FontAwesomeIcon icon={faEnvelope} class="mr-2" />
                    Send Email
                </Button>
            </Card>

            <!-- GitHub Sponsorship Card -->
            <Card class="flex flex-col items-center text-center shadow-lg">
                <FontAwesomeIcon icon={faHandsHelping} size="3x" class="text-green-500 mb-4" />
                <h3 class="text-2xl font-semibold text-gray-800 mb-2">Support Us</h3>
                <p class="text-gray-600 mb-4">
                    If you appreciate what we do and would like to support the project, consider becoming a sponsor on GitHub. Your support helps us maintain and improve Server Radar.
                </p>
                <Button href="https://github.com/sponsors/elsbrock/" color="secondary" class="w-full">
                    <FontAwesomeIcon icon={faGithub} class="mr-2" />
                    Sponsor on GitHub
                </Button>
            </Card>
        </section>

        <!-- Additional Information Section -->
        <section class="mt-12 text-center">
            <FontAwesomeIcon icon={faInfoCircle} size="2x" class="text-gray-500 mb-4" />
            <h2 class="text-3xl font-semibold text-gray-800 mb-4">More Ways to Connect</h2>
            <p class="text-gray-600 mb-6">
                You can also discuss on Github. Stay updated with the latest developments and engage with the community!
            </p>
            <div class="flex justify-center space-x-4">
                <Button href="https://github.com/elsbrock/hetzner-radar/discussions" color="light" class="flex items-center">
                    <FontAwesomeIcon icon={faGithub} class="mr-2" />
                    GitHub Discussions
                </Button>
                <!-- Add more buttons/links as needed -->
            </div>
        </section>
    </div>
</div>
