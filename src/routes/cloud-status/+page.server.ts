import { dev } from "$app/environment";
import type { PageServerLoad } from "./$types";

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
  cpu_type: "shared" | "dedicated";
  architecture: string;
  deprecated: boolean;
}

type AvailabilityMatrix = Record<number, number[]>;
type SupportMatrix = Record<number, number[]>;
type LastSeenMatrix = Record<string, string>; // key: "locationId-serverTypeId", value: ISO timestamp

export interface CloudStatusData {
  serverTypes: ServerTypeInfo[];
  locations: LocationInfo[];
  availability: AvailabilityMatrix;
  supported: SupportMatrix;
  lastUpdated: string | null;
  lastSeenAvailable?: LastSeenMatrix;
}

interface LoadOutput {
  statusData: CloudStatusData | null;
  error?: string;
  user?: any;
}

export const load: PageServerLoad = async ({
  platform,
  locals,
}): Promise<LoadOutput> => {
  console.log("Executing /cloud-status server load function...");

  try {
    // In development mode, use wrangler dev service binding
    if (dev) {
      console.log("Development mode: Using wrangler dev service binding");
      if (!platform?.env?.RADAR_WORKER) {
        throw new Error("RADAR_WORKER binding not found in development mode. Please run 'npx wrangler dev' instead of 'npm run dev'.");
      }
      const statusData = await platform.env.RADAR_WORKER.getStatus();
      return {
        statusData,
        user: locals.user,
      };
    }

    // In production mode, use the service binding
    if (!platform?.env?.RADAR_WORKER) {
      console.error(
        "FATAL: RADAR_WORKER binding not found in platform.env. Check wrangler.toml and deployment.",
      );
      return {
        statusData: null,
        error:
          "Cloud status service binding is not configured correctly on the server.",
      };
    }

    console.log(
      `[${new Date().toISOString()}] Calling getStatus() on RADAR_WORKER service binding...`,
    );

    const statusData: CloudStatusData =
      await platform.env.RADAR_WORKER.getStatus();
    console.log(
      `[${new Date().toISOString()}] Successfully received status data from DO via fetch.`,
    );

    return {
      statusData: statusData,
      user: locals.user,
    };
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] Error fetching cloud status from Durable Object:`,
      err,
    );

    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unknown error occurred while contacting the status service.";

    return {
      statusData: null,
      error: `Failed to load cloud availability status: ${errorMessage}`,
      user: locals.user,
    };
  }
};
