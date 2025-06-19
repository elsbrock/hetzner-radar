import type { PageServerLoad } from "./$types";

// Update interface to match the actual query result structure
interface CountQueryResult {
  count: bigint;
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;
  const radarWorker = platform?.env?.RADAR_WORKER;
  
  if (!db) return { userStats: 0, alertStats: 0, historyStats: 0, auctionStats: 0, latestBatchStats: 0 };

  try {
    // Get auction stats from worker and user/alert stats from DB
    const [userStats, alertStats, historyStats, auctionData] = await Promise.all([
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

      // Get auction stats from worker DO
      (async () => {
        if (!radarWorker) {
          return { currentAuctions: 0, latestBatch: null, lastUpdated: null, lastImport: null };
        }
        try {
          return await radarWorker.getAuctionStats();
        } catch (error) {
          console.error('Failed to get auction stats from worker:', error);
          return { currentAuctions: 0, latestBatch: null, lastUpdated: null, lastImport: null };
        }
      })(),
    ]);

    // Ensure we return actual numbers, not null or undefined
    return {
      userStats: userStats || 0,
      alertStats: alertStats || 0,
      historyStats: historyStats || 0,
      auctionStats: Number(auctionData.currentAuctions) || 0,
      latestBatchStats: Number(auctionData.currentAuctions) || 0,
    };
  } catch (error) {
    console.error("Failed to load stats:", error);
    return { userStats: 0, alertStats: 0, historyStats: 0, auctionStats: 0, latestBatchStats: 0 };
  }
};
