<script lang="ts">
    import { faGithub } from "@fortawesome/free-brands-svg-icons";
    import {
        faBell,
        faChartLine,
        faChevronLeft,
        faClock,
        faFilter,
        faForwardStep,
        faGavel,
        faGlobe,
        faHardDrive,
        faMemory,
        faMicrochip,
        faServer,
        faUsers,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button } from "flowbite-svelte";
    import { ArrowRightOutline } from "flowbite-svelte-icons";
    import ServerPriceChart from "../ServerPriceChart.svelte";
    import type { ServerPriceStat } from "$lib/api/frontend/filter";

    // Sample data showing a falling price trend over time
    const now = Math.floor(Date.now() / 1000);
    const oneDay = 24 * 60 * 60;
    
    const samplePriceData: ServerPriceStat[] = [
        { seen: now - 30 * oneDay, min_price: 32.0, max_price: 34.0, mean_price: 33.0, count: 3 },
        { seen: now - 25 * oneDay, min_price: 31.5, max_price: 33.5, mean_price: 32.5, count: 4 },
        { seen: now - 20 * oneDay, min_price: 30.8, max_price: 32.8, mean_price: 31.8, count: 2 },
        { seen: now - 18 * oneDay, min_price: 30.2, max_price: 32.2, mean_price: 31.2, count: 5 },
        { seen: now - 15 * oneDay, min_price: 29.5, max_price: 31.5, mean_price: 30.5, count: 3 },
        { seen: now - 12 * oneDay, min_price: 28.9, max_price: 30.9, mean_price: 29.9, count: 4 },
        { seen: now - 10 * oneDay, min_price: 28.2, max_price: 30.2, mean_price: 29.2, count: 2 },
        { seen: now - 8 * oneDay, min_price: 27.8, max_price: 29.8, mean_price: 28.8, count: 6 },
        { seen: now - 5 * oneDay, min_price: 27.1, max_price: 29.1, mean_price: 28.1, count: 3 },
        { seen: now - 3 * oneDay, min_price: 26.5, max_price: 28.5, mean_price: 27.5, count: 4 },
        { seen: now - 1 * oneDay, min_price: 26.0, max_price: 28.0, mean_price: 27.0, count: 2 },
    ];
</script>

