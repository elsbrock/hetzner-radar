<script lang="ts">
	import type { ServerPriceStat } from '$lib/api/frontend/filter';
	import { settingsStore } from '$lib/stores/settings';
	import { Chart, registerables } from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import { Spinner } from 'flowbite-svelte';
	import { onDestroy } from 'svelte';
	import { vatOptions } from './VatSelector.svelte';
	// Import the adapter
	import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';

	// Define the type for valid VAT option keys
	type VatOptionKey = keyof typeof vatOptions;
	interface Props {
		data?: ServerPriceStat[] | null;
		loading?: boolean;
		timeUnitPrice?: string;
		toolbarShow?: boolean; // Kept for interface compatibility but unused
		legendShow?: boolean;
		tooltipShow?: boolean; // New prop to control tooltip
	}

	let {
		data = null, // Remove $state, props are reactive
		loading = true, // Remove $state
		timeUnitPrice = 'perHour', // Remove $state
		// toolbarShow is ApexCharts specific, ignored here
		legendShow = true, // Remove $state
		tooltipShow = true // New prop to control tooltip
	}: Props = $props();

	let noResults = $state(false);
	let canvasElement: HTMLCanvasElement | null = $state(null);
	let chartInstance: Chart | null = $state(null);
	let isDarkMode = $state(
		typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
	);

	// Helper function to get a valid VAT key, defaulting to 'NET'
	function getValidVatKey(code: string | undefined): VatOptionKey {
		if (code && code in vatOptions) {
			return code as VatOptionKey;
		}
		return 'NET';
	}

	// VAT related derived values
	let validKey = $derived(
		// Add optional chaining ?. to safely access countryCode
		getValidVatKey($settingsStore.vatSelection?.countryCode)
	);
	let selectedOption = $derived(vatOptions[validKey]);
	let vatSuffix = $derived(
		selectedOption.rate > 0 ? `(incl. ${(selectedOption.rate * 100).toFixed(0)}% VAT)` : '(net)'
	);

	// Price formatting function for tooltips and axes
	function formatPrice(
		value: number,
		unit: string,
		decimalPlaces: number, // Made required
		includeSuffix: boolean = false // Moved includeSuffix after decimalPlaces for clarity
	): string {
		let basePrice: string;
		if (unit === 'perHour') {
			// Calculate hourly price first, then format
			const hourlyValue = value / (30 * 24);
			basePrice = hourlyValue.toFixed(decimalPlaces) + ' €/h';
		} else {
			// Format monthly price directly
			basePrice = value.toFixed(decimalPlaces) + ' €/mo';
		}
		return includeSuffix ? `${basePrice} ${vatSuffix}` : basePrice;
	}

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

	// Chart.js Configuration and Data Update Effect
	$effect(() => {
		// Ensure canvas is mounted and we have data/settings
		if (!canvasElement || !selectedOption) {
			return;
		}

		const ctx = canvasElement.getContext('2d');
		if (!ctx) {
			console.error('Failed to get canvas context');
			return;
		}

		// Use the reactive isDarkMode variable - accessing it here makes effect reactive to theme changes
		const tickColor = isDarkMode ? '#F3F4F6' : '#374151'; // gray-100 dark, gray-700 light
		const gridColor = isDarkMode
			? 'rgba(31, 41, 55, 0.2)' // Reduced opacity for dark mode
			: 'rgba(209, 213, 219, 0.2)'; // Reduced opacity for light mode

		// Prepare data for Chart.js
		const chartLabels = data ? data.map((d) => d.seen * 1000) : []; // Use timestamps for time scale
		const priceData = data
			? data.map((d) => ({
					x: d.seen * 1000,
					y: d.min_price * (1 + selectedOption.rate) // Apply VAT rate
				}))
			: [];
		const volumeData = data
			? data.map((d) => ({
					x: d.seen * 1000,
					y: d.count
				}))
			: [];

		// Define colors based on dark mode
		const priceBorderColor = isDarkMode ? '#FB923C' : '#F97316'; // orange-400 dark, orange-500 light
		const priceBackgroundColor = isDarkMode ? 'rgba(251, 146, 60, 0.1)' : 'rgba(249, 115, 22, 0.1)';
		const volumeGradientColorStops = isDarkMode
			? [
					{ stop: 0, color: 'rgba(107, 114, 128, 0.2)' }, // gray-500 dark, bottom
					{ stop: 1, color: 'rgba(107, 114, 128, 0.6)' } // gray-500 dark, top
				]
			: [
					{ stop: 0, color: 'rgba(156, 163, 175, 0.2)' }, // gray-400 light, bottom
					{ stop: 1, color: 'rgba(156, 163, 175, 0.6)' } // gray-400 light, top
				];
		const volumeFallbackColor = isDarkMode
			? 'rgba(107, 114, 128, 0.4)'
			: 'rgba(156, 163, 175, 0.4)';

		const chartData: ChartData = {
			labels: chartLabels,
			datasets: [
				{
					label: 'Price',
					type: 'line',
					data: priceData,
					borderColor: priceBorderColor,
					backgroundColor: priceBackgroundColor, // Optional fill
					yAxisID: 'yPrice',
					tension: 0.05, // Smoother curve like ApexCharts 'smooth'
					pointRadius: 0,
					borderWidth: 3 // Ensure line width is 3
				},
				{
					label: 'Volume',
					type: 'bar',
					data: volumeData,
					backgroundColor: (context: import('chart.js').ScriptableContext<'bar'>) => {
						const chart = context.chart;
						const { ctx, chartArea } = chart;
						if (!chartArea) {
							// Fallback color if chartArea is not ready
							return volumeFallbackColor;
						}
						const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
						volumeGradientColorStops.forEach((stop) => {
							gradient.addColorStop(stop.stop, stop.color);
						});
						return gradient;
					},
					borderColor: 'transparent', // Remove border for faded look
					borderWidth: 1,
					yAxisID: 'yVolume'
				}
			]
		};

		// Define tooltip colors based on theme
		const tooltipTitleColor = isDarkMode ? '#E5E7EB' : '#1F2937'; // gray-200 dark, gray-800 light
		const tooltipBodyColor = isDarkMode ? '#D1D5DB' : '#4B5563'; // gray-300 dark, gray-600 light

		const chartOptions: ChartOptions = {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				mode: 'index', // Show tooltips for all datasets at the same x-index
				intersect: false // Tooltip appears even when not directly hovering over a point/bar
			},
			scales: {
				x: {
					type: 'time',
					time: {
						unit: 'day',
						tooltipFormat: 'PPpp', // Example: Aug 23, 2023, 11:00:00 AM
						displayFormats: {
							day: 'dd.MM' // Format for axis labels
						}
					},
					ticks: {
						display: legendShow, // Control visibility
						autoSkip: true,
						maxTicksLimit: Math.min(
							30,
							canvasElement ? Math.max(10, canvasElement.clientWidth / 50) : 15
						), // Dynamic tick amount
						color: tickColor // Set tick color based on theme
					},
					// Cast grid to any to allow borderDash without TS error
					grid: {
						display: false, // Control visibility
						color: gridColor, // Use dynamic grid color
						borderDash: [5, 5] // Dashed grid lines - Moved here
					} as any
				},
				yPrice: {
					type: 'linear',
					position: 'left',
					display: legendShow, // Control visibility
					title: {
						display: legendShow,
						text: 'Price (€)',
						color: tickColor // Use tickColor for both modes
					},
					ticks: {
						display: legendShow,
						// Conditionally set stepSize to 1 for monthly view to encourage integer ticks
						stepSize: timeUnitPrice === 'perHour' ? undefined : 1,
						callback: function (value) {
							// Determine decimal places based on timeUnitPrice for ticks
							const tickDecimalPlaces = timeUnitPrice === 'perHour' ? 4 : 0;
							// Use the formatPrice function without the VAT suffix for the axis
							return formatPrice(Number(value), timeUnitPrice, tickDecimalPlaces, false);
						},
						color: tickColor // Set tick color based on theme
					},
					beginAtZero: false, // Ensure axis doesn't start at 0
					// Cast grid to any to allow borderDash without TS error
					grid: {
						drawOnChartArea: true, // Main grid lines
						color: gridColor, // Use dynamic grid color
						borderDash: [5, 5] // Dashed grid lines - Moved here
					} as any
				},
				yVolume: {
					type: 'linear',
					position: 'right',
					display: legendShow, // Control visibility
					title: {
						display: legendShow,
						text: 'Volume',
						color: tickColor // Use tickColor for both modes
					},
					ticks: {
						display: legendShow,
						callback: function (value) {
							return Number(value).toFixed(0); // Integer for volume
						},
						color: tickColor // Set tick color based on theme
					},
					grid: {
						drawOnChartArea: false // Don't draw grid lines for the secondary axis
					}
				}
			},
			plugins: {
				legend: {
					display: false, // Hide legend as per original config
					labels: {
						color: tickColor // Set legend label color (even if hidden)
					}
				},
				tooltip: {
					enabled: tooltipShow,
					titleColor: tooltipTitleColor, // Set title color
					bodyColor: tooltipBodyColor, // Set body color
					callbacks: {
						// Custom tooltip label formatting
						label: function (context: TooltipItem<any>) {
							let label = context.dataset.label || '';
							if (label) {
								label += ': ';
							}
							if (context.parsed.y !== null) {
								const value = context.parsed.y;
								if (context.dataset.label === 'Price') {
									// Determine decimal places based on timeUnitPrice for tooltips
									const tooltipDecimalPlaces = timeUnitPrice === 'perHour' ? 4 : 2;
									// Use formatPrice with VAT suffix for tooltip
									label += formatPrice(value, timeUnitPrice, tooltipDecimalPlaces, true);
								} else if (context.dataset.label === 'Volume') {
									label += value.toFixed(0);
								} else {
									label += value;
								}
							}
							return label;
						}
					}
				}
			}
		};

		// Create or update chart
		if (!chartInstance) {
			// Register Chart.js components (controllers, elements, scales, plugins)
			// Doing this once is usually sufficient, but safe to do before creation
			Chart.register(...registerables);
			chartInstance = new Chart(ctx, {
				// Use 'any' temporarily if strict type checking causes issues with mixed types
				// Alternatively, define a more precise combined type if needed.
				type: 'bar', // Base type, datasets specify their own
				data: chartData,
				options: chartOptions as any // Use 'as any' to bypass strict type checking for mixed chart types if necessary
			});
		} else {
			// Update by re-assigning the data and rebuilt options
			chartInstance.data = chartData;
			chartInstance.options = chartOptions as any; // Re-assign the whole options object
			chartInstance.update('none'); // 'none' mode skips animations for faster theme switching
		}
	});

	// Update noResults state
	$effect(() => {
		noResults = Array.isArray(data) && data.length === 0;
	});

	// Cleanup chart instance on component destroy
	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}
	});
</script>

<div class="relative h-full w-full" data-testid="server-pricechart">
	<!-- Apply blur/pointer events based on loading or no results -->
	<div class="h-full w-full {loading || noResults ? 'pointer-events-none blur-sm' : ''}">
		<canvas bind:this={canvasElement}></canvas>
	</div>

	<!-- Loading Spinner -->
	{#if loading}
		<div class="absolute inset-0 z-10 flex items-center justify-center">
			<Spinner />
		</div>
		<!-- No Results Message -->
	{:else if noResults}
		<div class="absolute inset-0 z-10 flex items-center justify-center">
			<p class="text-2xl dark:text-gray-400">No results.</p>
		</div>
	{/if}
</div>
