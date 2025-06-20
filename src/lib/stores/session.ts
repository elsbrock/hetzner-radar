import { writable, type Writable } from 'svelte/store';

// Explicitly type the store to accept Session or null
export const session: Writable<App.Session | null> = writable(null);
