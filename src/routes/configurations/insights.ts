/**
 * Statements about the current auction inventory, computed from the category
 * result sets the page already loads. Same rules as the cloud-status generator:
 * derived-only, precondition-gated, hard-capped.
 */
import { formatStorageSize } from "$lib/util";
import type { ConfigurationServer } from "./+page.server";

const MAX_INSIGHTS = 4;

export const AUCTION_PRICING_NOTE =
  "Prices are the current auction ask excluding VAT, and fall the longer a server goes unsold — the figures above move throughout the day.";

function euro(price: number): string {
  return `€${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}`;
}

function describe(server: ConfigurationServer): string {
  const parts: string[] = [server.cpu];
  if (server.ram_size) parts.push(`${server.ram_size} GB RAM`);
  const disks: string[] = [];
  if (server.nvme_size)
    disks.push(`${formatStorageSize(server.nvme_size)} NVMe`);
  else if (server.sata_size)
    disks.push(`${formatStorageSize(server.sata_size)} SATA`);
  else if (server.hdd_size)
    disks.push(`${formatStorageSize(server.hdd_size)} HDD`);
  return [...parts, ...disks].join(", ");
}

export function buildConfigurationInsights(
  categories: Record<string, ConfigurationServer[]> | null | undefined,
  gpuServerCount: number | null | undefined,
): string[] {
  const servers = Object.values(categories ?? {})
    .flat()
    .filter((s): s is ConfigurationServer => Boolean(s) && s.price !== null);

  if (servers.length === 0) return [];

  const insights: string[] = [];
  // The categories overlap, so dedupe before counting anything.
  const unique = new Map<string, ConfigurationServer>();
  for (const s of servers) {
    unique.set(
      `${s.cpu}|${s.ram_size}|${s.nvme_size}|${s.sata_size}|${s.hdd_size}|${s.price}`,
      s,
    );
  }
  const pool = [...unique.values()];

  // 1. Entry price across everything currently surfaced.
  const cheapest = pool.reduce((a, b) =>
    (a.price ?? 0) <= (b.price ?? 0) ? a : b,
  );
  if (cheapest.price) {
    insights.push(
      `The cheapest configuration on the board right now is ${euro(cheapest.price)} per month — ${describe(cheapest)}.`,
    );
  }

  // 2. Best value per CPU core, which is what makes the spread concrete.
  const perCore = pool
    .filter((s) => (s.cpu_cores ?? 0) > 0 && s.price)
    .map((s) => ({
      server: s,
      value: (s.price as number) / (s.cpu_cores as number),
    }))
    .sort((a, b) => a.value - b.value);
  if (perCore.length > 0) {
    const best = perCore[0];
    insights.push(
      `Per core, the best value is ${euro(best.value)} — ${best.server.cpu} with ${best.server.cpu_cores} cores at ${euro(best.server.price as number)}.`,
    );
  }

  // 3. Bulk storage value, only when there is meaningful spinning/large storage.
  const perTb = pool
    .map((s) => {
      const gb = (s.hdd_size ?? 0) + (s.sata_size ?? 0) + (s.nvme_size ?? 0);
      return {
        server: s,
        gb,
        value: gb > 0 && s.price ? s.price / (gb / 1000) : null,
      };
    })
    .filter(
      (e): e is { server: ConfigurationServer; gb: number; value: number } =>
        e.value !== null && e.gb >= 1000,
    )
    .sort((a, b) => a.value - b.value);
  if (perTb.length > 0) {
    const best = perTb[0];
    insights.push(
      `For bulk storage the floor is about ${euro(best.value)} per TB, on a machine with ${formatStorageSize(best.gb)} total.`,
    );
  }

  // 4. ECC share and GPU count — both cheap to state, both frequently asked.
  const eccShare = Math.round(
    (pool.filter((s) => s.is_ecc).length / pool.length) * 100,
  );
  if (gpuServerCount && gpuServerCount > 0) {
    insights.push(
      `${eccShare}% of these configurations carry ECC memory, and ${gpuServerCount} server${gpuServerCount === 1 ? "" : "s"} in the current auction include a GPU.`,
    );
  } else {
    insights.push(`${eccShare}% of these configurations carry ECC memory.`);
  }

  return insights.slice(0, MAX_INSIGHTS);
}
