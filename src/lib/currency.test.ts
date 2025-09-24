import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  convertPrice,
  formatCurrencyPrice,
  getCurrentRate,
  isRateStale,
  CURRENCY_CONFIG,
  DEFAULT_CURRENCY,
  type CurrencyRate,
} from "./currency";

describe("Currency Configuration", () => {
  it("should have correct EUR configuration", () => {
    expect(CURRENCY_CONFIG.EUR).toEqual({
      name: "Euro",
      symbol: "€",
      code: "EUR",
      flag: "🇪🇺",
      isBase: true,
    });
  });

  it("should have correct USD configuration", () => {
    expect(CURRENCY_CONFIG.USD).toEqual({
      name: "US Dollar",
      symbol: "$",
      code: "USD",
      flag: "🇺🇸",
      isBase: false,
    });
  });

  it("should have EUR as default currency", () => {
    expect(DEFAULT_CURRENCY).toBe("EUR");
  });
});

describe("Currency Conversion", () => {
  beforeEach(() => {
    // Reset any cached rates
    vi.clearAllMocks();
  });

  it("should return same price for same currency conversion", () => {
    expect(convertPrice(100, "EUR", "EUR")).toBe(100);
    expect(convertPrice(50, "USD", "USD")).toBe(50);
  });

  it("should convert EUR to USD correctly", () => {
    const rate = getCurrentRate();
    const eurPrice = 100;
    const expectedUsdPrice = eurPrice * rate.rate;

    expect(convertPrice(eurPrice, "EUR", "USD")).toBe(expectedUsdPrice);
  });

  it("should convert USD to EUR correctly", () => {
    const rate = getCurrentRate();
    const usdPrice = 110;
    const expectedEurPrice = usdPrice / rate.rate;

    expect(convertPrice(usdPrice, "USD", "EUR")).toBe(expectedEurPrice);
  });

  it("should handle null/undefined prices", () => {
    expect(convertPrice(null as any, "EUR", "USD")).toBe(0);
    expect(convertPrice(undefined as any, "EUR", "USD")).toBe(0);
    expect(convertPrice(NaN, "EUR", "USD")).toBe(0);
  });

  it("should handle unsupported currency conversions", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(convertPrice(100, "GBP", "EUR")).toBe(100);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Unsupported currency conversion: GBP to EUR",
    );

    consoleSpy.mockRestore();
  });

  it("should handle zero prices", () => {
    expect(convertPrice(0, "EUR", "USD")).toBe(0);
  });

  it("should handle negative prices", () => {
    const rate = getCurrentRate();
    expect(convertPrice(-100, "EUR", "USD")).toBe(-100 * rate.rate);
  });
});

describe("Price Formatting", () => {
  it("should format EUR prices correctly", () => {
    expect(formatCurrencyPrice(45.67, "EUR", "mo")).toBe("€45.67");
    expect(formatCurrencyPrice(1.2345, "EUR", "hr")).toBe("€1.2345");
  });

  it("should format USD prices correctly", () => {
    expect(formatCurrencyPrice(50.23, "USD", "mo")).toBe("$50.23");
    expect(formatCurrencyPrice(2.1234, "USD", "hr")).toBe("$2.1234");
  });

  it("should handle different decimal places for time units", () => {
    // Monthly should have 2 decimal places
    expect(formatCurrencyPrice(45.6789, "EUR", "mo")).toBe("€45.68");

    // Hourly should have 4 decimal places
    expect(formatCurrencyPrice(1.23456789, "EUR", "hr")).toBe("€1.2346");
  });

  it("should handle null/undefined/NaN prices", () => {
    expect(formatCurrencyPrice(null as any, "EUR", "mo")).toBe("N/A");
    expect(formatCurrencyPrice(undefined as any, "EUR", "mo")).toBe("N/A");
    expect(formatCurrencyPrice(NaN, "EUR", "mo")).toBe("N/A");
  });

  it("should handle unknown currencies", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(formatCurrencyPrice(100, "GBP", "mo")).toBe("100");
    expect(consoleSpy).toHaveBeenCalledWith("Unknown currency: GBP");

    consoleSpy.mockRestore();
  });

  it("should default to monthly format when no time unit specified", () => {
    expect(formatCurrencyPrice(45.6789, "EUR")).toBe("€45.68");
  });
});

describe("Exchange Rate Management", () => {
  it("should return a valid exchange rate", () => {
    const rate = getCurrentRate();

    expect(rate).toHaveProperty("rate");
    expect(rate).toHaveProperty("lastUpdated");
    expect(rate).toHaveProperty("source");
    expect(typeof rate.rate).toBe("number");
    expect(rate.rate).toBeGreaterThan(0);
  });

  it("should detect stale rates", () => {
    const freshRate: CurrencyRate = {
      rate: 1.1,
      lastUpdated: new Date().toISOString(),
      source: "test",
    };

    const staleRate: CurrencyRate = {
      rate: 1.1,
      lastUpdated: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
      source: "test",
    };

    expect(isRateStale(freshRate)).toBe(false);
    expect(isRateStale(staleRate)).toBe(true);
  });
});
