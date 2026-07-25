// src/app.d.ts

// See https://kit.svelte.dev/docs/types#app for information about these interfaces

declare global {
  interface RateLimitOptions {
    key: string;
    weight?: number;
    window?: number;
    expiration?: number;
  }

  interface RateLimitResult {
    success: boolean;
    remaining?: number;
    reset?: number;
    limit?: number;
  }

  interface RateLimitNamespace {
    limit(options: RateLimitOptions): Promise<RateLimitResult>;
  }

  interface CloudStatusService {
    getStatus(): Promise<unknown>;
  }

  interface RadarWorkerService {
    getStatus(): Promise<unknown>;
    getHistoricalAvailability(options: unknown): Promise<unknown>;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }

  interface RunResult {
    success: boolean;
    error?: string;
    changes?: number;
    duration?: number;
  }

  interface QueryResult<T> extends RunResult {
    meta?: {
      served_by?: string;
      duration?: number;
      changes?: number;
      last_row_id?: number;
      changed_db?: boolean;
      size_after?: number;
      rows_read?: number;
      rows_written?: number;
    };
    results: T[];
  }

  interface PreparedStatement {
    bind(...params: unknown[]): PreparedStatement;
    all<T = unknown>(): Promise<QueryResult<T>>;
    first<T = unknown>(column?: string): Promise<T | null>;
    run(): Promise<RunResult>;
  }

  interface DB {
    prepare(query: string): PreparedStatement;
    batch(
      statements: PreparedStatement[],
    ): Promise<Array<QueryResult<unknown>>>;
  }

  interface SnapshotNamespace {
    get(key: string, type: "json"): Promise<unknown | null>;
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  }

  interface PlatformEnv {
    DB: DB;
    RATE_LIMIT: RateLimitNamespace;
    RADAR_WORKER?: RadarWorkerService;
    /** Auction snapshot published by the worker; read by /mcp. */
    SNAPSHOT?: SnapshotNamespace;
    FORWARDEMAIL_API_KEY?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    VITE_BUILD_STAMP?: string;
    OTLP_ENDPOINT?: string;
    OTLP_AUTH_TOKEN?: string;
  }

  namespace App {
    interface User {
      id: string;
      email?: string;
    }

    interface Session {
      id: string;
      userId: string;
      email?: string;
      expiresAt: Date;
    }

    interface Locals {
      user: User | null;
      session: Session | null;
    }

    interface Platform {
      env?: PlatformEnv;
      context?: ExecutionContext;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface PageData {}

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface PageState {}

    interface Error {
      message: string;
      stack?: string;
      errorId?: string;
    }
  }
}

export {};
