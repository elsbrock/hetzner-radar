import type { RequestHandler } from "@sveltejs/kit";
import * as sitemap from "super-sitemap";
import { loadEligibleCpus } from "$lib/api/shared/cpu-pages";

export const GET: RequestHandler = async ({ platform }) => {
  const db = platform?.env?.DB;
  let cpuSlugs: string[] = [];
  if (db) {
    try {
      const cpus = await loadEligibleCpus(db);
      cpuSlugs = cpus.map((c) => c.slug);
    } catch (error) {
      console.error("sitemap: failed to load CPU slugs:", error);
    }
  }

  return await sitemap.response({
    origin: "https://radar.iodev.org",
    paramValues: {
      "/servers/cpu/[slug]": cpuSlugs,
    },
  });
};
