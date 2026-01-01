import { writable, derived } from "svelte/store";
import {
  DEFAULT_CURRENCY,
  CURRENCY_CONFIG,
  type CurrencyRate,
  type CurrencyCode,
  convertPrice,
} from "$lib/currency";

export type Settings = {
  vatSelection?: { countryCode: string };
  currencySelection?: { code: string };
  exchangeRate?: CurrencyRate;
  // Allow other keys for flexibility
  [key: string]: unknown;
};

/**
 * Notification Behavior:
 * - Discord notifications are preferred when enabled and configured with a valid webhook URL
 * - Email notifications serve as automatic fallback when Discord is disabled or fails
 * - Only one notification is sent per alert: Discord if successful, otherwise email
 * - This prevents duplicate notifications while ensuring reliable delivery
 * - If both Discord and email fail, the alert is still processed but user gets no notification
 */

// Function to initialize settings from localStorage
export function createSettingsStore() {
  const storedSettings =
    typeof window !== "undefined" ? localStorage.getItem("sr-settings") : null;

  const initialSettings: Settings = storedSettings
    ? JSON.parse(storedSettings)
    : {};

  // Ensure vatSelection exists with a default if not set
  if (initialSettings.vatSelection === undefined) {
    initialSettings.vatSelection = { countryCode: "DE" };
  }

  // Ensure currencySelection exists with a default if not set
  if (initialSettings.currencySelection === undefined) {
    initialSettings.currencySelection = { code: DEFAULT_CURRENCY };
  }

  // Persist defaults if they were just added and we are in a browser context
  // Only write back if settings were initially empty to avoid overwriting concurrent changes
  if (typeof window !== "undefined" && !storedSettings) {
    localStorage.setItem("sr-settings", JSON.stringify(initialSettings));
  }

  const { subscribe, set, update } = writable<Settings>(initialSettings);

  return {
    subscribe,
    // Set entire settings object
    set,
    // Update specific setting by key
    updateSetting: (key: string, value: unknown) =>
      update((settings) => {
        const newSettings = { ...settings, [key]: value };
        if (typeof window !== "undefined") {
          localStorage.setItem("sr-settings", JSON.stringify(newSettings));
        }
        return newSettings;
      }),
    // Remove a specific setting
    removeSetting: (key: string) =>
      update((settings) => {
        const { [key]: _, ...rest } = settings;
        if (typeof window !== "undefined") {
          localStorage.setItem("sr-settings", JSON.stringify(rest));
        }
        return rest;
      }),
    // Reset all settings
    reset: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sr-settings");
      }
      set({});
    },
  };
}

export const settingsStore = createSettingsStore();

// Derived store for current currency code
export const currentCurrency = derived(settingsStore, ($settings) => {
  return ($settings.currencySelection?.code ||
    DEFAULT_CURRENCY) as CurrencyCode;
});

// Derived store for current currency symbol
export const currencySymbol = derived(currentCurrency, ($currency) => {
  return CURRENCY_CONFIG[$currency]?.symbol || "€";
});

// Helper function to format price with current currency
export function formatPrice(
  priceInEur: number,
  currency: CurrencyCode,
  decimals: number = 2,
): string {
  const symbol = CURRENCY_CONFIG[currency]?.symbol || "€";
  const converted = convertPrice(priceInEur, "EUR", currency);
  return `${converted.toFixed(decimals)} ${symbol}`;
}
