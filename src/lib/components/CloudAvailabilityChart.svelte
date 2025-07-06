<script lang="ts">
	import GenericChart from './GenericChart.svelte';
	import type { ChartOptions } from 'chart.js';
	import { Spinner, Alert } from 'flowbite-svelte';
	
	interface AvailabilityDataPoint {
		timestamp: string;
		serverTypeId: number;
		locationId: number;
		serverTypeName: string;
		locationName: string;
		available: boolean;
		availabilityRate?: number;
	}
	
	interface Props {
		startDate: Date;
		endDate: Date;
		serverTypeId?: number;
		locationId?: number;
		granularity?: 'hour' | 'day' | 'week';
		viewMode: 'location' | 'serverType';
		selectedLocationId?: number;
		selectedServerTypeId?: number;
		serverTypes?: { id: number; name: string }[];
		locations?: { id: number; name: string; city: string }[];
	}
	
	let {
		startDate,
		endDate,
		serverTypeId: _serverTypeId,
		locationId: _locationId,
		granularity = 'hour',
		viewMode,
		selectedLocationId,
		selectedServerTypeId,
		serverTypes = [],
		locations = []
	}: Props = $props();
	
	let loading = $state(true);
	let error = $state<string | null>(null);
	let chartData = $state<any[]>([]);
	
	// Fetch data when parameters change
	$effect(() => {
		if (viewMode === 'location' && !selectedLocationId) return;
		if (viewMode === 'serverType' && !selectedServerTypeId) return;
		
		fetchData();
	});
	
	async function fetchData() {
		loading = true;
		error = null;
		
		try {
			const params = new URLSearchParams({
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
				granularity
			});
			
			// Add filters based on view mode
			if (viewMode === 'location' && selectedLocationId) {
				params.append('locationId', selectedLocationId.toString());
			} else if (viewMode === 'serverType' && selectedServerTypeId) {
				params.append('serverTypeId', selectedServerTypeId.toString());
			}
			
			const response = await fetch(`/api/cloud-status/history?${params}`);
			
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to fetch data');
			}
			
			const result = await response.json();
			
			if (!result.data || result.data.length === 0) {
				chartData = [];
				return;
			}
			
			// Transform data based on view mode
			if (viewMode === 'location') {
				// Show all server types at selected location
				chartData = transformDataForLocationView(result.data);
			} else {
				// Show selected server type across all locations
				chartData = transformDataForServerTypeView(result.data);
			}
			
		} catch (err) {
			console.error('Error fetching availability data:', err);
			error = err instanceof Error ? err.message : 'Failed to load data';
			chartData = [];
		} finally {
			loading = false;
		}
	}
	
	function transformDataForLocationView(data: AvailabilityDataPoint[]) {
		// Group by server type
		const groupedData = new Map<number, AvailabilityDataPoint[]>();
		
		data.forEach(point => {
			if (!groupedData.has(point.serverTypeId)) {
				groupedData.set(point.serverTypeId, []);
			}
			groupedData.get(point.serverTypeId)!.push(point);
		});
		
		// Create series for each server type
		return Array.from(groupedData.entries()).map(([serverTypeId, points]) => {
			const serverType = serverTypes.find(st => st.id === serverTypeId);
			const name = serverType?.name || points[0]?.serverTypeName || `Server ${serverTypeId}`;
			
			return {
				name,
				data: points.map(p => ({
					x: new Date(p.timestamp).getTime() / 1000, // Convert to seconds
					y: p.available ? 1 : 0
				})),
				color: getColorForServerType(serverTypeId)
			};
		});
	}
	
	function transformDataForServerTypeView(data: AvailabilityDataPoint[]) {
		// Group by location
		const groupedData = new Map<number, AvailabilityDataPoint[]>();
		
		data.forEach(point => {
			if (!groupedData.has(point.locationId)) {
				groupedData.set(point.locationId, []);
			}
			groupedData.get(point.locationId)!.push(point);
		});
		
		// Create series for each location
		return Array.from(groupedData.entries()).map(([locationId, points]) => {
			const location = locations.find(loc => loc.id === locationId);
			const name = location?.city || points[0]?.locationName || `Location ${locationId}`;
			
			return {
				name,
				data: points.map(p => ({
					x: new Date(p.timestamp).getTime() / 1000,
					y: p.available ? 1 : 0
				})),
				color: getColorForLocation(locationId)
			};
		});
	}
	
	function getColorForServerType(id: number): string {
		// Use consistent colors for server types
		const colors = [
			'#10b981', // emerald-500
			'#3b82f6', // blue-500
			'#f59e0b', // amber-500
			'#ef4444', // red-500
			'#8b5cf6', // violet-500
			'#ec4899', // pink-500
			'#14b8a6', // teal-500
			'#f97316', // orange-500
		];
		return colors[id % colors.length];
	}
	
	function getColorForLocation(id: number): string {
		// Use different color palette for locations
		const colors = [
			'#0ea5e9', // sky-500
			'#22c55e', // green-500
			'#a855f7', // purple-500
			'#eab308', // yellow-500
			'#06b6d4', // cyan-500
			'#f43f5e', // rose-500
			'#84cc16', // lime-500
			'#6366f1', // indigo-500
		];
		return colors[id % colors.length];
	}
	
	// Chart options for availability visualization
	const chartOptions: Partial<ChartOptions<'line'>> = {
		scales: {
			x: {
				type: 'time',
				time: {
					unit: granularity === 'hour' ? 'hour' : granularity === 'day' ? 'day' : 'week',
					displayFormats: {
						hour: 'MMM dd HH:mm',
						day: 'MMM dd',
						week: 'MMM dd'
					}
				},
				title: {
					display: true,
					text: 'Time'
				}
			},
			y: {
				min: -0.1,
				max: 1.1,
				ticks: {
					stepSize: 1,
					callback: function(value) {
						return value === 1 ? 'Available' : value === 0 ? 'Not Available' : '';
					}
				},
				title: {
					display: true,
					text: 'Availability'
				}
			}
		},
		elements: {
			line: {
				stepped: true, // Binary availability = stepped lines
				borderWidth: 2
			},
			point: {
				radius: 0 // Hide points for cleaner look
			}
		},
		plugins: {
			tooltip: {
				callbacks: {
					label: function(context) {
						const label = context.dataset.label || '';
						const value = context.parsed.y;
						return `${label}: ${value === 1 ? 'Available' : 'Not Available'}`;
					}
				}
			},
			legend: {
				display: true,
				position: 'bottom'
			}
		}
	};
</script>

<div class="w-full">
	{#if loading}
		<div class="flex h-96 items-center justify-center">
			<Spinner size="8" />
			<p class="ml-3 text-gray-600 dark:text-gray-300">Loading availability data...</p>
		</div>
	{:else if error}
		<Alert color="red">
			<strong>Error:</strong> {error}
		</Alert>
	{:else if chartData.length === 0}
		<Alert color="yellow">
			No availability data found for the selected time period and filters.
		</Alert>
	{:else}
		<div class="h-96">
			<GenericChart 
				data={chartData} 
				options={chartOptions} 
				type="line"
				legendShow={true}
			/>
		</div>
	{/if}
</div>