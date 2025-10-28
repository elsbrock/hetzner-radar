import {
  createAlert,
  deleteAlert,
  getAlertsForUser,
  isBelowMaxAlerts,
  MAX_NAME_LENGTH,
  updateAlert,
} from "$lib/api/backend/alerts";
import { getUser } from "$lib/api/backend/user";
import { getCloudAlertsForUser } from "$lib/api/backend/cloud-alerts";
import { MAX_PRICE, MIN_PRICE } from "$lib/constants";
import {
  error,
  fail,
  type Actions,
  type ServerLoad,
  type RequestEvent,
  type ServerLoadEvent,
} from "@sveltejs/kit";

/** @type {import('./$types').PageServerLoad} */
export const load: ServerLoad = async (event: ServerLoadEvent) => {
  const env = event.platform?.env;
  const db = env?.DB;

  if (!db) {
    throw error(500, "Database binding is not configured");
  }

  // Fetch cloud status data for server types and locations
  let cloudStatusData = null;
  try {
    if (env?.CLOUD_STATUS) {
      const cloudStatusWorker = env.CLOUD_STATUS;
      cloudStatusData = await cloudStatusWorker.getStatus();
    }
  } catch (error) {
    console.error("Failed to fetch cloud status data:", error);
  }

  const [alertResults, user, cloudAlerts] = await Promise.all([
    getAlertsForUser(db, event.locals.user!.id.toString()),
    getUser(db, event.locals.user!.id.toString()),
    getCloudAlertsForUser(db, event.locals.user!.id.toString()),
  ]);

  return {
    alerts: {
      active: alertResults.activeResults,
      triggered: alertResults.triggeredResults,
    },
    cloudAlerts,
    cloudStatusData,
    user: {
      discord_webhook_url: user?.discord_webhook_url,
      notification_preferences: user?.notification_preferences || {
        email: true,
        discord: false,
      },
    },
  };
};

function validateAlert(name: string, price: string, filter?: string) {
  const errors: Record<string, string> = {};

  // Validate name
  if (!name || name.trim() === "") {
    errors.name = "Name is required.";
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be at most ${MAX_NAME_LENGTH} characters.`;
  }

  // Validate price
  if (!price || price.trim() === "") {
    errors.price = "Price is required.";
  } else {
    const priceNumber = Number(price);
    if (!Number.isInteger(priceNumber)) {
      errors.price = "Price must be an integer.";
    } else if (priceNumber < MIN_PRICE || priceNumber > MAX_PRICE) {
      errors.price = `Price must be between ${MIN_PRICE} and ${MAX_PRICE}.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export const actions: Actions = {
  add: async (event: RequestEvent) => {
    const env = event.platform?.env;
    const db = env?.DB;

    if (!db) {
      return fail(500, {
        success: false,
        error: "Database binding is not configured.",
      });
    }
    const formData = await event.request.formData();
    const name = formData.get("name") as string;
    const filter = formData.get("filter") as string;
    const price = formData.get("price") as string;
    const vatRateStr = formData.get("vatRate") as string;
    const emailNotifications = formData.get("emailNotifications") === "true";
    const discordNotifications =
      formData.get("discordNotifications") === "true";

    // Validate that at least one notification method is selected
    if (!emailNotifications && !discordNotifications) {
      return fail(400, {
        success: false,
        error: "At least one notification method must be selected.",
      });
    }

    // Validate vatRate
    const vatRateNum = parseInt(vatRateStr, 10);
    if (isNaN(vatRateNum)) {
      // Return specific error for vatRate if it's invalid
      return fail(400, {
        success: false,
        errors: { vatRate: "VAT Rate must be a valid number." },
      });
    }
    const { isValid, errors } = validateAlert(name, price, filter);

    if (!isValid) {
      return fail(400, { success: false, errors });
    }

    // verify user is below the limit
    const isBelow = await isBelowMaxAlerts(
      db,
      event.locals.user!.id.toString(),
    );
    if (!isBelow) {
      return fail(400, { success: false, error: "Maximum alerts reached" });
    }

    try {
      await createAlert(
        db,
        event.locals.user!.id.toString(),
        name,
        filter,
        price,
        vatRateNum,
        emailNotifications,
        discordNotifications,
      );
    } catch (error) {
      console.error(error);
      return fail(500, { success: false, error: "Failed to create alert" });
    }

    return { success: true };
  },
  edit: async (event: RequestEvent) => {
    const env = event.platform?.env;
    const db = env?.DB;

    if (!db) {
      return fail(500, {
        success: false,
        error: "Database binding is not configured.",
      });
    }
    const formData = await event.request.formData();
    const name = formData.get("name") as string;
    const price = formData.get("price") as string;
    const alertId = formData.get("alertId") as string;
    const emailNotifications = formData.get("emailNotifications") === "true";
    const discordNotifications =
      formData.get("discordNotifications") === "true";

    // Validate that at least one notification method is selected
    if (!emailNotifications && !discordNotifications) {
      return fail(400, {
        success: false,
        error: "At least one notification method must be selected.",
      });
    }

    const { isValid, errors } = validateAlert(name, price);

    if (!isValid) {
      return fail(400, { success: false, errors });
    }

    try {
      await updateAlert(
        db,
        event.locals.user!.id.toString(),
        alertId,
        name,
        price,
        emailNotifications,
        discordNotifications,
      );
    } catch (error) {
      console.error(error);
      return fail(500, { success: false, error: "Failed to update alert" });
    }

    return { success: true };
  },
  delete: async (event: RequestEvent) => {
    const env = event.platform?.env;
    const db = env?.DB;

    if (!db) {
      return fail(500, {
        success: false,
        error: "Database binding is not configured.",
      });
    }
    const formData = await event.request.formData();
    const alertId = formData.get("alertId") as string;

    if (!alertId) {
      return fail(400, { success: false, error: "Alert ID is required." });
    }

    try {
      await deleteAlert(db, alertId, event.locals.user!.id.toString());
    } catch (error) {
      console.error(error);
      return fail(500, { success: false, error: "Failed to delete alert" });
    }

    return { success: true };
  },
};
