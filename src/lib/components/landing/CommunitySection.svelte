<script lang="ts">
    import { faDiscord } from "@fortawesome/free-brands-svg-icons";
    import { faBell, faQuestionCircle, faUsers } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button } from "flowbite-svelte";
    import { ArrowRightOutline } from "flowbite-svelte-icons";
</script>

<section id="community" class="mx-auto my-20 max-w-7xl">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div>
            <h2 class="mb-6 text-4xl font-semibold text-gray-800 dark:text-gray-100">
                Join Our Thriving Community
            </h2>
            <p class="mb-6 text-lg text-gray-600 dark:text-gray-400">
                Connect with fellow server hunters, share strategies, and stay ahead of the curve. 
                Our community is where the best deals are discovered and shared.
            </p>
            <div class="space-y-4 mb-8">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon icon={faUsers} class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span class="text-gray-700 dark:text-gray-300">100+ active members sharing tips</span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon icon={faBell} class="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span class="text-gray-700 dark:text-gray-300">Real-time deal alerts and notifications</span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon icon={faQuestionCircle} class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span class="text-gray-700 dark:text-gray-300">Expert help with server configurations</span>
                </div>
            </div>
            <Button
                href="https://discord.gg/dcuGfURbdc"
                size="lg"
                class="shadow-sm"
                color="primary"
            >
                <FontAwesomeIcon icon={faDiscord} class="mr-2" />
                Join Discord Community
                <ArrowRightOutline class="ms-2 w-5 h-5" />
            </Button>
        </div>
        <div class="bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-8 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                🎯 Community Highlights
            </h3>
            <div class="space-y-4">
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-gray-300 dark:border-gray-500">
                    <div class="flex items-start gap-3">
                        <img src="/images/user1.webp" alt="User" class="w-8 h-8 rounded-full" loading="lazy" />
                        <div class="flex-1">
                            <p class="text-sm text-gray-700 dark:text-gray-300">
                                "Just saved €200 on a perfect server thanks to the community's price alerts! 🎉"
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">— Alex, 2 hours ago</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-gray-300 dark:border-gray-500">
                    <div class="flex items-start gap-3">
                        <img src="/images/user2.webp" alt="User" class="w-8 h-8 rounded-full" loading="lazy" />
                        <div class="flex-1">
                            <p class="text-sm text-gray-700 dark:text-gray-300">
                                "CAX41 available in Falkenstein! Setting up alerts for everyone interested."
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">— Maria, 1 day ago</p>
                        </div>
                    </div>
                </div>
                <div class="text-center">
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        💬 Join the conversation and discover your next great deal
                    </p>
                </div>
            </div>
        </div>
    </div>
</section>