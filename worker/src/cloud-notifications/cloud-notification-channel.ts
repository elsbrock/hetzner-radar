/**
 * Cloud Notification Channel Interface
 *
 * Defines the contract for cloud availability notification channels
 * Similar to alert notifications but optimized for cloud availability changes
 */

/**
 * Cloud availability change information
 */
export interface AvailabilityChange {
	serverTypeId: number;
	serverTypeName: string;
	locationId: number;
	locationName: string;
	eventType: 'available' | 'unavailable';
	timestamp: number;
}

/**
 * Cloud alert information
 */
export interface CloudAlert {
	id: string;
	user_id: string;
	name: string;
	server_type_ids: number[];
	location_ids: number[];
	alert_on: 'available' | 'unavailable' | 'both';
	email_notifications: boolean;
	discord_notifications: boolean;
	created_at: string;
}

/**
 * User information for notifications
 */
export interface CloudAlertUser {
	id: string;
	email: string;
	discord_webhook_url?: string;
}

/**
 * Matched cloud alert notification
 */
export interface CloudAlertMatch {
	alert: CloudAlert;
	change: AvailabilityChange;
	user: CloudAlertUser;
}

/**
 * Cloud notification payload grouped by user
 */
export interface CloudNotification {
	user: CloudAlertUser;
	matches: CloudAlertMatch[];
	emailEnabled: boolean;
	discordEnabled: boolean;
}

/**
 * Cloud notification result
 */
export interface CloudNotificationResult {
	channel: string;
	success: boolean;
	error?: string;
	timestamp: string;
	userId: string;
	changesProcessed: number;
}

/**
 * Base interface for cloud notification channels
 */
export interface CloudNotificationChannel {
	/**
	 * Unique name for this channel
	 */
	readonly name: string;

	/**
	 * Check if this channel is enabled for the given notification
	 */
	isEnabled(notification: CloudNotification): boolean;

	/**
	 * Send the notification through this channel
	 * Should handle its own errors and return success/failure
	 */
	send(notification: CloudNotification): Promise<CloudNotificationResult>;
}
