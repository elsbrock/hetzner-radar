<script lang="ts">
    import {
        getCheapestConfigurations,
        getCheapestDiskConfigurations,
        getCheapestRamConfigurations,
    } from "$lib/api/frontend/configs";
    import { withDbConnections } from "$lib/api/frontend/dbapi";
    import { type ServerConfiguration } from "$lib/api/frontend/filter";
    import ServerCard from "$lib/components/ServerCard.svelte";
    import {
        convertServerConfigurationToFilter,
        encodeFilter,
    } from "$lib/filter";
    import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
    import {
        faCloud,
        faCode,
        faDatabase,
        faEuroSign,
        faGamepad,
        faMemory,
        faShieldAlt,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Button, ButtonGroup, Tooltip } from "flowbite-svelte";
    import { db } from "../../stores/db";

    let loading = true;

    let timeUnitPrice: "perMonth" | "perHour" = "perMonth";

    let cheapestConfigurations: ServerConfiguration[] = [];
    let cheapDiskConfigurations: ServerConfiguration[] = [];
    let cheapRamConfigurations: ServerConfiguration[] = [];

    async function fetchData(db: AsyncDuckDB) {
        let queryTime = performance.now();
        loading = true;

        await withDbConnections(db, async (conn1, conn2, conn3) => {
            try {
                [
                    cheapestConfigurations,
                    cheapDiskConfigurations,
                    cheapRamConfigurations,
                ] = await Promise.all([
                    getCheapestConfigurations(conn1),
                    getCheapestDiskConfigurations(conn2),
                    getCheapestRamConfigurations(conn3),
                ]);
                queryTime = performance.now() - queryTime;
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                loading = false;
            }
        });
    }

    $: if (!!$db) {
        fetchData($db);
    }
</script>

