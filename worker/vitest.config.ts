import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['**/*.test.ts'],
		exclude: ['node_modules/**'],
		setupFiles: ['./src/__tests__/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov', 'html'],
			exclude: [
				'node_modules/**',
				'**/*.test.ts',
				'**/*.d.ts',
				'coverage/**',
				'dist/**',
				'wrangler.jsonc',
				'vitest.config.ts',
				'eslint.config.js',
			],
		},
	},
	resolve: {
		alias: {
			'~': new URL('./src', import.meta.url).pathname,
		},
	},
});
