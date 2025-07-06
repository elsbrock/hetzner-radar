import { getAlertForUser } from "$lib/api/backend/alerts";
import { getUser } from "$lib/api/backend/user";
import { decodeFilterString } from "$lib/filter";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  let alert = null;
  let user = null;

  if (!event.locals.session) {
    return { alert, user };
  }

  console.log("loading data");
  const db = event.platform?.env.DB;
  const filterString = event.url.searchParams.get("filter");

  if (db && event.locals.user) {
    // Load user data for notification preferences
    const userRecord = await getUser(db, event.locals.user.id.toString());
    user = {
      discord_webhook_url: userRecord?.discord_webhook_url,
      notification_preferences: userRecord?.notification_preferences || {
        email: true,
        discord: false,
      },
    };

    // Load alert data if filter is provided
    if (filterString) {
      const filter = decodeFilterString(filterString);
      alert = getAlertForUser(
        db,
        event.locals.user.id.toString(),
        JSON.stringify(filter),
      );
    }
  }

  return {
    alert,
    user,
  };
};
