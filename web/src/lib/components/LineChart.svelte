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
			console.error('chart container cannot be found');
			return;
		}

		// Clear previous chart
		d3.select(svg).selectAll('*').remove();

		// Calculate width and height from the parent container
		width = container.clientWidth;
		height = container.clientHeight;

		const parseTime = d3.timeParse('%s');
		const formatDate = d3.timeFormat('%d.%m.');

		// Check if data is multi-line or single-line and normalize accordingly
		const isMultiLine = Array.isArray(data[0]);

		const datasets = isMultiLine ? data : [data];

		// Parse timestamps and find global x and y extents
		datasets.forEach((dataset) => {
			dataset.forEach((d) => {
				d.x = parseTime(d.x);
			});
		});

		const x = d3
			.scaleTime()
			.domain([
				d3.min(datasets, (dataset) => d3.min(dataset, (d) => d.x)),
				d3.max(datasets, (dataset) => d3.max(dataset, (d) => d.x))
			])
			.range([margin.left, width - margin.right]);

		const y = d3
			.scaleLinear()
			.domain([
				d3.min(datasets, (dataset) => d3.min(dataset, (d) => d.y)) * 0.95,
				d3.max(datasets, (dataset) => d3.max(dataset, (d) => d.y)) * 1.05
			])
			.range([height - margin.bottom, margin.top]);

		const line = d3
			.line()
			.x((d) => x(d.x))
			.y((d) => y(d.y))
			.curve(d3.curveCatmullRom);

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

		const color = d3.scaleOrdinal(d3.schemeCategory10);

		// Loop through datasets and plot each line
		datasets.forEach((dataset, i) => {
			d3.select(svg)
				.append('path')
				.datum(dataset)
				.attr('fill', 'none')
				.attr('stroke', color(i))
				.attr('stroke-width', 1.5)
				.attr('d', line);

			// Draw circles for each data point in the line
			// d3.select(svg)
			// 	.selectAll(`.dot-${i}`)
			// 	.data(dataset)
			// 	.join('circle')
			// 	.attr('class', `dot-${i}`)
			// 	.attr('cx', (d) => x(d.x))
			// 	.attr('cy', (d) => y(d.y))
			// 	.attr('r', 3)
			// 	.attr('fill', color(i));
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
