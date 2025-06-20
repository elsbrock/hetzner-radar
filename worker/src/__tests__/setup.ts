// Vitest setup file
import { vi } from 'vitest';

// Mock console methods that might be called during tests
const originalConsole = global.console;
global.console = {
	...originalConsole,
	log: vi.fn((...args: any[]) => originalConsole.log(...args)),
	error: vi.fn((...args: any[]) => originalConsole.error(...args)),
	warn: vi.fn((...args: any[]) => originalConsole.warn(...args)),
};

// Reset all mocks after each test
afterEach(() => {
	vi.clearAllMocks();
});
