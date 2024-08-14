<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import * as d3 from 'd3';

	export let data = [];

	let container;
	let svg;
	let width = 0;
	let height = 0;
	let resizeObserver: ResizeObserver;

	let margin = { top: 20, right: 30, bottom: 50, left: 40 };

	function renderChart() {
		if (!container) {
			console.error('Chart container cannot be found');
			return;
		}

		// Clear previous chart
		clearChart();

		// Calculate width and height from the parent container
		setDimensions();

		const parseTime = d3.timeParse('%s');
		const formatDate = d3.timeFormat('%d.%m.');

		// Check if data is multi-line or single-line and normalize accordingly
		const datasets = normalizeData();

		// Parse timestamps and find global x and y extents
		parseTimestamps(datasets, parseTime);

		const x = createXScale(datasets);
		const y = createYScale(datasets);

		const line = createLineGenerator(x, y);

		renderAxes(x, y, formatDate);
		renderLines(datasets, line);
	}

	function clearChart() {
		d3.select(svg).selectAll('*').remove();
	}

	function setDimensions() {
		width = container.clientWidth;
		height = container.clientHeight;
	}

	function normalizeData() {
		return Array.isArray(data[0]) ? data : [data];
	}

	function parseTimestamps(datasets, parseTime) {
		datasets.forEach((dataset) => {
			dataset.forEach((d) => {
				d.x = parseTime(d.x);
			});
		});
	}

	function createXScale(datasets) {
		return d3
			.scaleTime()
			.domain([
				d3.min(datasets, (dataset) => d3.min(dataset, (d) => d.x)),
				d3.max(datasets, (dataset) => d3.max(dataset, (d) => d.x))
			])
			.range([margin.left, width - margin.right]);
	}

	function createYScale(datasets) {
		return d3
			.scaleLinear()
			.domain([
				d3.min(datasets, (dataset) => d3.min(dataset, (d) => d.y)) * 0.95,
				d3.max(datasets, (dataset) => d3.max(dataset, (d) => d.y)) * 1.05
			])
			.range([height - margin.bottom, margin.top]);
	}

	function createLineGenerator(x, y) {
		return d3
			.line()
			.x((d) => x(d.x))
			.y((d) => y(d.y))
			.curve(d3.curveCatmullRom);
	}

	function renderAxes(x, y, formatDate) {
		const xAxis = (g) =>
			g
				.attr('transform', `translate(0,${height - margin.bottom})`)
				.call(
					d3
						.axisBottom(x)
						.tickFormat(formatDate)
						.ticks(width / 80)
						.tickSizeOuter(0)
				)
				.call((g) =>
					g.selectAll('text').attr('transform', 'rotate(-45)').style('text-anchor', 'end')
				);

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
				.append('path')
				.datum(dataset)
				.attr('fill', 'none')
				.attr('stroke', color(i))
				.attr('stroke-width', 1.5)
				.attr('d', line);
		});
	}

	onMount(async () => {
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
