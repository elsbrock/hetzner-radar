<script lang="ts">
    import type { ServerPriceStat } from "$lib/api/frontend/filter";
    import { Spinner } from "flowbite-svelte";
    import { onDestroy, onMount } from "svelte";
    import { settingsStore } from '$lib/stores/settings';
    import { vatOptions } from './VatSelector.svelte';

    // Define the type for valid VAT option keys
    type VatOptionKey = keyof typeof vatOptions;
    export let data: ServerPriceStat[] | null = null;
    export let loading: boolean = true;
    export let timeUnitPrice = "perHour";

    let noResults = false;

    // Helper function to get a valid VAT key, defaulting to 'NET'
    function getValidVatKey(code: string | undefined): VatOptionKey {
        // Check if the provided code is a valid key in vatOptions
        if (code && code in vatOptions) {
            return code as VatOptionKey; // Cast to VatOptionKey as we've confirmed it exists
        }
        return 'NET';
    }

    // VAT related reactive variables
    $: validKey = getValidVatKey($settingsStore.vatSelection.countryCode);
    $: selectedOption = vatOptions[validKey];
    $: vatSuffix = selectedOption.rate > 0 ? `(incl. ${(selectedOption.rate * 100).toFixed(0)}% VAT)` : '(net)';

    let chart: ApexCharts;
    let chartElement: HTMLElement;

    function formatPrice(value: number) {
        let basePrice: string;
        if (timeUnitPrice === "perHour") {
            basePrice = (value / (30 * 24)).toFixed(4) + " €/h";
        } else {
            basePrice = value.toFixed(2) + " €/mo"; // Use toFixed(2) for monthly consistency
        }
        return basePrice;
    }

    let options: ApexCharts.ApexOptions = {
        chart: {
            height: "105%",
            width: "100%",
            dropShadow: {
                enabled: false,
            },
            animations: {
                enabled: false,
            },
            toolbar: {
                show: true,
                offsetX: -20,
                offsetY: -10,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: false,
                    zoomout: false,
                    pan: false,
                    reset: true,
                },
            },
            zoom: {
                enabled: true,
                allowMouseWheelZoom: false,
            },
        },
        colors: ["#F97316", "#9CA3AF"],
        fill: {
            opacity: [1, 0.2],
        },
        grid: {
            show: true,
            borderColor: "#dfdfdf",
            position: "back",
            strokeDashArray: 5,
        },
        stroke: {
            width: [3, 0.3],
            curve: "smooth",
        },
        legend: {
            show: false,
        },
        plotOptions: {
            bar: {
                columnWidth: "60%",
            },
        },
        // Tooltip configuration moved to updateOptions to ensure vatSuffix is reactive
        series: [
            {
                name: "Price",
                type: "line",
                data: [],
            },
            {
                name: "Volume",
                type: "column",
                data: [],
            },
        ],
    };

    let ApexCharts;

    onMount(async () => {
        const module = await import("apexcharts");
        ApexCharts = module.default;
        chart = new ApexCharts(chartElement, options);
        await chart.render();
        if (data && data.length > 0) {
            updateChartData();
        }
    });

    onDestroy(() => {
        if (chart) {
            chart.destroy();
        }
    });

    $: noResults = Array.isArray(data) && data.length === 0;

    function updateChartData() {
        if (chart && data && data.length > 0) {
            const lineData = data.map((d) => ({
                x: new Date(d.seen * 1000),
                y: d.min_price * (1 + selectedOption.rate), // Apply VAT rate
            }));

            const barData = data.map((d) => ({
                x: new Date(d.seen * 1000),
                y: d.count,
            }));

            chart.updateOptions(
                {
                    xaxis: {
                        type: "datetime",
                        tickAmount: Math.min(
                            Math.max(30, chartElement.clientWidth / 100),
                            30,
                        ),
                        labels: {
                            formatter: function (value: number) {
                                const date = new Date(value);
                                return date.toLocaleDateString("de-DE", {
                                    month: "2-digit",
                                    day: "2-digit",
                                });
                            },
                        },
                    },
                    yaxis: [
                        {
                            seriesName: "Price",
                            forceNiceScale: true,
                            title: {
                                text: "Price (€)",
                            },
                            labels: {
                                formatter: formatPrice,
                            },
                        },
                        {
                            seriesName: "Volume",
                            forceNiceScale: true,
                            title: {
                                text: "Volume",
                            },
                            opposite: true,
                            labels: {
                                formatter: function (value: number) {
                                    return value.toFixed(0);
                                },
                            },
                        },
                    ],
                    tooltip: { // Add tooltip config here
                        enabled: true,
                        shared: true,
                        x: {
                            show: false,
                        },
                        y: {
                            formatter: function (value: number, { series, seriesIndex, dataPointIndex, w }: { series: any[], seriesIndex: number, dataPointIndex: number, w: any }) {
                                const seriesName = w.globals.seriesNames[seriesIndex]; // Get series name reliably
                                if (seriesName === 'Price') {
                                    let formattedPrice: string;
                                    if (timeUnitPrice === "perHour") {
                                        // The value passed here is already VAT-adjusted from lineData
                                        // Ensure hourly price also uses 2 decimal places
                                        formattedPrice = (value / (30 * 24)).toFixed(2) + " €/h";
                                    } else {
                                        formattedPrice = value.toFixed(2) + " €/mo";
                                    }
                                    // Use the current vatSuffix
                                    return `${formattedPrice} ${vatSuffix}`;
                                }
                                if (seriesName === 'Volume') {
                                    return value.toFixed(0);
                                }
                                return value.toString();
                            }
                        }
                    },
                },
                false,
                false,
            );

            chart.updateSeries([
                {
                    name: "Price",
                    type: "line",
                    data: lineData,
                },
                {
                    name: "Volume",
                    type: "column",
                    data: barData,
                },
            ]);
        }
    }

    // Update chart when data, time unit, or VAT selection changes
    $: if (chart && data && timeUnitPrice && selectedOption) {
        updateChartData();
    }
</script>

<div class="relative h-[320px] w-full" data-testid="server-pricechart">
    <div
        class:blur-sm={loading || noResults}
        class:pointer-events-none={loading || noResults}
        bind:this={chartElement}
    ></div>
    {#if loading}
        <div class="absolute inset-0 z-10 flex items-center justify-center">
            <Spinner />
        </div>
    {:else if noResults}
        <div class="absolute inset-0 z-10 flex items-center justify-center">
            <p class="text-2xl">No results.</p>
        </div>
    {/if}
</div>
