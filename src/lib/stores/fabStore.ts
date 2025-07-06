import { writable } from "svelte/store";

interface FabInstance {
  id: symbol;
  priority: number;
}

// Store to keep track of currently visible FAB instances and their priorities
const visibleFabs = writable<FabInstance[]>([]);

// Store to hold the ID of the FAB with the highest priority that should be displayed
const highestPriorityFabId = writable<symbol | null>(null);

// Function for a FAB component to register itself when it becomes visible
export function registerFab(id: symbol, priority: number) {
  visibleFabs.update((fabs) => {
    // Remove any existing entry for this ID first
    const existing = fabs.filter((fab) => fab.id !== id);
    // Add the new entry
    const updatedFabs = [...existing, { id, priority }];
    updateHighestPriority(updatedFabs);
    return updatedFabs;
  });
}

// Function for a FAB component to unregister itself when it becomes hidden
export function unregisterFab(id: symbol) {
  visibleFabs.update((fabs) => {
    const updatedFabs = fabs.filter((fab) => fab.id !== id);
    updateHighestPriority(updatedFabs);
    return updatedFabs;
  });
}

// Helper function to determine and update the highest priority FAB
function updateHighestPriority(fabs: FabInstance[]) {
  if (fabs.length === 0) {
    highestPriorityFabId.set(null);
  } else {
    // Find the FAB with the maximum priority
    // If priorities are equal, the one added last (which implies later in the DOM or later update) wins.
    // This could be refined if a different tie-breaking rule is needed.
    const highestPriorityFab = fabs.reduce(
      (max, fab) => (fab.priority >= max.priority ? fab : max),
      fabs[0],
    );
    highestPriorityFabId.set(highestPriorityFab.id);
  }
}

// Export the readable store for components to subscribe to
export const activeFabId = {
  subscribe: highestPriorityFabId.subscribe,
};
