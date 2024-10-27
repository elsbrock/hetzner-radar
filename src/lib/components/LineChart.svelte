<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type ApexCharts from 'apexcharts';
	import type { ApexOptions } from 'apexcharts';

	export let data: { name: string; data: { x: number; y: number }[] }[] = [];
	export let options: ApexOptions = {};

	let chart: ApexCharts;
	let container: HTMLElement;
	let chartOptions: ApexOptions;

	onMount(async () => {
		// Dynamically import ApexCharts to ensure window is available
		const ApexChartsModule = await import('apexcharts');
		const ApexCharts = ApexChartsModule.default;

		// Prepare the series data
		const series = data.map((dataset) => ({
			name: dataset.name,
			data: dataset.data.map((d) => [d.x * 1000, d.y]), // Convert timestamp to milliseconds
		}));

		chartOptions = {
			chart: {
				type: 'line',
				height: '100%',
				width: '100%',
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
			},
			series: series,
			xaxis: {
				type: 'datetime',
				labels: {
					format: 'dd.MM.',
				},
			},
			yaxis: {
				labels: {
					formatter: (value) => value.toFixed(2),
				},
			},
			legend: {
				position: 'bottom',
				horizontalAlign: 'center',
			},
			stroke: {
				curve: 'smooth', // Replicates the Catmull-Rom curve
				width: 3,
			},
		};

		// Merge the user-provided options with the default options
		chartOptions = { ...chartOptions, ...options };

		chart = new ApexCharts(container, chartOptions);
		chart.render();
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});

	// Update the chart when data changes
	$: if (chart && data) {
		const updatedSeries = data.map((dataset) => ({
			name: dataset.name,
			data: dataset.data.map((d) => [d.x * 1000, d.y]),
		}));
		chart.updateSeries(updatedSeries);
	}
</script>

<div bind:this={container} style="width: 100%; height: 100%;"></div>

<style>
	div {
		display: block;
		position: relative;
	}
</style>
