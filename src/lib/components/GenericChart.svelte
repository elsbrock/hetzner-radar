<script lang="ts">
	import type {
		ChartConfiguration,
		ChartData,
		ChartOptions,
		ChartType,
		TooltipItem
	} from 'chart.js';
	import { Chart, registerables } from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import merge from 'deepmerge';
	import { onDestroy } from 'svelte';
	import { fadeColor, seriesColor } from '$lib/chartSeries';

	// --- Props ---
	// A null y is a genuine gap in the data, not a zero: the line breaks there.
	type InputDataPoint = { x: number; y: number | null };
	type InputSeries = {
		name: string;
		data: InputDataPoint[];
		fill?: boolean;
		color?: string;
		/**
		 * Palette slot to take the colour from, when two datasets belong to the
		 * same metric (a raw series and its moving average) and must match.
		 * Defaults to the dataset's own position.
		 */
		colorIndex?: number;
		/** Opacity of the line. Used to recede a raw series under its average. */
		alpha?: number;
		/** Line width in px. */
		width?: number;
		dashed?: boolean;
		/** Bezier tension. 0 (the default) draws what the data says. */
		tension?: number;
	};

	let {
		data = [], // Default value directly
		options: userOptions = {}, // Default value directly
		legendShow = true, // Default value directly
		type = 'line' // Default to line chart for backward compatibility
	}: {
		data?: InputSeries[];
		options?: Partial<ChartOptions<ChartType>>;
		legendShow?: boolean;
		type?: 'line' | 'bar'; // Support both line and bar charts
	} = $props();

	// --- State ---
	let canvasElement: HTMLCanvasElement | null = $state(null);
	let chartInstance: Chart<ChartType> | null = $state(null);
	let isDarkMode = $state(
		typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
	);

	// --- Theme Detection Effect ---
	$effect(() => {
		if (typeof window === 'undefined') return;

		// Initial theme detection
		isDarkMode = document.documentElement.classList.contains('dark');

		// Watch for theme changes
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
					const newIsDarkMode = document.documentElement.classList.contains('dark');
					if (newIsDarkMode !== isDarkMode) {
						isDarkMode = newIsDarkMode;
					}
				}
			}
		});

		observer.observe(document.documentElement, { attributes: true });

		return () => observer.disconnect();
	});

	// --- Chart Configuration Effect ---
	$effect(() => {
		// Ensure canvas is mounted
		if (!canvasElement) {
			return;
		}

		const ctx = canvasElement.getContext('2d');
		if (!ctx) {
			console.error('Failed to get canvas context for GenericChart');
			return;
		}

		// Use the reactive isDarkMode variable - accessing it here makes effect reactive to theme changes
		const tickColor = isDarkMode ? '#F3F4F6' : '#374151'; // gray-100 dark, gray-700 light
		const gridColor = isDarkMode
			? 'rgba(75, 85, 99, 0.2)' // gray-500 dark, reduced opacity
			: 'rgba(209, 213, 219, 0.3)'; // gray-300 light, reduced opacity
		const legendColor = isDarkMode ? '#ffffff' : '#000000';

		const chartDatasets = data.map((series, index) => {
			// Colour follows the series' identity, not chance: regenerating it per
			// effect run repainted the whole chart on every data or theme update.
			const base = series.color || seriesColor(series.colorIndex ?? index, isDarkMode);
			const color = series.alpha !== undefined ? fadeColor(base, series.alpha) : base;
			const baseConfig = {
				label: series.name,
				data: series.data.map((d) => ({
					x: d.x * 1000, // Convert timestamp (assumed seconds) to milliseconds
					y: d.y
				})),
				// Use provided color or generate one
				borderColor: color
			};

			// Type-specific styling
			if (type === 'line') {
				return {
					...baseConfig,
					borderWidth: series.width ?? 2,
					borderDash: series.dashed ? [5, 4] : undefined,
					tension: series.tension ?? 0,
					pointRadius: 0, // Hide points by default
					// Never draw across a null: a missing day is not a straight line
					// between the days either side of it.
					spanGaps: false,
					fill: series.fill === true, // Use fill if specified
					backgroundColor: series.fill === true ? fadeColor(color, 0.5) : undefined
				};
			} else if (type === 'bar') {
				const color = baseConfig.borderColor;
				return {
					...baseConfig,
					backgroundColor: fadeColor(color, 0.7), // Semi-transparent fill
					borderWidth: 1,
					borderRadius: 4, // Rounded corners on bars
					barPercentage: 0.8, // Width of the bar relative to the category width
					categoryPercentage: 0.8 // Width of the category relative to the available width
				};
			}

			return baseConfig;
		});

		const chartData: ChartData<ChartType> = {
			datasets: chartDatasets
			// Labels are usually derived from data.x in time series
		};

		// --- Default Chart Options ---
		const defaultOptions: ChartOptions<ChartType> = {
			responsive: true,
			maintainAspectRatio: false,
			animation: false, // Disable animations like in ApexCharts config
			interaction: {
				mode: 'index',
				intersect: false
			},
			scales: {
				x: {
					type: 'time',
					time: {
						unit: 'day', // Sensible default, can be overridden
						tooltipFormat: 'PPpp', // Example: Aug 23, 2023, 11:00:00 AM
						displayFormats: {
							day: 'dd.MM.' // Match ApexCharts format
						}
					},
					ticks: {
						color: tickColor,
						autoSkip: true,
						maxTicksLimit: Math.min(
							30,
							canvasElement ? Math.max(10, canvasElement.clientWidth / 50) : 15
						)
					},
					grid: {
						color: gridColor,
						// @ts-expect-error borderDash is valid for Chart.js grid config
						borderDash: [5, 5], // Dashed grid lines
						display: true // Show X-axis grid lines
					}
				},
				y: {
					type: 'linear',
					title: {
						display: true,
						text: 'Value', // Default title, override via options
						color: tickColor
					},
					ticks: {
						color: tickColor,
						// Basic formatter, override via options for specific formatting like '€'
						callback: function (value) {
							if (typeof value === 'number') {
								return value.toFixed(2); // Default to 2 decimal places
							}
							return value;
						}
					},
					grid: {
						color: gridColor,
						// @ts-expect-error borderDash is valid for Chart.js grid config
						borderDash: [5, 5], // Dashed grid lines
						drawOnChartArea: true
					},
					beginAtZero: type === 'bar' ? true : false, // Start at zero for bar charts by default
					stacked: type === 'bar' && data.length > 1 // Stack bars when multiple datasets
				}
			},
			plugins: {
				legend: {
					display: legendShow,
					position: 'bottom', // Match ApexCharts config
					align: 'center', // Match ApexCharts config
					labels: {
						color: legendColor // Set legend text color based on theme
					}
				},
				tooltip: {
					enabled: true,
					callbacks: {
						// Basic tooltip label, override via options if needed
						label: function (context: TooltipItem<ChartType>) {
							let label = context.dataset.label || '';
							if (label) {
								label += ': ';
							}
							if (context.parsed.y !== null) {
								if (typeof context.parsed.y === 'number') {
									label += context.parsed.y.toFixed(2); // Default formatting
								} else {
									label += context.parsed.y;
								}
							}
							return label;
						}
					}
				}
				// Add zoom plugin configuration here if needed, e.g., chartjs-plugin-zoom
				// zoom: { ... }
			}
		};

		// --- Merge Options ---
		// Merge default options with user-provided options
		// User options take precedence
		const finalOptions = merge(defaultOptions, userOptions);

		// --- Create or Update Chart ---
		if (!chartInstance) {
			Chart.register(...registerables); // Register necessary components

			const config: ChartConfiguration<ChartType> = {
				type,
				data: chartData,
				options: finalOptions
			};
			chartInstance = new Chart(ctx, config);
		} else {
			// If chart type has changed, destroy and recreate
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ((chartInstance as any).config.type !== type) {
				chartInstance.destroy();
				const config: ChartConfiguration<ChartType> = {
					type,
					data: chartData,
					options: finalOptions
				};
				chartInstance = new Chart(ctx, config);
			} else {
				// Update chart data and options
				chartInstance.data = chartData;
				chartInstance.options = finalOptions; // Update options potentially changed by theme or user input
				// Force update to apply new theme colors
				chartInstance.update('none'); // 'none' mode skips animations for faster theme switching
			}
		}
	});

	// --- Cleanup ---
	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}
	});

</script>

<!-- Use a canvas element for Chart.js -->
<div class="relative h-full w-full" data-testid="chart-container">
	<canvas bind:this={canvasElement} data-testid="chart-canvas"></canvas>
</div>

<!-- Keep basic styling for the container -->
<style>
	div {
		display: block;
		position: relative;
		width: 100%;
		height: 100%;
	}
	canvas {
		/*
		 * Size is Chart.js's job: `responsive: true` writes the CSS size from the
		 * container and the bitmap size from that times the device pixel ratio.
		 * Forcing `width: 100% !important` here overrode the CSS half only, so the
		 * bitmap and the box disagreed and the plot rendered scaled and clipped.
		 */
		display: block; /* Prevent extra space below canvas */
	}
</style>
