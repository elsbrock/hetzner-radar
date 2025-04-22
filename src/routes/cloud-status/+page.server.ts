// src/routes/cloud-status/+page.server.ts
import type { PageServerLoad } from './$types';
import type { Fetcher } from '@cloudflare/workers-types'; // Changed import

// --- Types (copied/adapted from workers/cloud-availability/src/index.ts) ---
interface LocationInfo {
    id: number;
    name: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
}

interface ServerTypeInfo {
    id: number;
    name: string;
    description: string;
    cores: number; // Added
    memory: number; // Added
    disk: number; // Added
    cpu_type: 'shared' | 'dedicated'; // Added
    architecture: string; // Added
    deprecated: boolean; // Added
}

// Availability Matrix: Record<locationId: number, availableServerTypeIds: number[]>
// Removed CloudAvailabilityDO interface as we use fetch now
type AvailabilityMatrix = Record<number, number[]>;

// Export the main data structure for potential use in +page.svelte
export interface CloudStatusData {
    serverTypes: ServerTypeInfo[];
    locations: LocationInfo[];
    availability: AvailabilityMatrix;
    lastUpdated: string | null; // ISO string
}

// Define the expected return type for the SvelteKit load function
interface LoadOutput {
    statusData: CloudStatusData | null;
    error?: string; // Include an error message if fetching fails
}

export const load: PageServerLoad = async ({ platform }): Promise<LoadOutput> => {
    console.log('Executing /cloud-status server load function...');

    // Basic check to ensure the binding exists on the platform object
    if (!platform?.env?.CLOUD_STATUS) {
        console.error('FATAL: CLOUD_STATUS binding not found in platform.env. Check wrangler.toml and deployment.');
        return {
            statusData: null,
            error: 'Cloud status service binding is not configured correctly on the server.',
        };
    }

    try {
        console.log(`[${new Date().toISOString()}] Calling getStatus() on CLOUD_STATUS service binding...`);

        const statusData: CloudStatusData = await platform.env.CLOUD_STATUS.getStatus();
        console.log(`[${new Date().toISOString()}] Successfully received status data from DO via fetch.`);
        // console.debug('Received status data:', JSON.stringify(statusData, null, 2)); // Optional: Log full data for debugging

        // Return the fetched data successfully
        return {
            statusData: statusData,
        };
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error fetching cloud status from Durable Object:`, err);

        // Determine a user-friendly error message
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while contacting the status service.';

        // Return null data and the error message
        return {
            statusData: null,
            error: `Failed to load cloud availability status: ${errorMessage}`,
        };
    }
};