/**
 * Database mock fixtures and utilities
 */

import type { DatabaseStats } from '../../auction-db-service';

export interface MockD1Result {
	results: unknown[];
	success: boolean;
	meta: {
		changed_db: boolean;
		changes: number;
		duration: number;
		last_row_id: number;
		rows_read: number;
		rows_written: number;
		size_after: number;
	};
}

export interface MockD1PreparedStatement {
	bind: (...values: unknown[]) => MockD1PreparedStatement;
	run: () => Promise<MockD1Result>;
	all: () => Promise<MockD1Result>;
	first: () => Promise<unknown>;
}

export interface MockD1Database {
	prepare: (query: string) => MockD1PreparedStatement;
	batch: (statements: MockD1PreparedStatement[]) => Promise<MockD1Result[]>;
	exec: (query: string) => Promise<MockD1Result>;
}

export interface MockDurableObjectStorage {
	get: <T>(key: string) => Promise<T | undefined>;
	put: (key: string | Record<string, unknown>, value?: unknown) => Promise<void>;
	delete: (key: string) => Promise<boolean>;
	setAlarm: (timestamp: Date | number) => Promise<void>;
}

export function createMockD1Database(overrides: Partial<MockD1Database> = {}): MockD1Database {
	const mockStatement: MockD1PreparedStatement = {
		bind: (..._values: unknown[]) => mockStatement,
		run: async () => ({
			results: [],
			success: true,
			meta: {
				changed_db: true,
				changes: 1,
				duration: 10,
				last_row_id: 1,
				rows_read: 0,
				rows_written: 1,
				size_after: 1024,
			},
		}),
		all: async () => ({
			results: [],
			success: true,
			meta: {
				changed_db: false,
				changes: 0,
				duration: 5,
				last_row_id: 0,
				rows_read: 0,
				rows_written: 0,
				size_after: 1024,
			},
		}),
		first: async () => null,
	};

	return {
		prepare: (_query: string) => mockStatement,
		batch: async (_statements: MockD1PreparedStatement[]) => [
			{
				results: [],
				success: true,
				meta: {
					changed_db: true,
					changes: 1,
					duration: 15,
					last_row_id: 1,
					rows_read: 0,
					rows_written: 1,
					size_after: 1024,
				},
			},
		],
		exec: async (_query: string) => ({
			results: [],
			success: true,
			meta: {
				changed_db: true,
				changes: 1,
				duration: 10,
				last_row_id: 1,
				rows_read: 0,
				rows_written: 1,
				size_after: 1024,
			},
		}),
		...overrides,
	};
}

export function createMockDurableObjectStorage(initialData: Record<string, unknown> = {}): MockDurableObjectStorage {
	const storage = new Map<string, unknown>(Object.entries(initialData));

	return {
		get: async <T>(key: string): Promise<T | undefined> => {
			return storage.get(key) as T | undefined;
		},
		put: async (key: string | Record<string, unknown>, value?: unknown): Promise<void> => {
			if (typeof key === 'string') {
				storage.set(key, value);
			} else {
				for (const [k, v] of Object.entries(key)) {
					storage.set(k, v);
				}
			}
		},
		delete: async (key: string): Promise<boolean> => {
			return storage.delete(key);
		},
		setAlarm: async (_timestamp: Date | number): Promise<void> => {
			// Mock implementation - do nothing
		},
	};
}

export const mockCurrentAuctionStates = [
	{ id: 12345, price: 85.0, last_changed: '2023-11-01T10:00:00.000Z' },
	{ id: 67890, price: 45.5, last_changed: '2023-11-01T09:00:00.000Z' },
];

export const mockDatabaseStats: DatabaseStats = {
	processed: 2,
	newAuctions: 1,
	priceChanges: 1,
	errors: 0,
};
