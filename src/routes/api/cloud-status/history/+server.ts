import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

interface HistoricalAvailabilityOptions {
  startDate: string;
  endDate: string;
  serverTypeId?: number;
  locationId?: number;
  granularity?: "hour" | "day" | "week";
}

export const GET: RequestHandler = async ({ url, platform }) => {
  try {
    // Parse query parameters
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const serverTypeId = url.searchParams.get("serverTypeId");
    const locationId = url.searchParams.get("locationId");
    const granularity = url.searchParams.get("granularity") as
      | "hour"
      | "day"
      | "week"
      | null;

    // Validate required parameters
    if (!startDate || !endDate) {
      return json(
        { error: "Missing required parameters: startDate and endDate" },
        { status: 400 },
      );
    }

    // Validate date formats
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return json(
        {
          error:
            "Invalid date format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)",
        },
        { status: 400 },
      );
    }

    // Validate date range
    if (startDateObj >= endDateObj) {
      return json(
        { error: "startDate must be before endDate" },
        { status: 400 },
      );
    }

    // Check for worker binding
    if (!platform?.env?.RADAR_WORKER) {
      console.error("[cloud-status/history] RADAR_WORKER binding not found");
      return json(
        { error: "Cloud status service is not available" },
        { status: 503 },
      );
    }

    // Build options object
    const options: HistoricalAvailabilityOptions = {
      startDate: startDateObj.toISOString(),
      endDate: endDateObj.toISOString(),
    };

    // Add optional parameters
    if (serverTypeId) {
      const id = parseInt(serverTypeId, 10);
      if (!isNaN(id)) {
        options.serverTypeId = id;
      }
    }

    if (locationId) {
      const id = parseInt(locationId, 10);
      if (!isNaN(id)) {
        options.locationId = id;
      }
    }

    if (granularity && ["hour", "day", "week"].includes(granularity)) {
      options.granularity = granularity;
    }

    // Call the worker RPC method
    console.log(
      "[cloud-status/history] Fetching historical availability:",
      options,
    );
    const historicalData =
      await platform.env.RADAR_WORKER.getHistoricalAvailability(options);

    // Return the data
    return json({
      success: true,
      ...historicalData,
    });
  } catch (error) {
    console.error(
      "[cloud-status/history] Error fetching historical availability:",
      error,
    );

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return json(
      {
        error: "Failed to fetch historical availability data",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
};
