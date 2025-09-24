import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import { settingsStore, createSettingsStore } from "./settings";
import { DEFAULT_CURRENCY } from "$lib/currency";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock both window and localStorage globally
Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: localStorageMock,
  },
  writable: true,
});

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("Settings Store Currency Integration", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);

    // Reset the store
    settingsStore.reset();
  });

  it("should initialize with default currency selection when no stored settings exist", () => {
    localStorageMock.getItem.mockReturnValue(null);

    // Create a new store instance to test initialization
    const store = createSettingsStore();
    const settings = get(store);

    expect(settings.currencySelection).toEqual({ code: DEFAULT_CURRENCY });
    expect(settings.currencySelection?.code).toBe("EUR");
  });

  it("should preserve existing currency selection from localStorage", () => {
    const existingSettings = {
      vatSelection: { countryCode: "US" },
      currencySelection: { code: "USD" },
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existingSettings));

    // Create a new store instance to test initialization
    const store = createSettingsStore();
    const settings = get(store);

    expect(settings.currencySelection).toEqual({ code: "USD" });
    expect(settings.vatSelection).toEqual({ countryCode: "US" });
  });

  it("should add default currency selection to existing settings without currency", () => {
    const existingSettings = {
      vatSelection: { countryCode: "FR" },
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existingSettings));

    // Create a new store instance to test initialization
    const store = createSettingsStore();
    const settings = get(store);

    expect(settings.currencySelection).toEqual({ code: DEFAULT_CURRENCY });
    expect(settings.vatSelection).toEqual({ countryCode: "FR" });
  });

  it("should update currency selection and persist to localStorage", () => {
    const newCurrencySelection = { code: "USD" };

    settingsStore.updateSetting("currencySelection", newCurrencySelection);

    const settings = get(settingsStore);
    expect(settings.currencySelection).toEqual(newCurrencySelection);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "sr-settings",
      expect.stringContaining('"currencySelection":{"code":"USD"}'),
    );
  });

  it("should handle exchange rate caching in settings", () => {
    const exchangeRate = {
      rate: 1.15,
      lastUpdated: new Date().toISOString(),
      source: "api",
    };

    settingsStore.updateSetting("exchangeRate", exchangeRate);

    const settings = get(settingsStore);
    expect(settings.exchangeRate).toEqual(exchangeRate);
  });

  it("should remove currency selection when requested", () => {
    // First set a currency selection
    settingsStore.updateSetting("currencySelection", { code: "USD" });

    // Then remove it
    settingsStore.removeSetting("currencySelection");

    const settings = get(settingsStore);
    expect(settings.currencySelection).toBeUndefined();
  });

  it("should reset currency selection when store is reset", () => {
    // Set some currency selection
    settingsStore.updateSetting("currencySelection", { code: "USD" });

    // Reset the store
    settingsStore.reset();

    const settings = get(settingsStore);
    expect(Object.keys(settings)).toHaveLength(0);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("sr-settings");
  });

  it("should handle both VAT and currency selections together", () => {
    const vatSelection = { countryCode: "US" };
    const currencySelection = { code: "USD" };

    settingsStore.updateSetting("vatSelection", vatSelection);
    settingsStore.updateSetting("currencySelection", currencySelection);

    const settings = get(settingsStore);
    expect(settings.vatSelection).toEqual(vatSelection);
    expect(settings.currencySelection).toEqual(currencySelection);
  });

  it("should persist defaults to localStorage only when no existing settings", () => {
    // Mock empty localStorage
    localStorageMock.getItem.mockReturnValue(null);

    // Create a new store instance
    createSettingsStore();

    // Should persist defaults since no existing settings
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "sr-settings",
      expect.stringContaining('"vatSelection":{"countryCode":"DE"}'),
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "sr-settings",
      expect.stringContaining('"currencySelection":{"code":"EUR"}'),
    );
  });

  it("should not persist defaults when existing settings are present", () => {
    // Mock existing settings
    const existingSettings = { someOtherSetting: "value" };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existingSettings));

    // Create a new store instance
    createSettingsStore();

    // Should not call setItem since settings already existed
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});