<main class="p-8 bg-gray-50">
    <!-- Page Header -->
    <section class="mx-auto my-12 max-w-7xl text-center">
        <h1 class="mb-6 text-5xl font-extrabold text-gray-800">
            Choose the Right Server for Your Needs
        </h1>
        <p class="text-lg mb-5 text-gray-600">
            Explore our curated server configurations tailored to different
            usage scenarios. Find the best options that fit your specific needs.
        </p>

        <ButtonGroup>
            <div
                class="text-center font-medium focus-within:ring-2 focus-within:z-10 inline-flex items-center justify-center px-2 py-2 bg-gray-50 border border-grey-300 first:rounded-s-lg last:rounded-e-lg opacity-90"
            >
                <FontAwesomeIcon icon={faEuroSign} class="mr-2" /> Rate
            </div>
            <Button
                class="px-2"
                color="alternative"
                disabled={timeUnitPrice === "perHour"}
                on:click={() => (timeUnitPrice = "perHour")}>hourly</Button
            >
            <Button
                class="px-2"
                color="alternative"
                disabled={timeUnitPrice === "perMonth"}
                on:click={() => (timeUnitPrice = "perMonth")}>monthly</Button
            >
        </ButtonGroup>
        <Tooltip placement="left" class="z-50">
            Display prices per hour or per month.
        </Tooltip>
    </section>

    <!-- Configurations Sections -->
    <section class="mx-auto mb-10 max-w-7xl">
        <!-- Most Affordable Configurations -->
        <div class="mb-16">
            <h2 class="mb-4 text-3xl font-bold text-gray-800">
                Most Affordable Configurations
            </h2>
            <p class="mb-8 text-gray-600">
                Perfect for budget-conscious users looking to maximize value
                without compromising essential features.
            </p>
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <ServerCard
                    {timeUnitPrice}
                    config={cheapestConfigurations[0]}
                    {loading}
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapestConfigurations[0],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
                <ServerCard
                    {timeUnitPrice}
                    config={cheapestConfigurations[1]}
                    {loading}
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapestConfigurations[1],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
                <ServerCard
                    {timeUnitPrice}
                    config={cheapestConfigurations[2]}
                    {loading}
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapestConfigurations[2],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
                <ServerCard
                    {timeUnitPrice}
                    config={cheapestConfigurations[3]}
                    {loading}
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapestConfigurations[3],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
            </div>
        </div>

        <!-- Best Value for Disk Space -->
        <div class="mb-16">
            <h2 class="mb-4 text-3xl font-bold text-gray-800">
                Best Value for Disk Space
            </h2>
            <p class="mb-8 text-gray-600">
                Ideal for data-intensive applications, backups, and
                storage-heavy projects requiring ample disk space.
            </p>
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <ServerCard
                    {timeUnitPrice}
                    config={cheapDiskConfigurations[0]}
                    {loading}
                    displayStoragePrice="perTB"
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapDiskConfigurations[0],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
                <ServerCard
                    {timeUnitPrice}
                    config={cheapDiskConfigurations[1]}
                    {loading}
                    displayStoragePrice="perTB"
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapDiskConfigurations[1],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
                <ServerCard
                    {timeUnitPrice}
                    config={cheapDiskConfigurations[2]}
                    {loading}
                    displayStoragePrice="perTB"
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapDiskConfigurations[2],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
                <ServerCard
                    {timeUnitPrice}
                    config={cheapDiskConfigurations[3]}
                    {loading}
                    displayStoragePrice="perTB"
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapDiskConfigurations[3],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
            </div>
        </div>

        <!-- Best Value for Memory -->
        <div class="mb-16">
            <h2 class="mb-4 text-3xl font-bold text-gray-800">
                Best Value for Memory
            </h2>
            <p class="mb-8 text-gray-600">
                Optimize performance for memory-intensive applications such as
                databases, virtual machines, and high-traffic websites.
            </p>
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <ServerCard
                    {timeUnitPrice}
                    config={cheapRamConfigurations[0]}
                    {loading}
                    displayRamPrice="perGB"
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapRamConfigurations[0],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
                <ServerCard
                    {timeUnitPrice}
                    config={cheapRamConfigurations[1]}
                    {loading}
                    displayRamPrice="perGB"
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapRamConfigurations[1],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
                <ServerCard
                    {timeUnitPrice}
                    config={cheapRamConfigurations[2]}
                    {loading}
                    displayRamPrice="perGB"
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapRamConfigurations[2],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
                <ServerCard
                    {timeUnitPrice}
                    config={cheapRamConfigurations[3]}
                    {loading}
                    displayRamPrice="perGB"
                >
                    <Button
                        slot="buttons"
                        outline
                        href="/analyze?filter={encodeFilter(
                            convertServerConfigurationToFilter(
                                cheapRamConfigurations[3],
                            ),
                        )}"
                        class="px-4 py-2 text-sm"
                    >
                        Find
                    </Button>
                </ServerCard>
            </div>
        </div>
    </section>

    <!-- Usage Scenarios Section -->
    <section class="mx-auto my-20 max-w-7xl">
        <h2 class="mb-10 text-center text-4xl font-semibold text-gray-800">
            Common Usage Scenarios
        </h2>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <!-- High-Memory Applications -->
            <div
                class="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center"
            >
                <FontAwesomeIcon
                    class="mb-4 text-orange-500"
                    icon={faMemory}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    High-Memory Applications
                </h3>
                <p class="text-gray-600">
                    Perfect for running large databases, virtual machines, and
                    applications that require substantial memory resources.
                </p>
            </div>

            <!-- Backup Solutions -->
            <div
                class="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center"
            >
                <FontAwesomeIcon
                    class="mb-4 text-orange-500"
                    icon={faDatabase}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Backup Solutions
                </h3>
                <p class="text-gray-600">
                    Ideal for storing backups and ensuring data redundancy,
                    providing peace of mind for your critical information.
                </p>
            </div>

            <!-- Game Servers -->
            <div
                class="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center"
            >
                <FontAwesomeIcon
                    class="mb-4 text-orange-500"
                    icon={faGamepad}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Game Servers
                </h3>
                <p class="text-gray-600">
                    Host multiplayer game servers with low latency and reliable
                    performance to ensure a smooth gaming experience.
                </p>
            </div>

            <!-- Additional Scenarios (Optional) -->
            <!-- You can add more scenarios as needed -->
            <div
                class="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center"
            >
                <FontAwesomeIcon
                    class="mb-4 text-orange-500"
                    icon={faCloud}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Cloud Applications
                </h3>
                <p class="text-gray-600">
                    Deploy scalable cloud applications that can handle varying
                    workloads with ease and flexibility.
                </p>
            </div>

            <div
                class="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center"
            >
                <FontAwesomeIcon
                    class="mb-4 text-orange-500"
                    icon={faShieldAlt}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Secure Hosting
                </h3>
                <p class="text-gray-600">
                    Host your websites and applications with robust security
                    measures to protect against threats and vulnerabilities.
                </p>
            </div>

            <div
                class="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center"
            >
                <FontAwesomeIcon
                    class="mb-4 text-orange-500"
                    icon={faCode}
                    size="3x"
                />
                <h3 class="mb-4 text-2xl font-bold text-gray-800">
                    Development Environments
                </h3>
                <p class="text-gray-600">
                    Set up reliable and customizable development environments to
                    streamline your software development process.
                </p>
            </div>
        </div>
    </section>

    <!-- Call to Action -->
    <section class="mx-auto my-12 max-w-7xl text-center">
        <h2 class="mb-6 text-4xl font-extrabold text-gray-800">
            Ready to Explore More?
        </h2>
        <p class="text-lg text-gray-600 mb-10">
            Dive into our server configurations and find the perfect setup for
            your projects.
        </p>
        <div class="flex justify-center space-x-4">
            <Button
                color="primary"
                href="/analyze"
                class="px-8 py-3 text-lg shadow-sm">Analyze</Button
            >
        </div>
    </section>
</main>
