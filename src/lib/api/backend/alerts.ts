export const MAX_NAME_LENGTH = 100;
export const MAX_ALERTS = 5;

export interface PriceAlert {
  id: string;
  user_id: string;
  name: string;
  filter: string;
  price: string;
  vat_rate: number; // Added VAT rate
  email_notifications: boolean;
  discord_notifications: boolean;
  created_at: Date;
}

export interface PriceAlertHistory {
  id: string;
  user_id: string;
  alert_id: string;
  vat_rate: number; // Added VAT rate
  email_notifications: boolean;
  discord_notifications: boolean;
  triggered_at: Date;
}

export interface UserAlerts {
  activeResults: PriceAlert[];
  triggeredResults: PriceAlertHistory[];
}

function parsePriceAlert(raw: unknown): PriceAlert {
  return {
    ...raw,
    created_at: new Date(raw.created_at),
  };
}

function parsePriceAlertHistory(raw: unknown): PriceAlertHistory {
  return {
    ...raw,
    triggered_at: new Date(raw.triggered_at),
  };
}

export async function getAlertsForUser(
  db: DB,
  userId: string,
): Promise<UserAlerts> {
  const activeResultsRaw = await db
    .prepare(
      "SELECT * FROM price_alert WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(userId)
    .all();

  const triggeredResultsRaw = await db
    .prepare(
      "SELECT * FROM price_alert_history WHERE user_id = ? ORDER BY triggered_at DESC LIMIT 10",
    )
    .bind(userId)
    .all();

  const activeResults: PriceAlert[] =
    activeResultsRaw.results.map(parsePriceAlert);
  const triggeredResults: PriceAlertHistory[] = triggeredResultsRaw.results.map(
    parsePriceAlertHistory,
  );

  return {
    activeResults,
    triggeredResults,
  };
}

export async function getAlertForUser(
  db: DB,
  userId: string,
  filter: string,
): Promise<PriceAlert | null> {
  const result = await db
    .prepare("SELECT * FROM price_alert WHERE user_id = ? AND filter = ?")
    .bind(userId, filter)
    .first();

  if (!result) {
    return null;
  }

  return parsePriceAlert(result);
}

export async function isBelowMaxAlerts(
  db: DB,
  userId: string,
): Promise<boolean> {
  const result = await db
    .prepare("SELECT COUNT(*) as count FROM price_alert WHERE user_id = ?")
    .bind(userId)
    .first<{ count: number }>();

  return ((result as unknown as { count: number })?.count ?? 0) < MAX_ALERTS;
}

export async function createAlert(
  db: DB,
  userId: string,
  name: string,
  filter: string,
  price: string,
  vatRate: number,
  emailNotifications: boolean = true,
  discordNotifications: boolean = false,
): Promise<void> {
  try {
    // Convert price from string to integer (cents)
    const priceInt = parseInt(price, 10);
    if (isNaN(priceInt)) {
      throw new Error("Invalid price value");
    }

    await db
      .prepare(
        "INSERT INTO price_alert (user_id, name, filter, price, vat_rate, includes_ipv4_cost, email_notifications, discord_notifications) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        userId,
        name,
        filter,
        priceInt,
        vatRate,
        true,
        emailNotifications,
        discordNotifications,
      ) // Default to true for new alerts
      .run();
  } catch (error) {
    console.error(`Failed to create alert for user ${userId}:`, error);
    throw new Error("Could not create alert. Please try again later.");
  }
}

export async function updateAlert(
  db: DB,
  userId: string,
  alertId: string,
  name: string,
  price: string,
  emailNotifications?: boolean,
  discordNotifications?: boolean,
): Promise<void> {
  try {
    // Convert price from string to integer (cents)
    const priceInt = parseInt(price, 10);
    if (isNaN(priceInt)) {
      throw new Error("Invalid price value");
    }

    let sql = "UPDATE price_alert SET name = ?, price = ?";
    const params = [name, priceInt];

    // Add notification preferences if provided
    if (emailNotifications !== undefined) {
      sql += ", email_notifications = ?";
      params.push(emailNotifications ? 1 : 0);
    }
    if (discordNotifications !== undefined) {
      sql += ", discord_notifications = ?";
      params.push(discordNotifications ? 1 : 0);
    }

    sql += " WHERE user_id = ? AND id = ?";
    params.push(userId, alertId);

    const _result = await db
      .prepare(sql)
      .bind(...params)
      .run();
  } catch (error) {
    console.error(
      `Failed to update alert ${alertId} for user ${userId}:`,
      error,
    );
    throw new Error("Could not update alert. Please try again later.");
  }
}

export async function deleteAlert(
  db: DB,
  alertId: string,
  userId: string,
): Promise<void> {
  try {
    const _result = await db
      .prepare("DELETE FROM price_alert WHERE user_id = ? AND id = ?")
      .bind(userId, alertId)
      .run();
  } catch (error) {
    console.error(
      `Failed to delete alert ${alertId} for user ${userId}:`,
      error,
    );
    throw new Error("Could not delete alert. Please try again later.");
  }
}
