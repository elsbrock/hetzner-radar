import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendTestWebhookNotification } from "./webhook";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("sendTestWebhookNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends ntfy.sh URLs as a native ntfy publish", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await sendTestWebhookNotification(
      "https://ntfy.sh/my-topic",
    );

    expect(result.success).toBe(true);
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers["Content-Type"]).toBe("text/plain; charset=utf-8");
    expect(init.headers["X-Title"]).toBe("Server Radar test");
    expect(() => JSON.parse(init.body)).toThrow();
  });

  it("sends the JSON envelope everywhere else", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await sendTestWebhookNotification("https://example.com/hooks/radar");

    const init = mockFetch.mock.calls[0][1];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body).event).toBe("test");
  });

  it("reports the endpoint's status and body so the UI can explain the failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => '{"code":42901,"error":"limit reached"}',
    });

    const result = await sendTestWebhookNotification(
      "https://ntfy.sh/my-topic",
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(429);
    expect(result.reason).toContain("limit reached");
  });

  it("falls back to statusText when the body cannot be read", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => {
        throw new Error("stream already consumed");
      },
    });

    const result = await sendTestWebhookNotification(
      "https://ntfy.sh/my-topic",
    );

    expect(result.status).toBe(403);
    expect(result.reason).toBe("Forbidden");
  });

  it("reports network failures rather than swallowing them", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await sendTestWebhookNotification(
      "https://ntfy.sh/my-topic",
    );

    expect(result.success).toBe(false);
    expect(result.status).toBeUndefined();
    expect(result.reason).toBe("Network error");
  });
});
