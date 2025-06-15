<script lang="ts">
    import { faBell, faClock, faGavel } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button } from "flowbite-svelte";
    import { ArrowRightOutline } from "flowbite-svelte-icons";
    import ServerPriceChart from "$lib/components/ServerPriceChart.svelte";

    // Sample downtrend price data for demonstration
    const samplePriceData = [
        { seen: Date.now() / 1000 - 30 * 24 * 60 * 60, min_price: 45, max_price: 48, mean_price: 46.5, count: 15 },
        { seen: Date.now() / 1000 - 25 * 24 * 60 * 60, min_price: 42, max_price: 45, mean_price: 43.5, count: 18 },
        { seen: Date.now() / 1000 - 20 * 24 * 60 * 60, min_price: 38, max_price: 41, mean_price: 39.5, count: 16 },
        { seen: Date.now() / 1000 - 15 * 24 * 60 * 60, min_price: 35, max_price: 38, mean_price: 36.5, count: 19 },
        { seen: Date.now() / 1000 - 10 * 24 * 60 * 60, min_price: 32, max_price: 35, mean_price: 33.5, count: 17 },
        { seen: Date.now() / 1000 - 8 * 24 * 60 * 60, min_price: 36, max_price: 39, mean_price: 37.5, count: 14 },
        { seen: Date.now() / 1000 - 5 * 24 * 60 * 60, min_price: 29, max_price: 32, mean_price: 30.5, count: 16 },
        { seen: Date.now() / 1000 - 2 * 24 * 60 * 60, min_price: 28, max_price: 31, mean_price: 29.5, count: 18 }
    ];
</script>

<section id="how-it-works" class="mx-auto my-20 max-w-7xl">
    <h2
        class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
    >
        Your Path to Server Success
    </h2>
    <p
        class="mb-12 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
    >
        Finding the perfect Hetzner server at the best price has never been easier.
        Follow our proven 3-step process to become a smart server hunter.
    </p>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Step 1 -->
        <div class="relative">
            <div class="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                <div class="flex items-center mb-4">
                    <div class="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                        1
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Filter & Discover
                    </h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 mb-4">
                    Use our precision filtering engine to find exactly what you need. 
                    Specify CPU, RAM, storage, and location requirements.
                </p>
                <div class="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600">
                    <div class="flex flex-wrap gap-1.5">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700">
                            CPU: i7+
                        </span>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700">
                            RAM: 32GB+
                        </span>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700">
                            NVMe: SSD
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Step 2 -->
        <div class="relative">
            <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                <div class="flex items-center mb-4">
                    <div class="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                        2
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Analyze Trends
                    </h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 mb-4">
                    Study historical price data and market patterns to identify 
                    the best buying opportunities.
                </p>
                <div class="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                    <div class="h-28">
                        <ServerPriceChart 
                            data={samplePriceData} 
                            loading={false} 
                            legendShow={false} 
                            tooltipShow={false} 
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Step 3 -->
        <div class="relative">
            <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                <div class="flex items-center mb-4">
                    <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                        3
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Set Smart Alerts
                    </h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 mb-4">
                    Configure auction price alerts and cloud availability notifications. 
                    We'll notify you instantly when your conditions are met.
                </p>
                <div class="space-y-3">
                    <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border border-orange-200 dark:border-orange-700 border-l-3 border-l-orange-500 flex items-center gap-2">
                        <FontAwesomeIcon icon={faGavel} class="w-3 h-3 text-orange-500 flex-shrink-0" />
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">Auction Alert</div>
                            <div class="text-xs text-gray-600 dark:text-gray-400 truncate">Target: ≤ €25</div>
                        </div>
                        <div class="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                    </div>
                    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-700 border-l-3 border-l-blue-500 flex items-center gap-2">
                        <FontAwesomeIcon icon={faClock} class="w-3 h-3 text-blue-500 flex-shrink-0" />
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">Cloud Alert</div>
                            <div class="text-xs text-gray-600 dark:text-gray-400 truncate">CAX41 in FSN</div>
                        </div>
                        <div class="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Call to action -->
    <div class="text-center mt-12">
        <Button href="/analyze" size="lg" color="primary">
            Start Your Server Hunt
            <ArrowRightOutline class="ms-2 w-5 h-5" />
        </Button>
    </div>
</section>