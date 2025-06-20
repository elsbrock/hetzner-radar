import { type ServerFilter } from '$lib/filter';
import { writable } from 'svelte/store';

export const filter = writable<ServerFilter | null>(null);

// filter stored in local storage of user's browser
export const storedFilter = writable<ServerFilter | null>(null);
