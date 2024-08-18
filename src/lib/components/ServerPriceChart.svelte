<script lang="ts">
	import type { ServerPriceStat } from '$lib/dbapi';
	import * as d3 from 'd3';
	import { Spinner } from 'flowbite-svelte';
	import { onDestroy, onMount, tick } from 'svelte';

	export let data: ServerPriceStat[] | null = null;

	export let loading: boolean = true;
	let noResults = false;

	const margin = { top: 10, right: 50, bottom: 50, left: 50 };

	let container: HTMLElement;
	let svg: SVGSVGElement;
	let resizeObserver: ResizeObserver;

	function renderChart() {
		if (!Array.isArray(data) || data.length === 0) {
			return;
		}
		clearChart();
		const { width, height } = getDimensions();
		const timestamps = getTimestamps(data);
		const xScale = createXScale(timestamps, width, margin);
		const yScale = createYScale(data, height, margin);
		const yVolumeScale = createYVolumeScale(data, height, margin);
		setupSVG(width, height);
		renderAxes(xScale, yScale, yVolumeScale, width, height, margin, timestamps);
		renderVolumeBars(data, xScale, yVolumeScale, width, height, margin);
		renderAreasAndLines(data, xScale, yScale);
		setupCrosshair(width, height, margin);
	}

	function clearChart() {
		d3.select(svg).selectAll('*').remove();
	}

	function getDimensions() {
		const width = container.clientWidth;
		const height = container.clientHeight;
		return { width, height, margin };
	}

	function getTimestamps(data: ServerPriceStat) {
		return [...new Set(data.map((d) => new Date(d.next_reduce_timestamp * 1000)))];
	}

	function createXScale(timestamps, width, margin) {
		return d3
			.scaleTime()
			.domain(d3.extent(timestamps))
			.range([margin.left, width - margin.right]);
	}

	function createYScale(data, height, margin) {
		return d3
			.scaleLinear()
			.domain([d3.min(data, (d) => d.min_price) * 0.9, d3.max(data, (d) => d.max_price)*1.1])
			.range([height - margin.bottom, margin.top]);
	}

	function createYVolumeScale(data, height, margin) {
		return d3
			.scaleLinear()
			.domain([0, d3.max(data, (d) => d.count)])
			.range([height - margin.bottom, margin.top]);
	}

	function setupSVG(width, height) {
		d3.select(svg).attr('width', width).attr('height', height);
	}

	function renderAxes(xScale, yScale, yVolumeScale, width, height, margin, timestamps) {
		// X Axis
		const xAxis = d3
			.select(svg)
			.append('g')
			.attr('transform', `translate(0,${height - margin.bottom})`)
			.call(
				d3
					.axisBottom(xScale)
					.tickFormat(d3.timeFormat('%d.%m.'))
					.tickValues(
						timestamps.filter((d, i) => !(i % Math.ceil(timestamps.length / (width / 50))))
					)
			);

		xAxis.selectAll('text').attr('transform', 'rotate(-45)').style('text-anchor', 'end');

		// Left Y Axis (Price)
		const yAxis = d3
			.select(svg)
			.append('g')
			.attr('transform', `translate(${margin.left},0)`)
			.call(d3.axisLeft(yScale));

		yAxis
			.append('text')
			.attr('class', 'y-axis-label')
			.attr('transform', 'rotate(-90)')
			.attr('y', 0 - margin.left + 20) // Adjusted to ensure visibility
			.attr('x', 0 - (height - margin.top - margin.bottom) / 2) // Adjusted to center label correctly
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.text('Price (EUR)');

		// Right Y Axis (Volume)
		const volumeAxis = d3
			.select(svg)
			.append('g')
			.attr('transform', `translate(${width - margin.right}, 0)`)
			.call(d3.axisRight(yVolumeScale));

		volumeAxis
			.append('text')
			.attr('class', 'volume-axis-label')
			.attr('transform', 'rotate(-90)')
			.attr('y', 0 - margin.right + 20) // Adjusted to ensure visibility
			.attr('x', 0 - (height - margin.top - margin.bottom) / 2) // Adjusted to center label correctly
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.text('Volume (units)');
	}

	function renderVolumeBars(data, xScale, yVolumeScale, width, height, margin) {
		const barWidth = ((width - margin.left - margin.right) / data.length) * 0.5;

		d3.select(svg)
			.selectAll('.volume-bar')
			.data(data)
			.enter()
			.append('rect')
			.attr('class', 'volume-bar')
			.attr('x', (d, i) => {
				const xPos = xScale(new Date(d.next_reduce_timestamp * 1000)) - barWidth / 2;
				// Ensure bars don't exceed the plot area
				return Math.max(margin.left, Math.min(xPos, width - margin.right - barWidth));
			})
			.attr('y', (d) => yVolumeScale(d.count))
			.attr('width', barWidth)
			.attr('height', (d) => height - margin.bottom - yVolumeScale(d.count))
			.attr('fill', 'lightgray')
			.attr('opacity', 0.5);
	}

	function renderAreasAndLines(data, xScale, yScale) {
		const defs = createGradients();

		const areaMinMean = d3
			.area()
			.x((d) => xScale(new Date(d.next_reduce_timestamp * 1000)))
			.y0((d) => yScale(d.min_price))
			.y1((d) => yScale(d.mean_price));

		const areaMeanMax = d3
			.area()
			.x((d) => xScale(new Date(d.next_reduce_timestamp * 1000)))
			.y0((d) => yScale(d.mean_price))
			.y1((d) => yScale(d.max_price));

		const lineMean = d3
			.line()
			.curve(d3.curveMonotoneX)
			.x((d) => xScale(new Date(d.next_reduce_timestamp * 1000)))
			.y((d) => yScale(d.mean_price));

		const lineMin = d3
			.line()
			.curve(d3.curveMonotoneX)
			.x((d) => xScale(new Date(d.next_reduce_timestamp * 1000)))
			.y((d) => yScale(d.min_price));

		const lineMax = d3
			.line()
			.curve(d3.curveMonotoneX)
			.x((d) => xScale(new Date(d.next_reduce_timestamp * 1000)))
			.y((d) => yScale(d.max_price));

		d3.select(svg)
			.append('path')
			.datum(data)
			.attr('fill', 'url(#gradientGreen)')
			.attr('d', areaMinMean);
		d3.select(svg)
			.append('path')
			.datum(data)
			.attr('fill', 'url(#gradientRed)')
			.attr('d', areaMeanMax);

		d3.select(svg)
			.append('path')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', 'lightgreen')
			.attr('stroke-width', 0.8)
			.attr('d', lineMean);
		d3.select(svg)
			.append('path')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', 'green')
			.attr('stroke-width', 2)
			.attr('d', lineMin);
		d3.select(svg)
			.append('path')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', 'red')
			.attr('stroke-width', 0.5)
			.attr('d', lineMax);
	}

	function createGradients() {
		const defs = d3.select(svg).append('defs');

		const gradientGreen = defs
			.append('linearGradient')
			.attr('id', 'gradientGreen')
			.attr('x1', '0%')
			.attr('y1', '0%')
			.attr('x2', '0%')
			.attr('y2', '100%');

		gradientGreen
			.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', 'green')
			.attr('stop-opacity', 0);
		gradientGreen
			.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', 'green')
			.attr('stop-opacity', 0.5);

		const gradientRed = defs
			.append('linearGradient')
			.attr('id', 'gradientRed')
			.attr('x1', '0%')
			.attr('y1', '0%')
			.attr('x2', '0%')
			.attr('y2', '100%');

		gradientRed
			.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', 'red')
			.attr('stop-opacity', 0);
		gradientRed
			.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', 'red')
			.attr('stop-opacity', 0.4);

		return defs;
	}

	function setupCrosshair(width, height, margin) {
		// Create the vertical line and adjust y-coordinates to consider the margin
		const verticalLine = d3
			.select(svg)
			.append('line')
			.attr('class', 'crosshair')
			.attr('stroke', 'black')
			.attr('stroke-width', 0.5)
			.attr('stroke-dasharray', '4,4')
			.attr('y1', margin.top)
			.attr('y2', height - margin.bottom)
			.style('display', 'none');

		// Create the horizontal line and adjust x-coordinates to consider the margin
		const horizontalLine = d3
			.select(svg)
			.append('line')
			.attr('class', 'crosshair')
			.attr('stroke', 'black')
			.attr('stroke-width', 0.5)
			.attr('stroke-dasharray', '4,4')
			.attr('x1', margin.left)
			.attr('x2', width - margin.right)
			.style('display', 'none');

		// Add a transparent rectangle for capturing mouse events
		d3.select(svg)
			.append('rect')
			.attr('width', width - margin.left - margin.right)
			.attr('height', height - margin.top - margin.bottom)
			.attr('transform', `translate(${margin.left},${margin.top})`)
			.style('fill', 'none')
			.style('pointer-events', 'all')
			.on('mouseover', () => {
				verticalLine.style('display', null);
				horizontalLine.style('display', null);
			})
			.on('mouseout', () => {
				verticalLine.style('display', 'none');
				horizontalLine.style('display', 'none');
			})
			.on('mousemove', (event) => {
				const [mouseX, mouseY] = d3.pointer(event);
				// Adjust the position of the crosshair lines to account for margins
				verticalLine.attr('x1', mouseX + margin.left).attr('x2', mouseX + margin.left);
				horizontalLine.attr('y1', mouseY + margin.top).attr('y2', mouseY + margin.top);
			});
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

	$: noResults = Array.isArray(data) && data.length === 0;

	$: (async function () {
	  await tick();
	  if (Array.isArray(data) && data.length > 0) {
	    renderChart();
	  }
	})();
</script>

<div class="relative z-0 h-80 w-full">
	{#if loading}
		<div class="absolute inset-0 z-10 flex items-center justify-center">
			<Spinner />
		</div>
	{:else if noResults}
		<div class="absolute inset-0 z-10 flex items-center justify-center">
			<p class="text-2xl">No results.</p>
		</div>
	{/if}
	<div
		bind:this={container}
		class:blur-sm={loading || noResults}
		class:pointer-events-none={loading || noResults}
		style="width: 100%; height: 100%"
	>
		<svg bind:this={svg}></svg>
	</div>
</div>