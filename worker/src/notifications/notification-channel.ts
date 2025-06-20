/**
 * Notification Channel Interface
 *
 * Defines the contract for all notification channels (email, Discord, etc.)
 * Each channel is responsible for its own error handling and retry logic.
 */

/**
 * Alert information for notifications
 */
export interface AlertInfo {
	id: number;
	name: string;
	filter: string;
	price: number;
	vat_rate: number;
	user_id: string;
	includes_ipv4_cost: boolean;
	email: string;
	discord_webhook_url?: string;
	email_notifications: boolean;
	discord_notifications: boolean;
	created_at: string;
}

/**
 * Matched auction information
 */
export interface MatchedAuction {
	auction_id: number;
	price: number;
	seen: string;
}

/**
 * Alert notification payload
 */
export interface AlertNotification {
	alert: AlertInfo;
	triggerPrice: number;
	matchedAuctions: MatchedAuction[];
	lowestAuctionPrice: number;
}

/**
 * Notification result
 */
export interface NotificationResult {
	channel: string;
	success: boolean;
	error?: string;
	timestamp: string;
}

/**
 * Base interface for all notification channels
 */
export interface NotificationChannel {
	/**
	 * Unique name for this channel
	 */
	readonly name: string;

	/**
	 * Check if this channel is enabled for the given alert
	 */
	isEnabled(alert: AlertInfo): boolean;

	/**
	 * Send the notification through this channel
	 * Should handle its own errors and return success/failure
	 */
	send(notification: AlertNotification): Promise<NotificationResult>;
}

/**
 * Channel configuration
 */
export interface ChannelConfig {
	enabled: boolean;
	[key: string]: any;
}
