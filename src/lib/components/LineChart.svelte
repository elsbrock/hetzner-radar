<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import * as d3 from 'd3';

	export let data: { name: string; data: { x: number; y: number }[] }[] = [];

	let container: HTMLElement;
	let svg: SVGSVGElement;
	let width = 0;
	let height = 0;
	let resizeObserver: ResizeObserver;

	let margin = { top: 20, right: 30, bottom: 70, left: 40 };

	function renderChart() {
		if (!container) {
			console.error('Chart container cannot be found');
			return;
		}

		// Clear previous chart
		clearChart();

		// Calculate width and height from the parent container
		setDimensions();

		// Parse timestamps and find global x and y extents
		const { x, y } = createScales(data);

		const line = createLineGenerator(x, y);

		renderAxes(x, y);
		renderLines(data, line);
	}

	function clearChart() {
		d3.select(svg).selectAll('*').remove();
	}

	function setDimensions() {
		width = container.clientWidth;
		height = container.clientHeight;
	}

	function createScales(datasets) {
		const allData = datasets.flatMap((d) => d.data);
		const x = d3
			.scaleTime()
			.domain(d3.extent(allData, (d) => new Date(d.x * 1000)))
			.range([margin.left, width - margin.right]);

		const y = d3
			.scaleLinear()
			.domain([
				d3.min(allData, (d) => d.y) * 0.95,
				d3.max(allData, (d) => d.y) * 1.05,
			])
			.range([height - margin.bottom, margin.top]);

		return { x, y };
	}

	function createLineGenerator(x, y) {
		return d3
			.line<{ x: number; y: number }>()
			.x((d) => x(new Date(d.x * 1000)))
			.y((d) => y(d.y))
			.curve(d3.curveCatmullRom);
	}

	function renderAxes(x, y) {
		const xAxis = (g) =>
			g
				.attr('transform', `translate(0,${height - margin.bottom})`)
				.call(d3.axisBottom(x).tickFormat(d3.timeFormat('%d.%m.')).ticks(width / 80).tickSizeOuter(0))
				.call((g) => g.selectAll('text').attr('transform', 'rotate(-45)').style('text-anchor', 'end'));

		const yAxis = (g) =>
			g
				.attr('transform', `translate(${margin.left},0)`)
				.call(d3.axisLeft(y))
				.call((g) => g.select('.domain').remove());

		d3.select(svg).attr('width', width).attr('height', height);
		d3.select(svg).append('g').call(xAxis);
		d3.select(svg).append('g').call(yAxis);
	}

	function renderLines(datasets, line) {
		const color = d3.scaleOrdinal(d3.schemeCategory10);

		datasets.forEach((dataset, i) => {
			d3.select(svg)
				.append('g')
				.append('path')
				.datum(dataset.data)
				.attr('fill', 'none')
				.attr('stroke', color(i))
				.attr('stroke-width', 1.5)
				.attr('d', line);
		});

		renderLegend(datasets, color);
	}

	function renderLegend(datasets, color) {
	const legendPadding = 20; // Padding between legend items
	const verticalPadding = 10; // Additional padding to move the legend further below the x-axis
	let currentX = 0;

	const legend = d3.select(svg)
		.append('g')
		.attr(
			'transform',
			`translate(${(width - calculateTotalLegendWidth(datasets, legendPadding)) / 2},${height - margin.bottom + 40 + verticalPadding})`
		);

	datasets.forEach((dataset, i) => {
		const legendItem = legend.append('g').attr('transform', `translate(${currentX}, 0)`);

		legendItem
			.append('rect')
			.attr('width', 10)
			.attr('height', 10)
			.attr('fill', color(i));

		legendItem
			.append('text')
			.attr('x', 15)
			.attr('y', 9) // Adjusted to align with the smaller text size
			.attr('text-anchor', 'start')
			.style('alignment-baseline', 'middle')
			.style('font-size', '12px') // Reduced font size for the legend text
			.text(dataset.name);

		// Update the currentX position for the next legend item
		currentX += legendItem.node().getBBox().width + legendPadding;
	});
}

function calculateTotalLegendWidth(datasets, legendPadding) {
	// Create a temporary SVG element to measure the width of the legend items
	const tempSvg = d3.select('body').append('svg').attr('visibility', 'hidden');

	let totalWidth = 0;

	datasets.forEach((dataset, i) => {
		const legendItem = tempSvg.append('g');

		legendItem
			.append('rect')
			.attr('width', 10)
			.attr('height', 10)
			.attr('fill', 'black'); // Color doesn't matter for measurement

		legendItem
			.append('text')
			.attr('x', 15)
			.attr('y', 9) // Match the vertical alignment with the main legend
			.style('font-size', '12px') // Use the same font size for accurate width measurement
			.text(dataset.name);

		totalWidth += legendItem.node().getBBox().width + legendPadding;
	});

	tempSvg.remove();

	return totalWidth - legendPadding; // Subtract the last padding
}


	onMount(() => {
		renderChart();
		resizeObserver = new ResizeObserver(() => {
			renderChart();
		});
		resizeObserver.observe(container);
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
	});

	$: (async function () {
		await tick();
		if (Array.isArray(data) && data.length > 0) {
			renderChart();
		}
	})();
</script>

<div bind:this={container} style="width: 100%; height: 100%;">
	<svg bind:this={svg}></svg>
</div>

<style>
	div {
		display: block;
		position: relative;
	}
	svg {
		width: 100%;
		height: 100%;
	}
</style>
