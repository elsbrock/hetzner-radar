import type { PageServerLoad } from "./$types";

// Update interface to match the actual query result structure
interface CountQueryResult {
  count: bigint;
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;
  
  if (!db) return { userStats: 0, alertStats: 0, historyStats: 0, auctionStats: 0, latestBatchStats: 0 };

  try {
    // Get all stats from DB
    const [userStats, alertStats, historyStats, auctionStats, latestBatchStats] = await Promise.all([
      db
        .prepare("SELECT COUNT(*) as count FROM user")
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),

      db
        .prepare(`
          SELECT 
            (SELECT COUNT(*) FROM price_alert) + 
            (SELECT COUNT(*) FROM cloud_availability_alert) as count
        `)
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),

      db
        .prepare(`
          SELECT 
            (SELECT COUNT(*) FROM price_alert_history) + 
            (SELECT COUNT(*) FROM cloud_alert_history) as count
        `)
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),

      db
        .prepare("SELECT COUNT(*) as count FROM auctions")
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),

      db
        .prepare("SELECT COUNT(*) as count FROM auctions WHERE DATE(created_at) = DATE('now')")
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),
    ]);

    // Ensure we return actual numbers, not null or undefined
    return {
      userStats: userStats || 0,
      alertStats: alertStats || 0,
      historyStats: historyStats || 0,
      auctionStats: auctionStats || 0,
      latestBatchStats: latestBatchStats || 0,
    };
  } catch (error) {
    console.error("Failed to load stats:", error);
    return { userStats: 0, alertStats: 0, historyStats: 0, auctionStats: 0, latestBatchStats: 0 };
  }
};
