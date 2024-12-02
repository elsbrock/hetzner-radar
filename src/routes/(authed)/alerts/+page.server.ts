import {
    createAlert,
    deleteAlert,
    getAlertsForUser,
    isBelowMaxAlerts,
    MAX_NAME_LENGTH,
    updateAlert,
} from "$lib/api/backend/alerts";
import { fail, type Actions } from "@sveltejs/kit";

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
    const db = event.platform?.env.DB;

    const alertResults = await getAlertsForUser(db, event.locals.user.id);

    return {
        alerts: {
            active: alertResults.activeResults,
            triggered: alertResults.triggeredResults,
        },
    };
}

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
        } else if (priceNumber < 30 || priceNumber > 1000) {
            errors.price = "Price must be between 30 and 1000.";
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

export const actions: Actions = {
    add: async (event) => {
        const db = event.platform?.env.DB;
        const formData = await event.request.formData();
        const name = formData.get("name") as string;
        const filter = formData.get("filter") as string;
        const price = formData.get("price") as string;

        const { isValid, errors } = validateAlert(name, price, filter);

        if (!isValid) {
            return fail(400, { success: false, errors });
        }

        // verify user is below the limit
        const isBelow = await isBelowMaxAlerts(db!, event.locals.user?.id);
        if (!isBelow) {
            return fail(400, { success: false, error: "Maximum alerts reached" });
        }

        try {
            await createAlert(db!, event.locals.user?.id, name, filter, price);
        } catch (e) {
            console.error(e);
            return fail(500, { success: false, error: "Failed to create alert" });
        }

        return { success: true };
    },
    edit: async (event) => {
        const db = event.platform?.env.DB;
        const formData = await event.request.formData();
        const name = formData.get("name") as string;
        const price = formData.get("price") as string;
        const alertId = formData.get("alertId") as string;

        const { isValid, errors } = validateAlert(name, price);

        if (!isValid) {
            return fail(400, { success: false, errors });
        }

        try {
            await updateAlert(
                db!,
                event.locals.user?.id,
                alertId,
                name,
                price,
            );
        } catch (e) {
            console.error(e);
            return fail(500, { success: false, error: "Failed to update alert" });
        }

        return { success: true };
    },
    delete: async (event) => {
        const db = event.platform?.env.DB;
        const formData = await event.request.formData();
        const alertId = formData.get("alertId") as string;

        if (!alertId) {
            return fail(400, { success: false, error: "Alert ID is required." });
        }

        try {
            await deleteAlert(db!, alertId, event.locals.user?.id);
        } catch (e) {
            console.error(e);
            return fail(500, { success: false, error: "Failed to delete alert" });
        }

        return { success: true };
    },
};
