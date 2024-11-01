<script lang="ts">
  import type { ServerPriceStat } from '$lib/dbapi';
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
			}
    },
    colors: ['#F97316', '#9CA3AF'],
    fill: {
      opacity: [1, 0.2],
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
      },
      y: {
        formatter: function (value, { seriesIndex }) {
          if (seriesIndex === 0) {
            return value.toFixed(0) + ' €';
          } else {
            return value.toFixed(0);
          }
        },
      },
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

      // Calculate min and max for price series
      const yValuesPrice = lineData.map((point) => point.y);
      const minYPrice = Math.min(...yValuesPrice);
      const maxYPrice = Math.max(...yValuesPrice);
      const paddingPrice = (maxYPrice - minYPrice) * 0.1;
      const newMinYPrice = Math.floor(minYPrice - paddingPrice);
      const newMaxYPrice = Math.ceil(maxYPrice + paddingPrice);

      // Calculate min and max for volume series
      const yValuesVolume = barData.map((point) => point.y);
      const minYVolume = Math.min(...yValuesVolume);
      const maxYVolume = Math.max(...yValuesVolume);
      const paddingVolume = (maxYVolume - minYVolume) * 0.1;
      const newMinYVolume = Math.max(0, Math.floor(minYVolume - paddingVolume));
      const newMaxYVolume = Math.ceil(maxYVolume + paddingVolume);

			chart.updateOptions(
				{
					xaxis: {
						type: 'datetime',
						tickAmount: '3',
						tickPlacement: 'on',
						labels: {
							rotate: -45,
							hideOverlappingLabels: true,
							formatter: function (value: number) {
								const date = new Date(value);
								return date.toLocaleDateString('de-DE', {
									month: '2-digit',
									day: '2-digit',
								});
							},
						},
					},
				},
				false,
				false
			);

      chart.updateOptions(
        {
          yaxis: [
            {
              seriesName: 'Price',
              min: newMinYPrice,
              max: newMaxYPrice,
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
              min: newMinYVolume,
              max: newMaxYVolume,
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
