/**
 * Currency configuration and conversion utilities
 */

export interface CurrencyOption {
  name: string;
  symbol: string;
  code: string;
  flag: string;
  isBase?: boolean;
}

export interface CurrencyRate {
  rate: number;
  lastUpdated: string;
  source: string;
}

export interface CurrencyOptions {
  EUR: CurrencyOption;
  USD: CurrencyOption;
}

// Static currency configuration
export const CURRENCY_CONFIG: CurrencyOptions = {
  EUR: {
    name: "Euro",
    symbol: "€",
    code: "EUR",
    flag: "🇪🇺",
    isBase: true,
  },
  USD: {
    name: "US Dollar",
    symbol: "$",
    code: "USD",
    flag: "🇺🇸",
    isBase: false,
  },
};

// Default currency selection
export const DEFAULT_CURRENCY = "EUR";

// Type for currency codes
export type CurrencyCode = keyof CurrencyOptions;
// Fixed exchange rate for initial implementation
const FIXED_EXCHANGE_RATE: CurrencyRate = {
  rate: 1.1, // 1 EUR = 1.10 USD
  lastUpdated: new Date().toISOString(),
  source: "fixed",
};

// Cached exchange rate
let cachedRate: CurrencyRate | null = null;

/**
 * Get current exchange rate with caching and fallback logic
 */
export function getCurrentRate(): CurrencyRate {
  // Return cached rate if available and not stale (24 hours)
  if (cachedRate) {
    const cacheAge = Date.now() - new Date(cachedRate.lastUpdated).getTime();
    const isStale = cacheAge > 24 * 60 * 60 * 1000; // 24 hours

    if (!isStale) {
      return cachedRate;
    }
  }

  // For initial implementation, use fixed rate
  cachedRate = FIXED_EXCHANGE_RATE;
  return cachedRate;
}

/**
 * Convert price from one currency to another
 */
export function convertPrice(
  price: number,
  fromCurrency: string,
  toCurrency: string,
): number {
  // If same currency, no conversion needed
  if (fromCurrency === toCurrency) {
    return price;
  }

  // Handle null/invalid prices
  if (price === null || price === undefined || isNaN(price)) {
    return 0;
  }

  const rate = getCurrentRate();

  // Convert EUR to USD
  if (fromCurrency === "EUR" && toCurrency === "USD") {
    return price * rate.rate;
  }

  // Convert USD to EUR
  if (fromCurrency === "USD" && toCurrency === "EUR") {
    return price / rate.rate;
  }

  // Fallback: return original price if unsupported conversion
  console.warn(
    `Unsupported currency conversion: ${fromCurrency} to ${toCurrency}`,
  );
  return price;
}

/**
 * Format currency price with symbol and proper decimal places
 */
export function formatCurrencyPrice(
  price: number,
  currency: string,
  timeUnit: string = "mo",
): string {
  if (price === null || price === undefined || isNaN(price)) {
    return "N/A";
  }

  const currencyConfig = CURRENCY_CONFIG[currency as keyof CurrencyOptions];
  if (!currencyConfig) {
    console.warn(`Unknown currency: ${currency}`);
    return price.toString();
  }

  // Determine decimal places based on time unit
  const decimalPlaces = timeUnit === "hr" ? 4 : 2;

  // Format price with appropriate decimal places
  const formattedPrice = price.toFixed(decimalPlaces);

  // Return formatted string with currency symbol
  return `${currencyConfig.symbol}${formattedPrice}`;
}

/**
 * Check if exchange rate is stale (older than 24 hours)
 */
export function isRateStale(rate: CurrencyRate): boolean {
  const cacheAge = Date.now() - new Date(rate.lastUpdated).getTime();
  return cacheAge > 24 * 60 * 60 * 1000; // 24 hours
}
