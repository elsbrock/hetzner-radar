<script lang="ts">
    import { Card } from "flowbite-svelte";
</script>

<section id="testimonials" class="mx-auto my-20 max-w-7xl">
    <h2
        class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
    >
        What Our Users Say
    </h2>
    <p
        class="mb-10 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
    >
        Join the community of satisfied users who have optimized their
        server purchases with <strong>Server Radar</strong>'s comprehensive
        tools and real-time alerts. Hear from those who have benefited from
        our advanced features and seamless monitoring.
    </p>

    <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Card class="shadow-sm flex flex-col justify-between border border-gray-100 dark:border-gray-700">
            <p class="text-gray-600 dark:text-gray-400 mb-3 italic">
                "As a startup founder, Server Radar helps me stretch our infrastructure
                budget. The open-source nature means I can trust it and even contribute
                features we need!"
            </p>
            <div class="flex items-center">
                <img
                    src="/images/user1.webp"
                    alt="Alex Johnson"
                    class="w-12 h-12 rounded-full mr-4"
                    loading="lazy"
                />
                <div>
                    <p
                        class="text-gray-800 dark:text-gray-100 font-semibold"
                    >
                        Alex Johnson
                    </p>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">
                        Web Developer
                    </p>
                </div>
            </div>
        </Card>

        <Card class="shadow-sm flex flex-col justify-between border border-gray-100 dark:border-gray-700">
            <p class="text-gray-600 dark:text-gray-400 mb-3 italic">
                "The transparency of open source combined with the powerful filtering
                makes this my go-to tool. Saved hundreds of euros and joined an
                amazing community!"
            </p>
            <div class="flex items-center">
                <img
                    src="/images/user2.webp"
                    alt="Maria Lopez"
                    class="w-12 h-12 rounded-full mr-4"
                    loading="lazy"
                />
                <div>
                    <p
                        class="text-gray-800 dark:text-gray-100 font-semibold"
                    >
                        Maria Lopez
                    </p>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">
                        System Administrator
                    </p>
                </div>
            </div>
        </Card>

        <Card class="shadow-sm flex flex-col justify-between border border-gray-100 dark:border-gray-700">
            <p class="text-gray-600 dark:text-gray-400 mb-3 italic">
                "I love that it's community-driven. Filed a feature request on GitHub
                and it was implemented within days. This is how software should be built
                – by users, for users."
            </p>
            <div class="flex items-center">
                <img
                    src="/images/user3.webp"
                    alt="Liam Smith"
                    class="w-12 h-12 rounded-full mr-4"
                    loading="lazy"
                />
                <div>
                    <p
                        class="text-gray-800 dark:text-gray-100 font-semibold"
                    >
                        Liam Smith
                    </p>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">
                        IT Consultant
                    </p>
                </div>
            </div>
        </Card>
    </div>
</section>