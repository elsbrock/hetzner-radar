<script lang="ts">
  import type { ServerPriceStat } from '$lib/queries/filter';
  import { Spinner } from 'flowbite-svelte';
  import { onMount, onDestroy } from 'svelte';

  export let data: ServerPriceStat[] | null = null;
  export let loading: boolean = true;
  let noResults = false;

  let chart: ApexCharts;
  let chartElement: HTMLElement;

  let options: ApexCharts.ApexOptions = {
    chart: {
      height: '100%',
      width: '100%',
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
				allowMouseWheelZoom: false
			},
    },
    colors: ['#F97316', '#9CA3AF'],
    fill: {
      opacity: [1, 0.2],
    },
    grid: {
      show: true,
      borderColor: '#dfdfdf',
      position: 'back',
      strokeDashArray: 5,
    },
		stroke: {
			width: [3, 0.3],
			curve: 'smooth',
		},
		legend: {
			show: false,
		},
    plotOptions: {
      bar: {
        columnWidth: '60%',
      },
    },
    tooltip: {
      enabled: true,
      shared: true,
      x: {
        show: false,
      }
    },
    series: [],
  };

  let ApexCharts;

  onMount(async () => {
    const module = await import('apexcharts');
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
        y: d.min_price,
      }));

      const barData = data.map((d) => ({
        x: new Date(d.seen * 1000),
        y: d.count,
      }));

			chart.updateOptions(
				{
					xaxis: {
						type: 'datetime',
            tickAmount: 30,
						labels: {
							formatter: function (value: number) {
								const date = new Date(value);
								return date.toLocaleDateString('de-DE', {
									month: '2-digit',
									day: '2-digit',
								});
							},
						},
					},
          yaxis: [
            {
              seriesName: 'Price',
              forceNiceScale: true,
              title: {
                text: 'Price (€)',
              },
              labels: {
                formatter: function (value: number) {
                  return value.toFixed(0) + ' €';
                },
              },
            },
            {
              seriesName: 'Volume',
              forceNiceScale: true,
							title: {
								text: 'Volume',
							},
              opposite: true,
              labels: {
                formatter: function (value: number) {
                  return value.toFixed(0);
                },
              },
            }
          ],
        },
        false,
        false
      );

      chart.updateSeries([
        {
          name: 'Price',
          type: 'line',
          data: lineData,
        },
        {
          name: 'Volume',
          type: 'column',
          data: barData,
        },
      ]);
    }
  }

  $: if (chart && data) {
    updateChartData();
  }
</script>

<div class="relative h-[320px] w-full" data-testid="server-pricechart">
  <div
    class:blur-sm={loading || noResults}
    class:pointer-events-none={loading || noResults}
    bind:this={chartElement}></div>
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
