/**
 * Cloud alert test fixtures
 */

import type {
	AvailabilityChange,
	CloudAlert,
	CloudAlertUser,
	CloudAlertMatch,
	CloudNotification,
} from '../../cloud-notifications/cloud-notification-channel';

// Mock availability changes
export const mockAvailabilityChanges: AvailabilityChange[] = [
	{
		serverTypeId: 1,
		serverTypeName: 'cx11',
		locationId: 1,
		locationName: 'nbg1',
		eventType: 'available',
		timestamp: Date.now(),
	},
	{
		serverTypeId: 2,
		serverTypeName: 'cx21',
		locationId: 2,
		locationName: 'fsn1',
		eventType: 'unavailable',
		timestamp: Date.now(),
	},
	{
		serverTypeId: 1,
		serverTypeName: 'cx11',
		locationId: 2,
		locationName: 'fsn1',
		eventType: 'available',
		timestamp: Date.now(),
	},
];

// Mock single availability change
export const mockSingleAvailabilityChange: AvailabilityChange[] = [
	{
		serverTypeId: 1,
		serverTypeName: 'cx11',
		locationId: 1,
		locationName: 'nbg1',
		eventType: 'available',
		timestamp: Date.now(),
	},
];

// Mock cloud alerts
export const mockCloudAlerts: CloudAlert[] = [
	{
		id: 'alert-1',
		user_id: 'user-1',
		name: 'cx11 in NBG1',
		server_type_ids: [1],
		location_ids: [1],
		alert_on: 'available',
		email_notifications: true,
		discord_notifications: true,
		created_at: '2024-01-01T00:00:00Z',
	},
	{
		id: 'alert-2',
		user_id: 'user-2',
		name: 'cx21 anywhere',
		server_type_ids: [2],
		location_ids: [1, 2],
		alert_on: 'both',
		email_notifications: true,
		discord_notifications: false,
		created_at: '2024-01-01T01:00:00Z',
	},
	{
		id: 'alert-3',
		user_id: 'user-1',
		name: 'Any server in FSN1',
		server_type_ids: [1, 2, 3],
		location_ids: [2],
		alert_on: 'unavailable',
		email_notifications: false,
		discord_notifications: true,
		created_at: '2024-01-01T02:00:00Z',
	},
];

// Mock single cloud alert
export const mockSingleCloudAlert: CloudAlert = {
	id: 'alert-1',
	user_id: 'user-1',
	name: 'cx11 in NBG1',
	server_type_ids: [1],
	location_ids: [1],
	alert_on: 'available',
	email_notifications: true,
	discord_notifications: true,
	created_at: '2024-01-01T00:00:00Z',
};

// Mock cloud alert users
export const mockCloudAlertUsers: CloudAlertUser[] = [
	{
		id: 'user-1',
		email: 'user1@example.com',
		discord_webhook_url: 'https://discord.com/api/webhooks/user1',
	},
	{
		id: 'user-2',
		email: 'user2@example.com',
		discord_webhook_url: undefined,
	},
	{
		id: 'user-3',
		email: 'user3@example.com',
		discord_webhook_url: 'https://discord.com/api/webhooks/user3',
	},
];

// Mock raw database cloud alert records
export const mockRawCloudAlertRecords = [
	{
		id: 'alert-1',
		user_id: 'user-1',
		name: 'cx11 in NBG1',
		server_type_ids: JSON.stringify([1]),
		location_ids: JSON.stringify([1]),
		alert_on: 'available',
		email_notifications: 1,
		discord_notifications: 1,
		created_at: '2024-01-01T00:00:00Z',
	},
	{
		id: 'alert-2',
		user_id: 'user-2',
		name: 'cx21 anywhere',
		server_type_ids: JSON.stringify([2]),
		location_ids: JSON.stringify([1, 2]),
		alert_on: 'both',
		email_notifications: 1,
		discord_notifications: 0,
		created_at: '2024-01-01T01:00:00Z',
	},
	{
		id: 'alert-3',
		user_id: 'user-1',
		name: 'Any server in FSN1',
		server_type_ids: JSON.stringify([1, 2, 3]),
		location_ids: JSON.stringify([2]),
		alert_on: 'unavailable',
		email_notifications: 0,
		discord_notifications: 1,
		created_at: '2024-01-01T02:00:00Z',
	},
];

// Mock raw database user records
export const mockRawUserRecords = [
	{
		id: 'user-1',
		email: 'user1@example.com',
		discord_webhook_url: 'https://discord.com/api/webhooks/user1',
	},
	{
		id: 'user-2',
		email: 'user2@example.com',
		discord_webhook_url: null,
	},
	{
		id: 'user-3',
		email: 'user3@example.com',
		discord_webhook_url: 'https://discord.com/api/webhooks/user3',
	},
];

// Mock cloud alert matches
export const mockCloudAlertMatches: CloudAlertMatch[] = [
	{
		alert: mockCloudAlerts[0],
		change: mockAvailabilityChanges[0],
		user: mockCloudAlertUsers[0],
	},
	{
		alert: mockCloudAlerts[1],
		change: mockAvailabilityChanges[1],
		user: mockCloudAlertUsers[1],
	},
];

// Mock cloud notification
export const mockCloudNotification: CloudNotification = {
	user: mockCloudAlertUsers[0],
	matches: [mockCloudAlertMatches[0]],
	emailEnabled: true,
	discordEnabled: true,
};

// Mock cloud notification results
export const mockCloudNotificationResults = [
	{
		channel: 'discord',
		success: true,
		timestamp: new Date().toISOString(),
		userId: 'user-1',
		changesProcessed: 1,
	},
	{
		channel: 'email',
		success: true,
		timestamp: new Date().toISOString(),
		userId: 'user-1',
		changesProcessed: 1,
	},
];

// Mock failed cloud notification results
export const mockFailedCloudNotificationResults = [
	{
		channel: 'discord',
		success: false,
		error: 'Webhook URL invalid',
		timestamp: new Date().toISOString(),
		userId: 'user-1',
		changesProcessed: 1,
	},
	{
		channel: 'email',
		success: false,
		error: 'SMTP server unavailable',
		timestamp: new Date().toISOString(),
		userId: 'user-1',
		changesProcessed: 1,
	},
];

// Mock cloud notification service results
export const mockCloudNotificationServiceResult = {
	processed: 3,
	notifications: 2,
	results: mockCloudNotificationResults,
};

// Mock empty arrays for testing edge cases
export const mockEmptyAvailabilityChanges: AvailabilityChange[] = [];
export const mockEmptyCloudAlerts: CloudAlert[] = [];
export const mockEmptyRawAlertRecords: any[] = [];
export const mockEmptyRawUserRecords: any[] = [];
