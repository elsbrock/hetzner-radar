import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { userStats: null, alertStats: null, historyStats: null };

    return {
        userStats: db.prepare('SELECT COUNT(*) as count FROM user')
            .first()
            .then(result => result?.count || 0)
            .catch(error => {
                console.error('Failed to load user stats:', error);
                return 0;
            }),

        alertStats: db.prepare('SELECT COUNT(*) as count FROM price_alert')
            .first()
            .then(result => result?.count || 0)
            .catch(error => {
                console.error('Failed to load alert stats:', error);
                return 0;
            }),

        historyStats: db.prepare('SELECT COUNT(*) as count FROM price_alert_history')
            .first()
            .then(result => result?.count || 0)
            .catch(error => {
                console.error('Failed to load history stats:', error);
                return 0;
            })
    };
};
