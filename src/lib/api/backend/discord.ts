export interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
  url?: string;
}

export interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

export async function sendDiscordNotification(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `Discord webhook returned status ${response.status}: ${response.statusText}`,
      );
      try {
        const errorBody = await response.text();
        console.error("Discord error response:", errorBody);
      } catch {
        console.error("Could not read error response body");
      }
    }

    return response.ok;
  } catch (error) {
    console.error("Failed to send Discord notification:", error);
    return false;
  }
}

export function createAlertDiscordEmbed(
  alertName: string,
  targetPrice: number,
  triggerPrice: number,
  vatRate: number,
  auctionUrl?: string,
): DiscordEmbed {
  const fields = [
    {
      name: "🎯 Target Price",
      value: `€${targetPrice.toFixed(2)} (incl. ${vatRate}% VAT)`,
      inline: true,
    },
    {
      name: "💰 Trigger Price",
      value: `€${triggerPrice.toFixed(2)} (incl. ${vatRate}% VAT)`,
      inline: true,
    },
    {
      name: "💾 Savings",
      value: `€${(targetPrice - triggerPrice).toFixed(2)}`,
      inline: true,
    },
  ];

  if (auctionUrl) {
    fields.push({
      name: "🔗 View Auction",
      value: `[Click here to view details](${auctionUrl})`,
      inline: false,
    });
  }

  return {
    title: `🚨 Price Alert Triggered: ${alertName}`,
    description:
      "Your target price has been reached! A Hetzner server matching your criteria is now available at or below your desired price.",
    color: 0x00ff00, // Green color
    fields,
    footer: {
      text: "Server Radar • Price Alert",
    },
    timestamp: new Date().toISOString(),
    url: auctionUrl,
  };
}

export function createTestDiscordEmbed(): DiscordEmbed {
  return {
    title: "✅ Discord Webhook Test",
    description:
      "This is a test notification from Server Radar. Your Discord webhook is working correctly!",
    color: 0x5865f2, // Discord blurple color
    fields: [
      {
        name: "📋 Test Details",
        value:
          "If you can see this message, your Discord webhook configuration is set up properly.",
        inline: false,
      },
    ],
    footer: {
      text: "Server Radar • Test Notification",
    },
    timestamp: new Date().toISOString(),
  };
}
