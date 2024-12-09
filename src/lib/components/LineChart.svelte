<script lang="ts">
  import type { TemporalStat } from "$lib/api/frontend/stats";
  import type ApexCharts from "apexcharts";
  import type { ApexOptions } from "apexcharts";
  import merge from "deepmerge";
  import { Spinner } from "flowbite-svelte";
  import { onDestroy, onMount } from "svelte";

  export let data: { name?: string; data: Promise<TemporalStat[]> }[];
  export let options: ApexOptions = {};

  let chart: ApexCharts;
  let container: HTMLElement;
  let chartOptions: ApexOptions;

  let loading = true; // Tracks loading state
  let resolvedData: { name?: string; data: TemporalStat[] }[] = [];

  onMount(async () => {
    // Dynamically import ApexCharts to ensure window is available
    const ApexChartsModule = await import("apexcharts");
    const ApexCharts = ApexChartsModule.default;

    try {
      // Wait for all datasets to resolve
      resolvedData = await Promise.all(
        data.map(async (dataset) => ({
          name: dataset.name,
          data: await dataset.data, // Resolve the individual dataset promise
        }))
      );

      // Prepare the series data
      const series = resolvedData.map((dataset) => ({
        name: dataset.name,
        data: dataset.data.map((d) => [d.x * 1000, d.y]), // Convert timestamp to milliseconds
      }));

      console.log(resolvedData[0]);

      chartOptions = {
        chart: {
          type: "line",
          height: "95%",
          width: "100%",
          toolbar: {
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
          animations: {
            enabled: false,
          },
          zoom: {
            enabled: true,
            allowMouseWheelZoom: false,
          },
        },
        series: series,
        xaxis: {
          type: "datetime",
          labels: {
            format: "dd.MM.",
          },
        },
        yaxis: {
          title: {
            text: "Price (€)",
          },
          labels: {
            formatter: function (value: number) {
              return value.toFixed(2) + " €";
            },
          },
        },
        legend: {
          position: "bottom",
          horizontalAlign: "center",
        },
        stroke: {
          curve: "smooth", // Replicates the Catmull-Rom curve
          width: 3,
        },
      };

      // Merge the user-provided options with the default options
      chartOptions = merge(chartOptions, options);

      chart = new ApexCharts(container, chartOptions);
      chart.render();
    } finally {
      loading = false; // Loading is complete
    }
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });

  // Update the chart when data changes
  $: if (chart && resolvedData) {
    const updatedSeries = resolvedData.map((dataset) => ({
      name: dataset.name,
      data: dataset.data.map((d) => [d.x * 1000, d.y]),
    }));
    chart.updateSeries(updatedSeries);
  }
</script>

{#if loading}
  <Spinner />
{:else}
  <div
    bind:this={container}
    style="width: 100%; height: 100%;"
    data-testid="linechart"
  ></div>
{/if}

<style>
  div {
    display: block;
    position: relative;
  }
</style>
