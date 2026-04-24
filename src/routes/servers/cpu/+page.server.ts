import type { PageServerLoad } from "./$types";
import { loadEligibleCpus, type EligibleCpu } from "$lib/api/shared/cpu-pages";

export const load: PageServerLoad = async ({ platform, setHeaders }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return { cpus: [] as EligibleCpu[] };
  }

  setHeaders({
    "cache-control":
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  });

  try {
    const cpus = await loadEligibleCpus(db);
    return { cpus };
  } catch (error) {
    console.error("Failed to load eligible CPUs:", error);
    return { cpus: [] as EligibleCpu[] };
  }
};