<section id="features" class="mx-auto mb-20 max-w-7xl">
    <h2
        class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
    >
        Powerful Features for Smart Server Hunting
    </h2>
    <p
        class="mb-12 mx-auto md:w-2/3 text-center text-gray-600 dark:text-gray-400"
    >
        Everything you need to find the perfect server at the right price.
        Built by the community, refined through real-world use, and completely free forever.
    </p>
    
    <!-- Two-column feature grid with alternating layout -->
    <div class="space-y-16">
        <!-- Feature 1: Price Tracking -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div class="order-2 lg:order-1">
                <div class="bg-white dark:from-gray-800 dark:to-gray-700 dark:bg-gradient-to-br rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 class="mb-3 text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                        <FontAwesomeIcon
                            class="w-8 h-8 text-orange-500"
                            icon={faChartLine}
                        />
                        Historical Price Intelligence
                    </h3>
                    <p class="mb-4 text-gray-600 dark:text-gray-400">
                        Track price trends over time for any server configuration. Our comprehensive
                        3-month history helps you understand market patterns and identify the best
                        times to buy.
                    </p>
                    <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <li class="flex items-center gap-2">
                            <span class="text-orange-500">✓</span>
                            Interactive price charts with zoom and pan
                        </li>
                        <li class="flex items-center gap-2">
                            <span class="text-orange-500">✓</span>
                            Compare multiple configurations side-by-side
                        </li>
                        <li class="flex items-center gap-2">
                            <span class="text-orange-500">✓</span>
                            Export data for your own analysis
                        </li>
                    </ul>
                </div>
            </div>
            <div class="order-1 lg:order-2">
                <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden h-52 mx-12 p-4">
                    <!-- Real ServerPriceChart component with sample falling price data -->
                    <ServerPriceChart
                        data={samplePriceData}
                        loading={false}
                        toolbarShow={false}
                        legendShow={true}
                        tooltipShow={false}
                        timeUnitPrice="perMonth"
                    />
                    <!-- Subtle overlay to indicate this is a demo -->
                    <div class="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent dark:from-gray-900/80 pointer-events-none"></div>
                </div>
            </div>
        </div>

        <!-- Feature 2: Advanced Filtering -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
                <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden max-w-sm mx-auto">
                    <!-- Mock filter interface that looks like actual ServerFilter -->
                    <div class="p-4 space-y-3 h-80 overflow-hidden">
                        <!-- Filter header -->
                        <div class="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                            <h3 class="text-lg font-medium text-gray-800 dark:text-white">Filter Settings</h3>
                            <FontAwesomeIcon icon={faChevronLeft} class="w-4 h-4 text-gray-400" />
                        </div>
                        
                        <!-- Location section -->
                        <div class="space-y-2">
                            <h4 class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                <FontAwesomeIcon class="w-4 h-4 me-2" icon={faGlobe} />Location
                            </h4>
                            <div class="space-y-1">
                                <div class="flex items-center gap-2">
                                    <div class="w-4 h-4 rounded bg-purple-500"></div>
                                    <span class="text-sm text-gray-600 dark:text-gray-400">Germany</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600"></div>
                                    <span class="text-sm text-gray-600 dark:text-gray-400">Finland</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- CPU section -->
                        <div class="space-y-2">
                            <h4 class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                <FontAwesomeIcon class="w-4 h-4 me-2" icon={faMicrochip} />CPU
                            </h4>
                            <div class="space-y-1">
                                <span class="text-xs text-gray-500 dark:text-gray-400">Vendor</span>
                                <div class="flex items-center gap-2">
                                    <div class="w-4 h-4 rounded bg-purple-500"></div>
                                    <span class="text-sm text-gray-600 dark:text-gray-400">Intel</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Memory section with range slider -->
                        <div class="space-y-2">
                            <h4 class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                <FontAwesomeIcon class="w-4 h-4 me-2" icon={faMemory} />Memory
                            </h4>
                            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>Size</span>
                                <span>32GB – 64GB</span>
                            </div>
                            <!-- Range slider mockup -->
                            <div class="relative">
                                <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                    <div class="absolute h-2 bg-purple-500 rounded-full" style="left: 25%; width: 40%"></div>
                                    <div class="absolute w-3 h-3 bg-purple-600 rounded-full border-2 border-white shadow-sm" style="left: 23%; top: -2px"></div>
                                    <div class="absolute w-3 h-3 bg-purple-600 rounded-full border-2 border-white shadow-sm" style="left: 63%; top: -2px"></div>
                                </div>
                                <!-- Slider pips -->
                                <div class="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>4GB</span>
                                    <span>1TB</span>
                                </div>
                            </div>
                            <!-- ECC buttons -->
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-gray-500 dark:text-gray-400">ECC</span>
                                <div class="flex rounded-md shadow-sm">
                                    <button class="px-2 py-1 text-xs bg-purple-500 text-white rounded-l-md">yes</button>
                                    <button class="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">no</button>
                                    <button class="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-r-md">any</button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Disks section -->
                        <div class="space-y-2">
                            <h4 class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                <FontAwesomeIcon class="w-4 h-4 me-2" icon={faHardDrive} />Disks
                            </h4>
                            <div class="text-xs font-medium text-gray-600 dark:text-gray-400">SSDs (NVMe)</div>
                            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>Devices</span>
                                <span>2 – 4</span>
                            </div>
                            <!-- Another range slider -->
                            <div class="relative">
                                <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                    <div class="absolute h-2 bg-purple-500 rounded-full" style="left: 30%; width: 35%"></div>
                                    <div class="absolute w-3 h-3 bg-purple-600 rounded-full border-2 border-white shadow-sm" style="left: 28%; top: -2px"></div>
                                    <div class="absolute w-3 h-3 bg-purple-600 rounded-full border-2 border-white shadow-sm" style="left: 63%; top: -2px"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Fade out effect -->
                    <div class="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent dark:from-gray-900/80 pointer-events-none"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white/40 dark:to-gray-900/40 pointer-events-none"></div>
                </div>
            </div>
            <div>
                <div class="bg-white dark:from-gray-800 dark:to-gray-700 dark:bg-gradient-to-br rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 class="mb-3 text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                        <FontAwesomeIcon
                            class="w-8 h-8 text-purple-500"
                            icon={faFilter}
                        />
                        Precision Filtering Engine
                    </h3>
                    <p class="mb-4 text-gray-600 dark:text-gray-400">
                        Find exactly what you need with our advanced filtering system. Filter by CPU,
                        RAM, storage, location, and even specific disk configurations.
                    </p>
                    <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <li class="flex items-center gap-2">
                            <span class="text-purple-500">✓</span>
                            Dual-range sliders for precise control
                        </li>
                        <li class="flex items-center gap-2">
                            <span class="text-purple-500">✓</span>
                            Save and share filter configurations
                        </li>
                        <li class="flex items-center gap-2">
                            <span class="text-purple-500">✓</span>
                            Real-time results as you adjust filters
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Feature 3: Smart Alerts (including Cloud) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div class="order-2 lg:order-1">
                <div class="bg-white dark:from-gray-800 dark:to-gray-700 dark:bg-gradient-to-br rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 class="mb-3 text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                        <FontAwesomeIcon
                            class="w-8 h-8 text-blue-500"
                            icon={faBell}
                        />
                        Intelligent Alert System
                    </h3>
                    <p class="mb-4 text-gray-600 dark:text-gray-400">
                        Never miss the perfect deal with our dual alert system for both auction
                        servers and cloud availability.
                    </p>
                    <div class="space-y-3">
                        <div class="bg-gray-50 dark:bg-gray-800 rounded p-3">
                            <h4 class="font-semibold text-gray-700 dark:text-gray-200 mb-1">Auction Price Alerts</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400">Set target prices and get notified when matching servers appear</p>
                        </div>
                        <div class="bg-gray-50 dark:bg-gray-800 rounded p-3">
                            <h4 class="font-semibold text-gray-700 dark:text-gray-200 mb-1">Cloud Availability Alerts</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400">Know instantly when CAX/CCX servers become available in your region</p>
                        </div>
                    </div>
                    <Button href="/alerts" size="sm" class="mt-4" color="primary">
                        Configure Alerts <ArrowRightOutline class="ms-2 w-4 h-4" />
                    </Button>
                </div>
            </div>
            <div class="order-1 lg:order-2">
                <div class="relative space-y-4 mx-8">
                    <!-- Alert cards without headers, just the components -->
                    
                    <!-- Auction Alert -->
                    <div class="relative">
                        <div class="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-l-4 border-orange-500 shadow-sm w-[500px]">
                            <FontAwesomeIcon icon={faGavel} class="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <div class="text-sm font-medium text-gray-800 dark:text-gray-200">Auction Price Alert</div>
                                    <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                </div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">i7-6700 • 32GB • Target: €25</div>
                            </div>
                            <span class="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded font-medium">
                                Active
                            </span>
                        </div>
                    </div>
                    
                    <!-- Cloud Alert (slightly offset) -->
                    <div class="relative ml-4">
                        <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500 shadow-sm w-[500px]">
                            <FontAwesomeIcon icon={faClock} class="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <div class="text-sm font-medium text-gray-800 dark:text-gray-200">Cloud Alert</div>
                                    <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                </div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">CAX41 in Falkenstein</div>
                            </div>
                            <span class="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded font-medium">
                                Waiting
                            </span>
                        </div>
                    </div>
                    
                    <!-- Recent notification (more offset) -->
                    <div class="relative ml-8">
                        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm w-[500px]">
                            <FontAwesomeIcon icon={faBell} class="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-gray-800 dark:text-gray-200">Recent Alert</div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">CCX33 found • 2h ago</div>
                            </div>
                            <span class="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                                Sent
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Additional features grid -->
    <div class="mt-16">
        <h3 class="text-center text-2xl font-medium text-gray-600 dark:text-gray-400 mb-8">
            …and so much more
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
            <FontAwesomeIcon icon={faForwardStep} class="w-8 h-8 text-green-500 mb-3" />
            <h4 class="font-semibold text-gray-800 dark:text-gray-100 mb-2">Real-time Data</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">Live server cards with real pricing, availability status, hardware specs, and instant updates when new auctions appear</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
            <FontAwesomeIcon icon={faServer} class="w-8 h-8 text-blue-500 mb-3" />
            <h4 class="font-semibold text-gray-800 dark:text-gray-100 mb-2">Comprehensive Details</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">Complete hardware specifications, pricing history, and instant availability status for every server configuration</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
            <FontAwesomeIcon icon={faGithub} class="w-8 h-8 text-gray-700 dark:text-gray-300 mb-3" />
            <h4 class="font-semibold text-gray-800 dark:text-gray-100 mb-2">Open Source</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">Transparent, community-driven development you can trust and contribute to</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
            <FontAwesomeIcon icon={faUsers} class="w-8 h-8 text-orange-500 mb-3" />
            <h4 class="font-semibold text-gray-800 dark:text-gray-100 mb-2">Active Community</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">Join 100+ users sharing tips and strategies in our Discord</p>
        </div>
    </div>
</section>