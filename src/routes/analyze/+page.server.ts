import { getAlertForUser } from "$lib/api/backend/alerts";
import { decodeFilterString } from "$lib/filter";

/** @type {import('./$types').PageServerLoad} */
export async function load(event: Event) {
    let alert = null;
    if (!event.locals.session) {
        return { alert };
    }

    console.log("loading data");
    const db = event.platform?.env.DB;
    const filterString = event.url.searchParams.get("filter");

    if (filterString) {
        const filter = decodeFilterString(filterString);
        alert = getAlertForUser(
            db,
            event.locals.user.id,
            JSON.stringify(filter),
        );
    }

    return {
        alert,
    };
}
