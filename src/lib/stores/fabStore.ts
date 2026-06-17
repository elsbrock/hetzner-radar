import { writable } from "svelte/store";

interface FabInstance {
  id: symbol;
  priority: number;
}

// Store to keep track of currently visible FAB instances and their priorities
const visibleFabs = writable<FabInstance[]>([]);

// Store mapping each visible FAB id to its vertical slot index.
// Slot 0 is the bottom-most slot and is assigned to the highest-priority FAB.
// Higher slot numbers stack upward.
const fabSlotMap = writable<Map<symbol, number>>(new Map());

// Function for a FAB component to register itself when it becomes visible
export function registerFab(id: symbol, priority: number) {
  visibleFabs.update((fabs) => {
    // Remove any existing entry for this ID first
    const existing = fabs.filter((fab) => fab.id !== id);
    // Add the new entry (appended last so it wins ties — same as before)
    const updatedFabs = [...existing, { id, priority }];
    updateSlots(updatedFabs);
    return updatedFabs;
  });
}

// Function for a FAB component to unregister itself when it becomes hidden
export function unregisterFab(id: symbol) {
  visibleFabs.update((fabs) => {
    const updatedFabs = fabs.filter((fab) => fab.id !== id);
    updateSlots(updatedFabs);
    return updatedFabs;
  });
}

// Helper to recompute the slot index for every visible FAB.
// Sort by priority DESCENDING so the highest priority gets slot 0 (bottom-most).
// Ties are broken stably by registration order (last-registered wins), matching
// the previous single-slot behavior.
function updateSlots(fabs: FabInstance[]) {
  const ordered = fabs
    .map((fab, index) => ({ ...fab, index }))
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Same priority: later registration (higher index) wins => lower slot.
      return b.index - a.index;
    });

  const slots = new Map<symbol, number>();
  ordered.forEach((fab, slot) => {
    slots.set(fab.id, slot);
  });
  fabSlotMap.set(slots);
}

// Readable store exposing the id -> slot index mapping. Components subscribe to
// look up their own slot and position themselves accordingly.
export const fabSlots = {
  subscribe: fabSlotMap.subscribe,
};
