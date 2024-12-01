// src/app.d.ts

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
    // Define the pirsch function globally
    function pirsch(
        event_name: string,
        metadata?: { [key: string]: string | number }
    ): void;

    namespace App {
        /**
         * Represents a user in the application.
         */
        interface User {
            id: number;
            email?: string;
        }

        /**
         * Represents a session in the application.
         */
        interface Session {
            id: string;
            userId: string;
            email?: string;
            expiresAt: Date;
        }

        /**
         * Locals are data that persist for the duration of a request.
         * They are available in hooks and server-side endpoints.
         */
        interface Locals {
            user: User | null;
            session: Session | null;
        }

        /**
         * Platform-specific environment variables and services.
         */
        interface Platform {
            env: {
                RATE_LIMIT: any; // Replace `any` with a specific type if available
                DB: DB;
            };
        }

        /**
         * PageData can be used to type data loaded in +page.server.ts or +layout.server.ts.
         */
        interface PageData {
            // Define your page-specific data here
        }

        /**
         * PageState can be used to type data stored in the browser's history state.
         */
        interface PageState {
            // Define your page-specific state here
        }

        /**
         * Error can be customized to include additional information.
         */
        interface Error {
            message: string;
            stack?: string;
            errorId?: string;
        }
    }

    /**
     * Represents the database instance with its methods.
     */
    interface DB {
        /**
         * Prepares a SQL query for execution.
         * @param query - The SQL query string.
         * @returns A PreparedStatement instance.
         */
        prepare(query: string): PreparedStatement;
    }

    /**
     * Represents a prepared SQL statement.
     */
    interface PreparedStatement {
        /**
         * Binds parameters to the SQL query.
         * @param params - The parameters to bind.
         * @returns The PreparedStatement instance for chaining.
         */
        bind(...params: any[]): PreparedStatement;

        /**
         * Executes the query and retrieves all matching records.
         * @returns A promise that resolves to a QueryResult containing an array of results.
         */
        all<T = any>(): Promise<QueryResult<T>>;

        /**
         * Executes the query and retrieves the first matching record.
         * @returns A promise that resolves to a QueryResult containing an array with at most one result.
         */
        first<T = any>(): Promise<QueryResult<T>>;

        /**
         * Executes the query without expecting any return data.
         * @returns A promise that resolves when the query has been executed.
         */
        run(): Promise<void>;
    }

    /**
     * Represents the result of a database query.
     */
    interface QueryResult<T> {
        success: boolean;
        meta: {
            served_by: string;
            duration: number;
            changes: number;
            last_row_id: number;
            changed_db: boolean;
            size_after: number;
            rows_read: number;
            rows_written: number;
        };
        results: T[];
    }
}

// Ensure this file is treated as a module
export { };

