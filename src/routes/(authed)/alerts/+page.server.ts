import {
    createAlert,
    deleteAlert,
    getAlertsForUser,
    isBelowMaxAlerts,
    updateAlert,
} from "$lib/api/backend/alerts";
import { type Actions } from "@sveltejs/kit";
import { fail } from "assert";

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

function validAlert(name: string, price: string, filter?: string) {
    if (!name || !price) {
        return false;
    }
    if (!parseInt(price) || parseInt(price) < 30 || parseInt(price) > 1000) {
        return false;
    }
    return true;
}

export const actions: Actions = {
    add: async (event) => {
        const db = event.platform?.env.DB;
        const formData = await event.request.formData();
        const name = formData.get("name") as string;
        const filter = formData.get("filter") as string;
        const price = formData.get("price") as string;

        if (!validAlert(name, price, filter)) {
            return {
                status: 400,
                success: false,
                error: "Invalid request",
            };
        }

        // verify user is below the limit
        const isBelow = await isBelowMaxAlerts(db!, event.locals.user?.id);
        if (!isBelow) {
            return {
                status: 400,
                success: false,
                error: "Maximum alerts reached",
            };
        }

        try {
            await createAlert(db!, event.locals.user?.id, name, filter, price);
        } catch (e) {
            console.error(e);
            return { success: false, error: "Failed to create alert" };
        }

        return { success: true };
    },
    edit: async (event) => {
        const db = event.platform?.env.DB;
        const formData = await event.request.formData();
        const name = formData.get("name") as string;
        const price = formData.get("price") as string;
        const alertId = formData.get("alertId") as string;

        if (!alertId || !validAlert(name, price)) {
            return {
                status: 400,
                success: false,
                error: "Invalid request",
            };
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
            return { success: false, error: "Failed to update alert" };
        }

        return { success: true };
    },
    delete: async (event) => {
        if (!event.locals.user) {
            fail("Unauthorized");
        }

        const db = event.platform?.env.DB;
        const formData = await event.request.formData();
        const alertId = formData.get("alertId") as string;

        if (!alertId) {
            return {
                status: 400,
                body: { error: "Invalid request" },
            };
        }

        await deleteAlert(db!, alertId, event.locals.user?.id);

        return { success: true };
    },
};
