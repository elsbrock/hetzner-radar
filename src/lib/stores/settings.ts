import { writable } from 'svelte/store';

type Settings = {
  [key: string]: any;
};

// Function to initialize settings from localStorage
function createSettingsStore() {
  const storedSettings = typeof window !== 'undefined'
    ? localStorage.getItem('sr-settings')
    : null;

  const initialSettings: Settings = storedSettings
    ? JSON.parse(storedSettings)
    : {};

  const { subscribe, set, update } = writable<Settings>(initialSettings);

  return {
    subscribe,
    // Set entire settings object
    set,
    // Update specific setting by key
    updateSetting: (key: string, value: any) =>
      update(settings => {
        const newSettings = { ...settings, [key]: value };
        if (typeof window !== 'undefined') {
          localStorage.setItem('sr-settings', JSON.stringify(newSettings));
        }
        return newSettings;
      }),
    // Remove a specific setting
    removeSetting: (key: string) =>
      update(settings => {
        const { [key]: _, ...rest } = settings;
        if (typeof window !== 'undefined') {
          localStorage.setItem('sr-settings', JSON.stringify(rest));
        }
        return rest;
      }),
    // Reset all settings
    reset: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sr-settings');
      }
      set({});
    }
  };
}

export const settingsStore = createSettingsStore();
