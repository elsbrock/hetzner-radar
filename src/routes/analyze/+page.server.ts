import { getAlertForUser } from "$lib/api/backend/alerts";
import { decodeFilterString } from "$lib/filter";
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    let alert = null;
    if (!event.locals.session) {
        return { alert };
    }

    console.log("loading data");
    const db = event.platform?.env.DB;
    const filterString = event.url.searchParams.get("filter");

    if (filterString && db && event.locals.user) {
        const filter = decodeFilterString(filterString);
        alert = getAlertForUser(
            db,
            event.locals.user.id.toString(),
            JSON.stringify(filter),
        );
    }

    return {
        alert,
    };
};
