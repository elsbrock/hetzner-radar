import { sveltekit } from '@sveltejs/kit/vite';
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

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	define: {
		__BUILD_STAMP__: JSON.stringify(`${formattedDate}`)
	}
});
