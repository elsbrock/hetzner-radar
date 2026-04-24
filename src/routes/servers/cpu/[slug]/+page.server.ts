import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { loadCpuPageData } from "$lib/api/shared/cpu-pages";

export const load: PageServerLoad = async ({
  params,
  platform,
  setHeaders,
}) => {
  const db = platform?.env?.DB;
  if (!db) {
    error(503, "Database unavailable");
  }

  setHeaders({
    "cache-control":
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  });

  let data;
  try {
    data = await loadCpuPageData(db, params.slug);
  } catch (err) {
    console.error("Failed to load CPU page data:", err);
    error(404, "CPU not found");
  }
  if (!data) {
    error(404, "CPU not found");
  }

  return data;
};
