/**
 * Alert test fixtures
 */

import type { AlertInfo, MatchedAuction, AlertNotification } from '../../notifications/notification-channel';

// Mock alert filter (typical user alert configuration)
export const mockAlertFilter = {
	locationGermany: 1,
	locationFinland: 0,
	cpuCount: 4,
	cpuIntel: 1,
	cpuAMD: 0,
	ramInternalSize: [4, 6], // 16GB to 64GB (log2 scale)
	ssdNvmeCount: [0, 2],
	ssdNvmeInternalSize: [0, 4], // 0GB to 1TB (250GB scale)
	ssdSataCount: [0, 0],
	ssdSataInternalSize: [0, 0],
	hddCount: [0, 0],
	hddInternalSize: [0, 0],
	selectedDatacenters: null,
	selectedCpuModels: null,
	extrasECC: null,
	extrasINIC: null,
	extrasHWR: null,
	extrasGPU: null,
	extrasRPS: null,
};

// Mock alert info
export const mockAlertInfo: AlertInfo = {
	id: 1,
	name: 'Test Alert - Intel Server',
	filter: JSON.stringify(mockAlertFilter),
	price: 100.0,
	vat_rate: 19.0,
	user_id: 1,
	includes_ipv4_cost: true,
	email: 'test@example.com',
	discord_webhook_url: 'https://discord.com/api/webhooks/test',
	email_notifications: true,
	discord_notifications: true,
	created_at: '2024-01-01T00:00:00Z',
};

// Mock alert info with minimal notifications
export const mockAlertInfoEmailOnly: AlertInfo = {
	...mockAlertInfo,
	id: 2,
	name: 'Email Only Alert',
	discord_webhook_url: null,
	discord_notifications: false,
};

// Mock alert info with no notifications
export const mockAlertInfoNoNotifications: AlertInfo = {
	...mockAlertInfo,
	id: 3,
	name: 'No Notifications Alert',
	email_notifications: false,
	discord_notifications: false,
	discord_webhook_url: null,
};

// Mock alert info with Discord only
export const mockAlertInfoDiscordOnly: AlertInfo = {
	...mockAlertInfo,
	id: 4,
	name: 'Discord Only Alert',
	email_notifications: false,
	discord_notifications: true,
};

// Mock matched auctions
export const mockMatchedAuctions: MatchedAuction[] = [
	{
		auction_id: 12345,
		price: 75.0,
		seen: '2024-01-01T12:00:00Z',
	},
	{
		auction_id: 12346,
		price: 85.0,
		seen: '2024-01-01T12:00:00Z',
	},
];

// Mock single matched auction
export const mockSingleMatchedAuction: MatchedAuction[] = [
	{
		auction_id: 12347,
		price: 65.0,
		seen: '2024-01-01T12:00:00Z',
	},
];

// Mock alert notification
export const mockAlertNotification: AlertNotification = {
	alert: mockAlertInfo,
	triggerPrice: 95.14, // (75 + 1.19) * 1.19 = 90.69 rounded
	matchedAuctions: mockMatchedAuctions,
	lowestAuctionPrice: 75.0,
};

// Mock database query results for matching alerts
export const mockMatchingAlertsQueryResult = [
	{
		alert_id: 1,
		name: 'Test Alert - Intel Server',
		price: 100.0,
		vat_rate: 19.0,
		user_id: 1,
		includes_ipv4_cost: 1,
		email_notifications: 1,
		discord_notifications: 1,
		email: 'test@example.com',
		discord_webhook_url: 'https://discord.com/api/webhooks/test',
		created_at: '2024-01-01T00:00:00Z',
		filter: JSON.stringify(mockAlertFilter),
		auction_id: 12345,
		auction_price: 75.0,
		seen: '2024-01-01T12:00:00Z',
	},
	{
		alert_id: 1,
		name: 'Test Alert - Intel Server',
		price: 100.0,
		vat_rate: 19.0,
		user_id: 1,
		includes_ipv4_cost: 1,
		email_notifications: 1,
		discord_notifications: 1,
		email: 'test@example.com',
		discord_webhook_url: 'https://discord.com/api/webhooks/test',
		created_at: '2024-01-01T00:00:00Z',
		filter: JSON.stringify(mockAlertFilter),
		auction_id: 12346,
		auction_price: 85.0,
		seen: '2024-01-01T12:00:00Z',
	},
];

// Mock empty query result
export const mockEmptyAlertsQueryResult: unknown[] = [];

// Mock multiple alerts query result
export const mockMultipleAlertsQueryResult = [
	...mockMatchingAlertsQueryResult,
	{
		alert_id: 2,
		name: 'Email Only Alert',
		price: 80.0,
		vat_rate: 19.0,
		user_id: 2,
		includes_ipv4_cost: 0,
		email_notifications: 1,
		discord_notifications: 0,
		email: 'user2@example.com',
		discord_webhook_url: null,
		created_at: '2024-01-01T01:00:00Z',
		filter: JSON.stringify(mockAlertFilter),
		auction_id: 12347,
		auction_price: 65.0,
		seen: '2024-01-01T12:00:00Z',
	},
];

// Mock complex alert filter (more restrictive)
export const mockComplexAlertFilter = {
	locationGermany: 1,
	locationFinland: 1,
	cpuCount: 8,
	cpuIntel: 1,
	cpuAMD: 1,
	ramInternalSize: [5, 7], // 32GB to 128GB
	ssdNvmeCount: [1, 4],
	ssdNvmeInternalSize: [2, 8], // 500GB to 2TB
	ssdSataCount: [0, 2],
	ssdSataInternalSize: [0, 4],
	hddCount: [0, 4],
	hddInternalSize: [0, 8],
	selectedDatacenters: ['FSN1-DC14', 'NBG1-DC3'],
	selectedCpuModels: ['Intel Xeon E5-2680v4', 'AMD Ryzen 7 3700X'],
	extrasECC: true,
	extrasINIC: true,
	extrasHWR: false,
	extrasGPU: false,
	extrasRPS: false,
};

// Mock user data
export const mockUser = {
	id: 1,
	email: 'test@example.com',
	discord_webhook_url: 'https://discord.com/api/webhooks/test',
};

// Mock notification results
export const mockNotificationResults = [
	{
		channel: 'discord',
		success: true,
		message: 'Notification sent successfully',
		timestamp: Date.now(),
	},
	{
		channel: 'email',
		success: true,
		message: 'Email sent successfully',
		timestamp: Date.now(),
	},
];

// Mock failed notification results
export const mockFailedNotificationResults = [
	{
		channel: 'discord',
		success: false,
		error: 'Webhook URL is invalid',
		timestamp: Date.now(),
	},
	{
		channel: 'email',
		success: false,
		error: 'SMTP server unavailable',
		timestamp: Date.now(),
	},
];

// Mock partial failure notification results
export const mockPartialFailureNotificationResults = [
	{
		channel: 'discord',
		success: false,
		error: 'Webhook URL is invalid',
		timestamp: Date.now(),
	},
	{
		channel: 'email',
		success: true,
		message: 'Email sent successfully',
		timestamp: Date.now(),
	},
];
