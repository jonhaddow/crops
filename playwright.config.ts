import { defineConfig, devices } from '@playwright/test';

// End-to-end tests play the game in a tablet-sized Chromium with touch, on the
// dev server. Each test starts with an empty localStorage.
// Not 5180-5182: other apps use those, and sessions run them at once.
const PORT = 5190;

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	reporter: [['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		...devices['iPad (gen 11) landscape'],
		// Chromium, not WebKit: it's the only browser installed.
		defaultBrowserType: 'chromium',
		trace: 'retain-on-failure'
	},
	webServer: {
		command: `npx vite dev --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}/`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
