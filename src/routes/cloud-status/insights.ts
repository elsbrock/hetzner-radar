/**
 * Statements about Hetzner Cloud availability, computed from the status snapshot
 * the page already loads.
 *
 * Rules, enforced here rather than by convention:
 *  - every sentence carries a number or a name derived from the data;
 *  - a sentence whose precondition doesn't hold is dropped, not softened into
 *    something generic;
 *  - at most MAX_INSIGHTS survive, so this can never grow into a keyword dump.
 */
import type { CloudStatusData } from "./+page.server";

const MAX_INSIGHTS = 4;

export const SUPPORTED_VS_AVAILABLE_NOTE =
  "“Supported” means Hetzner offers the type at that location; “available” means it is in stock right now. A supported type that is out of stock usually returns within hours.";

function list(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function buildCloudStatusInsights(
  data: CloudStatusData | null,
): string[] {
  if (!data?.serverTypes?.length || !data?.locations?.length) return [];

  const insights: string[] = [];
  const active = data.serverTypes.filter((st) => !st.deprecated);
  const locations = data.locations;

  const supportedAt = (locationId: number) =>
    (data.supported?.[locationId] ?? []).filter((id) =>
      active.some((st) => st.id === id),
    );
  const availableAt = (locationId: number) =>
    (data.availability?.[locationId] ?? []).filter((id) =>
      active.some((st) => st.id === id),
    );

  // 1. Architecture geography: where ARM is offered at all. Only worth stating
  //    when it is genuinely a subset of locations.
  const armTypeIds = new Set(
    active.filter((st) => st.architecture === "arm").map((st) => st.id),
  );
  if (armTypeIds.size > 0) {
    const armCities = locations
      .filter((loc) => supportedAt(loc.id).some((id) => armTypeIds.has(id)))
      .map((loc) => loc.city);
    if (armCities.length > 0 && armCities.length < locations.length) {
      insights.push(
        `Hetzner's ARM types (CAX) are offered only in ${list(armCities)} — the x86 types are the only option in the remaining ${locations.length - armCities.length} location${locations.length - armCities.length === 1 ? "" : "s"}.`,
      );
    }
  }

  // 2. Best and worst location by share of their supported types in stock.
  const ranked = locations
    .map((loc) => {
      const supported = supportedAt(loc.id).length;
      const available = availableAt(loc.id).length;
      return {
        city: loc.city,
        supported,
        available,
        share: supported > 0 ? available / supported : 0,
      };
    })
    .filter((entry) => entry.supported > 0)
    .sort((a, b) => b.share - a.share);

  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (best.share > worst.share) {
      insights.push(
        `Right now ${best.city} has the widest choice, with ${best.available} of ${best.supported} supported types in stock (${Math.round(best.share * 100)}%), while ${worst.city} has the narrowest at ${Math.round(worst.share * 100)}%.`,
      );
    }
  }

  // 3. Scarcity: the type in stock in the fewest locations (but still somewhere).
  const byScarcity = active
    .map((st) => ({
      name: st.name.toUpperCase(),
      count: locations.filter((loc) => availableAt(loc.id).includes(st.id))
        .length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => a.count - b.count);

  if (byScarcity.length > 0 && byScarcity[0].count < locations.length) {
    const scarce = byScarcity[0];
    insights.push(
      `${scarce.name} is the hardest to get, in stock in just ${scarce.count} of ${locations.length} locations.`,
    );
  }

  // 4. Types that are supported somewhere but currently out everywhere — a
  //    strong signal, so only stated when it actually happens.
  const outEverywhere = active
    .filter(
      (st) =>
        locations.some((loc) => supportedAt(loc.id).includes(st.id)) &&
        !locations.some((loc) => availableAt(loc.id).includes(st.id)),
    )
    .map((st) => st.name.toUpperCase());

  if (outEverywhere.length > 0) {
    insights.push(
      outEverywhere.length === 1
        ? `${outEverywhere[0]} is currently out of stock in every location that offers it.`
        : `${outEverywhere.length} types — ${list(outEverywhere.slice(0, 3))}${outEverywhere.length > 3 ? " among them" : ""} — are currently out of stock everywhere they are offered.`,
    );
  }

  return insights.slice(0, MAX_INSIGHTS);
}
