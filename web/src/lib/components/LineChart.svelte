<script lang="ts">
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
      // Clear previous chart
      d3.select(svg).selectAll("*").remove();

      // Calculate width and height from the parent container
      width = container.clientWidth;
      height = container.clientHeight;

      const parseTime = d3.timeParse('%s');
      const formatDate = d3.timeFormat('%d.%m.');

      data.forEach(d => {
        d.date = parseTime(d.x);
      });

      const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.x))
        .range([margin.left, width - margin.right]);

      const y = d3.scaleLinear()
        .domain([d3.min(data, d => d.y)*0.95, d3.max(data, d => d.y)*1.05])
        .range([height - margin.bottom, margin.top]);

      const line = d3.line()
        .x(d => x(d.x))
        .y(d => y(d.y))
        .curve(d3.curveCatmullRom);

      const xAxis = g => g
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(formatDate).ticks(width / 80).tickSizeOuter(0))
        .call(g => g.selectAll("text")
          .attr("transform", "rotate(-45)")
          .style("text-anchor", "end"));

      const yAxis = g => g
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y))
        .call(g => g.select('.domain').remove());

      d3.select(svg)
        .attr('width', width)
        .attr('height', height);

      d3.select(svg).append('g').call(xAxis);
      d3.select(svg).append('g').call(yAxis);

      d3.select(svg).append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('d', line);

      // Ensure all data points are covered
      d3.select(svg).selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.value))
        .attr("r", 3)
        .attr("fill", "steelblue");
    };
    
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