import type { PageServerLoad } from './$types';

// Update interface to match the actual query result structure
interface CountQueryResult {
    count: bigint;
}

export const load: PageServerLoad = async ({ platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { userStats: 0, alertStats: 0, historyStats: 0 };

    try {
        // Await all promises immediately to get actual values
        const [userStats, alertStats, historyStats] = await Promise.all([
            db.prepare('SELECT COUNT(*) as count FROM user')
                .first<CountQueryResult>()
                .then(result => Number(result?.count ?? 0n))
                .catch(() => 0),

            db.prepare('SELECT COUNT(*) as count FROM price_alert')
                .first<CountQueryResult>()
                .then(result => Number(result?.count ?? 0n))
                .catch(() => 0),

            db.prepare('SELECT COUNT(*) as count FROM price_alert_history')
                .first<CountQueryResult>()
                .then(result => Number(result?.count ?? 0n))
                .catch(() => 0)
        ]);

        // Ensure we return actual numbers, not null or undefined
        return {
            userStats: userStats || 0,
            alertStats: alertStats || 0,
            historyStats: historyStats || 0
        };
    } catch (error) {
        console.error('Failed to load stats:', error);
        return { userStats: 0, alertStats: 0, historyStats: 0 };
    }
};
