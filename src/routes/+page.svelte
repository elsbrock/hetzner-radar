<script>
    import { faGithub } from "@fortawesome/free-brands-svg-icons";
    import {
        faBell,
        faBinoculars,
        faBug,
        faChartLine,
        faEnvelope,
        faEye,
        faFilter,
        faForwardStep,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button, Card } from "flowbite-svelte";
</script>

<main class="p-8 bg-gray-50">
    <!-- Hero Section -->
    <section class="mx-auto my-10 max-w-7xl text-center">
        <h1 class="mb-6 text-5xl font-extrabold text-gray-800">
            Find the Best Deals on Hetzner Dedicated Servers
        </h1>
        <p class="text-lg text-gray-600 mb-10">
            <strong>Server Radar</strong> monitors
            <span class="underline decoration-orange-500 decoration-2"
                >Hetzner Auctions' prices</span
            >, providing valuable insights to help you navigate the marketplace
            confidently. Now, you can also
            <span class="underline decoration-orange-500 decoration-2"
                >configure email alerts</span
            >
            to be notified when your target price is reached for your desired server
            configuration. Track daily price updates, analyze server configurations,
            and
            <span class="underline decoration-orange-500 decoration-2"
                >make informed decisions effortlessly.</span
            >
        </p>
        <div class="flex justify-center space-x-4">
            <Button
                color="primary"
                href="/analyze"
                class="px-5 py-3 text-lg shadow-sm"
            >
                <FontAwesomeIcon icon={faBinoculars} class="mr-2" />Start
                Analyzing</Button
            >
            <Button
                color="alternative"
                href="https://github.com/elsbrock/hetzner-radar"
                class="px-5 py-3 text-lg shadow-sm"
            >
                <FontAwesomeIcon icon={faGithub} class="mr-2" />
                View on GitHub
            </Button>
        </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="mx-auto mb-20 max-w-7xl">
        <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800">
            Key Features
        </h2>
        <p class="mb-10 mx-auto md:w-2/3 text-center text-gray-600">
            Discover the powerful tools that make <strong>Server Radar</strong> your
            ultimate companion for finding the best Hetzner server deals. From comprehensive
            price tracking to advanced filtering and alerts, we’ve got you covered
            with features designed to optimize your server purchasing experience.
        </p>
        <div
            class="grid grid-cols-1 justify-items-center gap-x-4 gap-y-10 md:grid-cols-2 lg:grid-cols-3"
        >
            <Card class="flex flex-col items-center text-center shadow-md">
                <FontAwesomeIcon
                    class="mb-4 w-8 h-8 text-orange-500"
                    icon={faChartLine}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Price History Tracking
                </h3>
                <p class="text-gray-600">
                    Monitor price trends over time for specific server
                    configurations to ensure you get the best deal. Understand
                    the market fluctuations and make strategic purchasing
                    decisions based on historical data.
                </p>
            </Card>

            <Card class="flex flex-col items-center text-center shadow-md">
                <FontAwesomeIcon
                    class="mb-4 w-8 h-8 text-orange-500"
                    icon={faFilter}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Advanced Filtering
                </h3>
                <p class="text-gray-600">
                    Filter servers by precise specs, such as exact disk
                    configurations, ensuring you find exactly what you need with
                    ease. Customize your search to match your specific
                    requirements.
                </p>
            </Card>

            <Card class="flex flex-col items-center text-center shadow-md">
                <FontAwesomeIcon
                    class="mb-4 w-8 h-8 text-orange-500"
                    icon={faEye}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Price Alerts
                </h3>
                <p class="text-gray-600">
                    Get notified via email when your preferred price is reached
                    to plan your purchases better and avoid missing out on
                    deals. And the best part is: it’s free!
                </p>
            </Card>
        </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="mx-auto my-20 max-w-7xl">
        <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800">
            How It Works
        </h2>
        <p class="mb-10 mx-auto md:w-2/3 text-center text-gray-600">
            Our streamlined process ensures you can effortlessly find and secure
            the best Hetzner server deals. <strong>Server Radar</strong> empowers
            you to make smart purchasing decisions through intuitive tools and notifications.
            Here’s how it works:
        </p>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Card
                class="flex flex-col items-center text-center shadow-md h-full"
            >
                <FontAwesomeIcon
                    class="mb-4 w-8 h-8 text-orange-500"
                    icon={faForwardStep}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Step 1: Define Preferences
                </h3>
                <p class="text-gray-600">
                    Choose the server specifications that meet your needs,
                    including CPU, RAM, storage configurations, and datacenter
                    location. View all the matching configurations we have
                    observed.
                </p>
            </Card>

            <Card
                class="flex flex-col items-center text-center shadow-md h-full"
            >
                <FontAwesomeIcon
                    class="mb-4 w-8 h-8 text-orange-500"
                    icon={faChartLine}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Step 2: Analyze Price Trends
                </h3>
                <p class="text-gray-600">
                    Utilize our analytics tools to review price histories and
                    availability trends for your selected configurations,
                    ensuring you stay informed about market movements and make
                    data-driven decisions.
                </p>
            </Card>

            <Card
                class="flex flex-col items-center text-center shadow-md h-full"
            >
                <FontAwesomeIcon
                    class="mb-4 w-8 h-8 text-orange-500"
                    icon={faBell}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Step 3: Configure Alerts
                </h3>
                <p class="text-gray-600">
                    Leverage the insights gained to purchase servers at the
                    optimal price and configuration. Receive email notifications
                    when your desired price is met, ensuring you never miss a
                    great deal.
                </p>
            </Card>
        </div>
    </section>

    <!-- Testimonials Section -->
    <section id="testimonials" class="mx-auto my-20 max-w-7xl">
        <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800">
            What Our Users Say
        </h2>
        <p class="mb-10 mx-auto md:w-2/3 text-center text-gray-600">
            Join the community of satisfied users who have optimized their
            server purchases with <strong>Server Radar</strong>’s comprehensive
            tools and real-time alerts. Hear from those who have benefited from
            our advanced features and seamless monitoring.
        </p>

        <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card class="shadow-sm flex flex-col justify-between border-l-8">
                <p class="text-gray-600 mb-3 italic">
                    "Server Radar has been instrumental in helping me find the
                    best deals on Hetzner servers. The price tracking feature is
                    a game-changer!"
                </p>
                <div class="flex items-center">
                    <img
                        src="/images/user1.webp"
                        alt="Alex Johnson"
                        class="w-12 h-12 rounded-full mr-4"
                        loading="lazy"
                    />
                    <div>
                        <p class="text-gray-800 font-semibold">Alex Johnson</p>
                        <p class="text-gray-500 text-sm">Web Developer</p>
                    </div>
                </div>
            </Card>

            <Card class="shadow-sm flex flex-col justify-between border-l-8">
                <p class="text-gray-600 mb-3 italic">
                    "Thanks to Server Radar, I've been able to optimize my
                    server purchases and save a significant amount of money. The
                    email alerts ensure I never miss a great deal!"
                </p>
                <div class="flex items-center">
                    <img
                        src="/images/user2.webp"
                        alt="Maria Lopez"
                        class="w-12 h-12 rounded-full mr-4"
                        loading="lazy"
                    />
                    <div>
                        <p class="text-gray-800 font-semibold">Maria Lopez</p>
                        <p class="text-gray-500 text-sm">
                            System Administrator
                        </p>
                    </div>
                </div>
            </Card>

            <Card class="shadow-sm flex flex-col justify-between border-l-8">
                <p class="text-gray-600 mb-3 italic">
                    "The advanced filtering options make it easy to find exactly
                    what I need. Server Radar is an invaluable tool for anyone
                    serious about server management. The notifications keep me
                    updated instantly."
                </p>
                <div class="flex items-center">
                    <img
                        src="/images/user3.webp"
                        alt="Liam Smith"
                        class="w-12 h-12 rounded-full mr-4"
                        loading="lazy"
                    />
                    <div>
                        <p class="text-gray-800 font-semibold">Liam Smith</p>
                        <p class="text-gray-500 text-sm">IT Consultant</p>
                    </div>
                </div>
            </Card>
        </div>
    </section>

    <!-- Open Source Commitment Section -->
    <section
        id="open-source"
        class="mx-auto my-20 max-w-7xl text-center bg-white shadow-md rounded-lg p-4 lg:p-8 overflow-hidden relative"
    >
        <!-- Background image container -->
        <div
            class="absolute inset-0 w-full h-full"
            style="
            background-image: url('/images/code.webp');
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center;
            background-attachment: local;
            filter: blur(4px) opacity(0.7);
        "
        ></div>

        <!-- Content -->
        <div class="relative z-10">
            <!-- Heading -->
            <h2 class="mb-6 text-4xl font-semibold text-black">
                Open Source Commitment
            </h2>

            <!-- Paragraph and Button -->
            <p class="mx-3 md:w-2/3 mx-auto mb-6 text-gray-700">
                <strong>Server Radar</strong> is proudly open-source. We believe
                in transparency and community collaboration to continuously improve
                our tool. Explore our code, contribute to the project, or suggest
                new features on GitHub.
            </p>
            <Button
                color="alternative"
                size="sm"
                href="https://github.com/elsbrock/hetzner-radar"
                class="px-6 pb-3 text-lg items-center justify-center"
            >
                <FontAwesomeIcon icon={faGithub} class="mr-2" />
                View on GitHub
            </Button>
        </div>
    </section>

    <!-- Contact & Support Section -->
    <section id="contact" class="mx-auto mt-10 max-w-7xl text-center">
        <h2 class="mb-4 text-center text-4xl font-semibold text-gray-800">
            Get in Touch
        </h2>
        <p class="mx-auto md:w-2/3 mb-8 text-gray-600">
            Have questions or need support? We'd love to hear from you! Whether
            it's about our new email alert feature, optimizing your server
            configurations, or any other aspect of <strong>Server Radar</strong
            >, our team is here to help.
        </p>
        <div class="flex justify-center space-x-4">
            <Button
                href="/contact"
                class="px-6 py-3 text-md flex items-center shadow-sm"
                color="alternative"
            >
                <FontAwesomeIcon icon={faEnvelope} class="mr-2" />
                Contact Us
            </Button>
            <Button
                href="https://github.com/elsbrock/hetzner-radar/issues"
                class="px-6 py-3 text-md flex items-center shadow-sm"
                color="alternative"
            >
                <FontAwesomeIcon icon={faBug} class="mr-2" />
                Report an Issue
            </Button>
        </div>
    </section>
</main>
