// Vitest setup file
import { vi, afterEach } from 'vitest';

// Mock console methods that might be called during tests
const originalConsole = global.console;
global.console = {
	...originalConsole,
	log: vi.fn((...args: unknown[]) => originalConsole.log(...args)),
	error: vi.fn((...args: unknown[]) => originalConsole.error(...args)),
	warn: vi.fn((...args: unknown[]) => originalConsole.warn(...args)),
};

// Reset all mocks after each test
afterEach(() => {
	vi.clearAllMocks();
});
