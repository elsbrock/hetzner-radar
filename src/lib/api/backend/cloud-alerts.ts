export const MAX_CLOUD_ALERTS = 3;
export const MAX_NAME_LENGTH = 100;

export interface CloudAvailabilityAlert {
    id: string;
    user_id: string;
    name: string;
    server_type_ids: number[];
    location_ids: number[];
    alert_on: 'available' | 'unavailable' | 'both';
    email_notifications: boolean;
    discord_notifications: boolean;
    created_at: Date;
}

export interface CloudAlertHistory {
    id: string;
    alert_id: string;
    user_id: string;
    server_type_id: number;
    server_type_name: string;
    location_id: number;
    location_name: string;
    event_type: 'available' | 'unavailable';
    triggered_at: Date;
}

export interface UserCloudAlerts {
    activeAlerts: CloudAvailabilityAlert[];
    triggeredAlerts: CloudAlertHistory[];
}

function parseCloudAlert(raw: any): CloudAvailabilityAlert {
    return {
        ...raw,
        server_type_ids: JSON.parse(raw.server_type_ids),
        location_ids: JSON.parse(raw.location_ids),
        created_at: new Date(raw.created_at),
    };
}

function parseCloudAlertHistory(raw: any): CloudAlertHistory {
    return {
        ...raw,
        triggered_at: new Date(raw.triggered_at),
    };
}

export async function getCloudAlertsForUser(db: DB, userId: string): Promise<UserCloudAlerts> {
    const activeAlertsRaw = await db.prepare(
        "SELECT * FROM cloud_availability_alert WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(userId)
    .all();

    const triggeredAlertsRaw = await db.prepare(
        "SELECT * FROM cloud_alert_history WHERE user_id = ? ORDER BY triggered_at DESC LIMIT 20"
    )
    .bind(userId)
    .all();

    const activeAlerts: CloudAvailabilityAlert[] = activeAlertsRaw.results.map(parseCloudAlert);
    const triggeredAlerts: CloudAlertHistory[] = triggeredAlertsRaw.results.map(parseCloudAlertHistory);

    return {
        activeAlerts,
        triggeredAlerts,
    };
}

export async function getCloudAlertById(db: DB, userId: string, alertId: string): Promise<CloudAvailabilityAlert | null> {
    const result = await db.prepare(
        "SELECT * FROM cloud_availability_alert WHERE id = ? AND user_id = ?"
    )
    .bind(alertId, userId)
    .first();

    if (!result) {
        return null;
    }

    return parseCloudAlert(result);
}

export async function isBelowMaxCloudAlerts(db: DB, userId: string): Promise<boolean> {
    const result = await db.prepare(
        "SELECT COUNT(*) as count FROM cloud_availability_alert WHERE user_id = ?"
    )
    .bind(userId)
    .first<{ count: number }>();

    return ((result as unknown as { count: number })?.count ?? 0) < MAX_CLOUD_ALERTS;
}

export async function createCloudAlert(
    db: DB,
    userId: string,
    name: string,
    serverTypeIds: number[],
    locationIds: number[],
    alertOn: 'available' | 'unavailable' | 'both',
    emailNotifications: boolean = true,
    discordNotifications: boolean = false,
): Promise<string> {
    const alertId = crypto.randomUUID();
    
    await db.prepare(
        `INSERT INTO cloud_availability_alert 
        (id, user_id, name, server_type_ids, location_ids, alert_on, email_notifications, discord_notifications) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
        alertId,
        userId,
        name.slice(0, MAX_NAME_LENGTH),
        JSON.stringify(serverTypeIds),
        JSON.stringify(locationIds),
        alertOn,
        emailNotifications ? 1 : 0,
        discordNotifications ? 1 : 0
    )
    .run();

    return alertId;
}

export async function updateCloudAlert(
    db: DB,
    userId: string,
    alertId: string,
    updates: {
        name?: string;
        serverTypeIds?: number[];
        locationIds?: number[];
        alertOn?: 'available' | 'unavailable' | 'both';
        emailNotifications?: boolean;
        discordNotifications?: boolean;
    }
): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
        setClauses.push("name = ?");
        values.push(updates.name.slice(0, MAX_NAME_LENGTH));
    }
    if (updates.serverTypeIds !== undefined) {
        setClauses.push("server_type_ids = ?");
        values.push(JSON.stringify(updates.serverTypeIds));
    }
    if (updates.locationIds !== undefined) {
        setClauses.push("location_ids = ?");
        values.push(JSON.stringify(updates.locationIds));
    }
    if (updates.alertOn !== undefined) {
        setClauses.push("alert_on = ?");
        values.push(updates.alertOn);
    }
    if (updates.emailNotifications !== undefined) {
        setClauses.push("email_notifications = ?");
        values.push(updates.emailNotifications ? 1 : 0);
    }
    if (updates.discordNotifications !== undefined) {
        setClauses.push("discord_notifications = ?");
        values.push(updates.discordNotifications ? 1 : 0);
    }

    if (setClauses.length === 0) return;

    values.push(alertId, userId);

    await db.prepare(
        `UPDATE cloud_availability_alert SET ${setClauses.join(", ")} WHERE id = ? AND user_id = ?`
    )
    .bind(...values)
    .run();
}

export async function deleteCloudAlert(db: DB, userId: string, alertId: string): Promise<void> {
    await db.prepare(
        "DELETE FROM cloud_availability_alert WHERE id = ? AND user_id = ?"
    )
    .bind(alertId, userId)
    .run();
}

export async function recordCloudAlertTrigger(
    db: DB,
    alertId: string,
    userId: string,
    serverTypeId: number,
    serverTypeName: string,
    locationId: number,
    locationName: string,
    eventType: 'available' | 'unavailable'
): Promise<void> {
    const historyId = crypto.randomUUID();
    
    await db.prepare(
        `INSERT INTO cloud_alert_history 
        (id, alert_id, user_id, server_type_id, server_type_name, location_id, location_name, event_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
        historyId,
        alertId,
        userId,
        serverTypeId,
        serverTypeName,
        locationId,
        locationName,
        eventType
    )
    .run();
}

export async function getActiveCloudAlertsForMatching(db: DB): Promise<CloudAvailabilityAlert[]> {
    const results = await db.prepare(
        "SELECT * FROM cloud_availability_alert ORDER BY created_at"
    )
    .all();

    return results.results.map(parseCloudAlert);
}