<script lang="ts">
	import * as d3 from 'd3';
	import { Spinner } from 'flowbite-svelte';
	import { tick } from 'svelte';

	export let data = null;
	export let loading = true;
	let noResults = false;

	let svgId = 'svg-' + Math.random().toString(36).slice(2, 9);

	function initializeChart(svgId, data) {
		const container = d3.select(`#${svgId}`);

		if (!container.node()) {
			console.error('chart container cannot be found');
			return;
		}

		const height = container.node().clientHeight;
		const width = container.node().clientWidth;
		const margin = { top: 20, right: 50, bottom: 70, left: 40 };

		const svg = container
			.append('svg')
			.attr('width', width)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Convert timestamps to Date objects
		const timestamps = [...new Set(data.map((d) => new Date(d.next_reduce_timestamp * 1000)))];

		// Use scaleTime for xScale
		const xScale = d3
			.scaleTime()
			.domain(d3.extent(timestamps))
			.range([0, width - margin.left - margin.right]);

		const yScale = d3
			.scaleLinear()
			.domain([d3.min(data, (d) => d.min_price) * 0.1, d3.max(data, (d) => d.max_price)])
			.range([height - margin.top - margin.bottom, 0]);

		// Append axes
		const xAxis = svg
			.append('g')
			.attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
			.call(
				d3
					.axisBottom(xScale)
					.tickFormat(d3.timeFormat('%d.%m.'))
					.tickValues(
						timestamps.filter((d, i) => !(i % Math.ceil(timestamps.length / (width / 50))))
					)
			);

		// Define the y-scale for the volume
		const yVolumeScale = d3
			.scaleLinear()
			.domain([0, d3.max(data, (d) => d.count)])
			.range([height - margin.top - margin.bottom, 0]);

		// Add the volume axis on the right
		const volumeAxis = svg
			.append('g')
			.attr('transform', `translate(${width - margin.left - margin.right}, 0)`)
			.call(d3.axisRight(yVolumeScale));
		volumeAxis
			.append('text')
			.attr('class', 'volume-axis-label')
			.attr('transform', 'rotate(-90)')
			.attr('y', -margin.right + 10)
			.attr('x', -height / 2)
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.text('Volume (units)');

		// Define the width of the bars manually
		const barWidth = ((width - margin.left - margin.right) / data.length) * 0.5;

		// Append the volume bars before the lines
		svg
			.selectAll('.volume-bar')
			.data(data)
			.enter()
			.append('rect')
			.attr('class', 'volume-bar')
			.attr('x', (d) => xScale(new Date(d.next_reduce_timestamp * 1000)) - barWidth / 2)
			.attr('y', (d) => yVolumeScale(d.count))
			.attr('width', barWidth)
			.attr('height', (d) => height - margin.top - margin.bottom - yVolumeScale(d.count))
			.attr('fill', 'lightgray')
			.attr('opacity', 0.5);

		xAxis.selectAll('text').attr('transform', 'rotate(-45)').style('text-anchor', 'end');

		const yAxis = svg.append('g').call(d3.axisLeft(yScale));
		yAxis
			.append('text')
			.attr('class', 'y-axis-label')
			.attr('transform', 'rotate(-90)')
			.attr('y', -margin.left + 10)
			.attr('x', -height / 2)
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.text('Price (EUR)');

		// Define gradients
		const defs = svg.append('defs');

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

		// Define area and line generators
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

		// Append areas and lines
		svg.append('path').datum(data).attr('fill', 'url(#gradientGreen)').attr('d', areaMinMean);
		svg.append('path').datum(data).attr('fill', 'url(#gradientRed)').attr('d', areaMeanMax);

		svg
			.append('path')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', 'lightgreen')
			.attr('stroke-width', 0.8)
			.attr('d', lineMean);

		svg
			.append('path')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', 'green')
			.attr('stroke-width', 2)
			// .attr('stroke-dasharray', '4,4')
			.attr('d', lineMin);

		svg
			.append('path')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', 'red')
			.attr('stroke-width', 0.5)
			// .attr('stroke-dasharray', '4,4')
			.attr('d', lineMax);

		// Append a vertical line for the crosshair
		const verticalLine = svg
			.append('line')
			.attr('class', 'crosshair')
			.attr('stroke', 'black')
			.attr('stroke-width', 1)
			.attr('y1', 0)
			.attr('y2', height - margin.top - margin.bottom)
			.style('display', 'none');

		// Append a horizontal line for the crosshair
		const horizontalLine = svg
			.append('line')
			.attr('class', 'crosshair')
			.attr('stroke', 'black')
			.attr('stroke-width', 1)
			.attr('x1', 0)
			.attr('x2', width - margin.left - margin.right)
			.style('display', 'none');

		// Add an overlay rectangle to capture mouse movements
		svg
			.append('rect')
			.attr('width', width - margin.left - margin.right)
			.attr('height', height - margin.top - margin.bottom)
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
				verticalLine.attr('x1', mouseX).attr('x2', mouseX);
				horizontalLine.attr('y1', mouseY).attr('y2', mouseY);
			});

		// Make the chart responsive to window resize
		window.addEventListener('resize', () => {
			const newWidth = container.node().clientWidth;
			const newHeight = container.node().clientHeight * 0.9;

			svg.attr('width', newWidth).attr('height', newHeight + margin.top + margin.bottom);

			xScale.range([0, newWidth - margin.left - margin.right]);
			yScale.range([newHeight - margin.top - margin.bottom, 0]);

			xAxis.call(
				d3
					.axisBottom(xScale)
					.tickFormat(d3.timeFormat('%d.%m.'))
					.tickValues(
						timestamps.filter((d, i) => !(i % Math.ceil(timestamps.length / (newWidth / 50))))
					)
			);
			xAxis.selectAll('text').attr('transform', 'rotate(-45)').style('text-anchor', 'end');

			yAxis.call(d3.axisLeft(yScale));

			svg.selectAll('.areaMinMean').attr('d', areaMinMean);
			svg.selectAll('.areaMeanMax').attr('d', areaMeanMax);
			svg.selectAll('.lineMean').attr('d', lineMean);
			svg.selectAll('.lineMin').attr('d', lineMin);
			svg.selectAll('.lineMax').attr('d', lineMax);
		});
	}

	$: noResults = data.length === 0;

	$: (async function () {
		await tick();
		if (Array.isArray(data) && data.length > 0) {
			d3.select(`#${svgId}`).selectAll('*').remove();
			initializeChart(svgId, data);
		}
	})();
</script>

<div class="container w-full">
	<h3
		class="px-5 pb-5 text-lg font-semibold text-left text-gray-900 bg-white dark:text-white dark:bg-gray-800"
	>
		Pricing
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			View the minimum, median and maximum server prices observed for the given configuration over
			the last three months. {#if data.length > 0}A total of {data.reduce(
					(sum, item) => sum + (item.count || 0),
					0
				)} offers have been seen.{/if}
		</p>
	</h3>
	<div class="w-full h-80 relative z-0">
		{#if loading}
			<div class="absolute inset-0 flex justify-center items-center z-10">
				<Spinner />
			</div>
		{:else if noResults}
			<div class="absolute inset-0 flex justify-center items-center z-10">
				<p class="text-2xl">No results.</p>
			</div>
		{/if}
		<div
			id={svgId}
			class:blur-sm={loading || noResults}
			class:pointer-events-none={loading || noResults}
			class="w-full h-full rounded-lg"
		></div>
	</div>
</div>
