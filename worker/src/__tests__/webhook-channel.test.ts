/**
 * Tests for WebhookChannel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookChannel } from '../notifications/webhook-channel';
import type { AlertNotification } from '../notifications/notification-channel';
import { mockAlertInfo, mockAlertInfoWebhookOnly, mockAlertNotification } from './fixtures/alert-data';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WebhookChannel', () => {
	let channel: WebhookChannel;

	const webhookNotification: AlertNotification = {
		...mockAlertNotification,
		alert: mockAlertInfoWebhookOnly,
	};

	beforeEach(() => {
		channel = new WebhookChannel();
		vi.clearAllMocks();
	});

	describe('isEnabled', () => {
		it('should be enabled when flag is set and URL is present', () => {
			expect(channel.isEnabled(mockAlertInfoWebhookOnly)).toBe(true);
		});

		it('should be disabled when webhook_notifications is false', () => {
			expect(channel.isEnabled(mockAlertInfo)).toBe(false);
		});

		it('should be disabled when no webhook URL is configured', () => {
			expect(channel.isEnabled({ ...mockAlertInfoWebhookOnly, webhook_url: null })).toBe(false);
		});
	});

	describe('send', () => {
		it('should POST a versioned JSON payload to the configured URL', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

			const result = await channel.send(webhookNotification);

			expect(result.success).toBe(true);
			expect(result.channel).toBe('webhook');
			expect(mockFetch).toHaveBeenCalledWith(
				mockAlertInfoWebhookOnly.webhook_url,
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
				}),
			);

			const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(payload).toMatchObject({
				event: 'price_alert.triggered',
				version: 1,
				alert: {
					id: mockAlertInfoWebhookOnly.id,
					name: mockAlertInfoWebhookOnly.name,
					targetPrice: mockAlertInfoWebhookOnly.price,
					vatRate: mockAlertInfoWebhookOnly.vat_rate,
				},
				trigger: {
					price: Number(webhookNotification.triggerPrice.toFixed(2)),
					lowestAuctionPrice: webhookNotification.lowestAuctionPrice,
				},
				url: `https://radar.iodev.org/alerts?view=${mockAlertInfoWebhookOnly.id}`,
			});
			expect(payload.auctions).toEqual(
				webhookNotification.matchedAuctions.map((a) => ({ id: a.auction_id, price: a.price, seen: a.seen })),
			);
			expect(payload.triggeredAt).toEqual(expect.any(String));
		});

		it('should return failure when the endpoint responds with an error status', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });

			const result = await channel.send(webhookNotification);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Webhook request failed');
		});

		it('should return failure when the request throws (network error / timeout)', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await channel.send(webhookNotification);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Webhook request failed');
		});

		it('should not send when the channel is disabled for the alert', async () => {
			const result = await channel.send(mockAlertNotification);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Webhook notifications disabled or no webhook URL');
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});
});
