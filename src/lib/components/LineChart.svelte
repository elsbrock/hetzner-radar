<script lang="ts">
  import type { ChartOptions } from "chart.js";
  import GenericChart from "./GenericChart.svelte";

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
</script>

<!-- Use GenericChart with type="line" for backward compatibility -->
<GenericChart {data} options={userOptions} {legendShow} type="line" />
