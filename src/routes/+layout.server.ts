import type { LayoutServerLoad } from "./$types";

/** @type {import('./$types').PageServerLoad} */
export const load: LayoutServerLoad = async (event) => {
  return {
    session: event.locals.session,
  };
};
