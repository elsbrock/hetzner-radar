 import type { PageServerLoad } from './$types';
 
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
    cores: number;
    memory: number;
    disk: number;
    cpu_type: 'shared' | 'dedicated';
    architecture: string;
    deprecated: boolean;
   }
   
   type AvailabilityMatrix = Record<number, number[]>;
   
   export interface CloudStatusData {
    serverTypes: ServerTypeInfo[];
    locations: LocationInfo[];
    availability: AvailabilityMatrix;
    lastUpdated: string | null;
   }
   
   interface LoadOutput {
    statusData: CloudStatusData | null;
    error?: string;
   }
   
   export const load: PageServerLoad = async ({ platform, locals }): Promise<LoadOutput> => {
    console.log('Executing /cloud-status server load function...');

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
      
        return {
        	statusData: statusData,
        	user: locals.user
        };
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error fetching cloud status from Durable Object:`, err);

        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while contacting the status service.';
      
        return {
        	statusData: null,
        	error: `Failed to load cloud availability status: ${errorMessage}`,
        	user: locals.user
        };
    }
};