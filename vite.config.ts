import { sveltekit } from '@sveltejs/kit/vite';
import removeConsole from 'vite-plugin-remove-console';
import { defineConfig } from 'vitest/config';

const date = new Date();
const formattedDate = date.toLocaleDateString('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin'
});

export default defineConfig(({ mode }) => ({
	plugins: [
		sveltekit(),
		process.env.NODE_ENV === 'production' ? removeConsole({
			includes: ["log", "debug", "table", "info"]
		}) : undefined,
	],
	build: {
		rollupOptions: {
			external: ['emailjs']
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	define: {
		__BUILD_STAMP__: JSON.stringify(`${formattedDate}`)
	}
}));
