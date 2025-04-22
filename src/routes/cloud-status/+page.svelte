<script lang="ts">
  import type { PageData } from './$types';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import 'leaflet/dist/leaflet.css';
  import type L from 'leaflet';
  // No need to import CloudStatusData explicitly if we rely on PageData inference

  export let data: PageData;

  function formatTimestamp(timestamp: string | null | undefined): string {
    if (!timestamp) return 'Loading...';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(); // Or use toLocaleDateString() / toLocaleTimeString()
    } catch (e) {
      console.error("Error formatting timestamp:", e);
      return 'Invalid Date';
    }
  }

  function isAvailable(locationId: number, serverTypeId: number): boolean {
    if (!data.statusData?.availability) return false;
    const locationAvailability = data.statusData.availability[locationId];
    return locationAvailability ? locationAvailability.includes(serverTypeId) : false;
  }


  let map: L.Map | null = null;

  onMount(async () => {
    if (browser) {
      // Dynamically import Leaflet only on the client-side
      const L = await import('leaflet');

      if (data.statusData?.locations && document.getElementById('map')) {
        // Initialize the map
        map = L.map('map').setView([51.1657, 10.4515], 5); // Centered roughly on Germany

        // Add the tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Add markers for each location
        data.statusData.locations.forEach(location => {
          if (location.latitude && location.longitude) {
            L.marker([location.latitude, location.longitude])
              .bindPopup(location.name)
              .addTo(map!);
          }
        });
      }
    }
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });
</script>

<div class="p-4">
  <h1 class="text-2xl font-bold mb-4">Hetzner Cloud Server Availability</h1>

  {#if data.error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong class="font-bold">Error:</strong>
      <span class="block sm:inline">{data.error}</span>
    </div>
  {:else if data.statusData}
    <div class="mb-4 text-gray-600">
      Last Updated: {formatTimestamp(data.statusData.lastUpdated)}
    </div>

    <!-- Leaflet Map Container -->
    <div id="map" class="h-96 w-full mb-4 border border-gray-300 rounded"></div>


    <div class="overflow-x-auto">
      <table class="table-auto w-full border-collapse border border-gray-300">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-gray-300 px-4 py-2">Server Type</th>
            {#each data.statusData.locations as location}
              <th class="border border-gray-300 px-4 py-2 text-center">{location.name}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each data.statusData.serverTypes as serverType}
            <tr>
              <td class="border border-gray-300 px-4 py-2 font-semibold">{serverType.name}</td>
              {#each data.statusData.locations as location}
                {@const available = isAvailable(location.id, serverType.id)}
                <td class="border border-gray-300 px-4 py-2 text-center {available ? 'bg-green-100' : 'bg-red-100'}">
                  {available ? '✅' : '❌'}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p>Loading availability data...</p>
  {/if}
</div>