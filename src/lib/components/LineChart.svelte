<script lang="ts">
  import { settingsStore } from "$lib/stores/settings";
  import type {
    ChartConfiguration,
    ChartData,
    ChartOptions,
    TooltipItem,
  } from "chart.js";
  import { Chart, registerables } from "chart.js";
  import "chartjs-adapter-date-fns";
  import { onDestroy } from "svelte";
  // Assuming settings store for dark mode
  import merge from "deepmerge"; // Keep deepmerge for merging options

  // --- Props ---
  type InputDataPoint = { x: number; y: number };
  type InputSeries = { name: string; data: InputDataPoint[] };

  let {
    data = [], // Default value directly
    options: userOptions = {}, // Default value directly
    legendShow = true, // Default value directly
  }: {
    data?: InputSeries[];
    options?: Partial<ChartOptions<"line">>;
    legendShow?: boolean;
  } = $props();

  // --- State ---
  let canvasElement: HTMLCanvasElement | null = $state(null);
  let chartInstance: Chart<"line"> | null = $state(null);

  // --- Chart Configuration Effect ---
  $effect(() => {
    // Ensure canvas is mounted
    if (!canvasElement) {
      return;
    }

    const ctx = canvasElement.getContext("2d");
    if (!ctx) {
      console.error("Failed to get canvas context for LineChart");
      return;
    }

    // --- Theme Handling (from settingsStore) ---
    const isDarkMode = $settingsStore.darkMode === true;
    const tickColor = isDarkMode ? "#F3F4F6" : "#374151"; // gray-100 dark, gray-700 light
    const gridColor = isDarkMode
      ? "rgba(75, 85, 99, 0.2)" // gray-500 dark, reduced opacity
      : "rgba(209, 213, 219, 0.3)"; // gray-300 light, reduced opacity
    const legendColor = isDarkMode ? "#ffffff" : "#000000";

    // --- Data Transformation ---
    const chartDatasets = data.map((series) => ({
      label: series.name,
      data: series.data.map((d) => ({
        x: d.x * 1000, // Convert timestamp (assumed seconds) to milliseconds
        y: d.y,
      })),
      // Apply some styling defaults, can be overridden by userOptions
      borderColor: getRandomColor(), // Assign a random color per dataset initially
      borderWidth: 3,
      tension: 0.4, // Approximation for 'smooth' curve
      pointRadius: 0, // Hide points by default
      fill: false, // No fill under the line by default
    }));

    const chartData: ChartData<"line"> = {
      datasets: chartDatasets,
      // Labels are usually derived from data.x in time series
    };

    // --- Default Chart Options ---
    const defaultOptions: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // Disable animations like in ApexCharts config
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day", // Sensible default, can be overridden
            tooltipFormat: "PPpp", // Example: Aug 23, 2023, 11:00:00 AM
            displayFormats: {
              day: "dd.MM.", // Match ApexCharts format
            },
          },
          ticks: {
            color: tickColor,
            autoSkip: true,
            maxTicksLimit: Math.min(
              30,
              canvasElement ? Math.max(10, canvasElement.clientWidth / 50) : 15
            ),
          },
          grid: {
            color: gridColor,
            borderDash: [5, 5], // Dashed grid lines
            display: true, // Show X-axis grid lines
          } as any, // Cast to any to allow borderDash
        },
        y: {
          type: "linear",
          title: {
            display: true,
            text: "Value", // Default title, override via options
            color: tickColor,
          },
          ticks: {
            color: tickColor,
            // Basic formatter, override via options for specific formatting like '€'
            callback: function (value) {
              if (typeof value === "number") {
                return value.toFixed(2); // Default to 2 decimal places
              }
              return value;
            },
          },
          grid: {
            color: gridColor,
            borderDash: [5, 5], // Dashed grid lines
            drawOnChartArea: true,
          } as any, // Cast to any to allow borderDash
          beginAtZero: false, // Don't force start at zero unless specified
        },
      },
      plugins: {
        legend: {
          display: legendShow,
          position: "bottom", // Match ApexCharts config
          align: "center", // Match ApexCharts config
          labels: {
            color: legendColor, // Set legend text color based on theme
          },
        },
        tooltip: {
          enabled: true,
          callbacks: {
            // Basic tooltip label, override via options if needed
            label: function (context: TooltipItem<"line">) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (context.parsed.y !== null) {
                if (typeof context.parsed.y === "number") {
                  label += context.parsed.y.toFixed(2); // Default formatting
                } else {
                  label += context.parsed.y;
                }
              }
              return label;
            },
          },
        },
        // Add zoom plugin configuration here if needed, e.g., chartjs-plugin-zoom
        // zoom: { ... }
      },
    };

    // --- Merge Options ---
    // Merge default options with user-provided options
    // User options take precedence
    const finalOptions = merge(defaultOptions, userOptions);

    // --- Create or Update Chart ---
    if (!chartInstance) {
      Chart.register(...registerables); // Register necessary components
      // Ensure adapter is registered if not done globally
      // Chart.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

      const config: ChartConfiguration<"line"> = {
        type: "line",
        data: chartData,
        options: finalOptions,
      };
      chartInstance = new Chart(ctx, config);
    } else {
      chartInstance.data = chartData;
      chartInstance.options = finalOptions; // Update options potentially changed by theme or user input
      chartInstance.update();
    }
  });

  // --- Cleanup ---
  onDestroy(() => {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  });

  // --- Helper Functions ---
  function getRandomColor(): string {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
</script>

<!-- Use a canvas element for Chart.js -->
<div class="relative h-full w-full" data-testid="linechart-container">
  <canvas bind:this={canvasElement} data-testid="linechart-canvas"></canvas>
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
    display: block; /* Prevent extra space below canvas */
    width: 100% !important; /* Ensure canvas fills container width */
    height: 100% !important; /* Ensure canvas fills container height */
  }
</style>
