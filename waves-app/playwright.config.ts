import process from 'node:process'
import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	fullyParallel: false,
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				channel: 'chrome',
				viewport: {width: 1280, height: 850},
			}
		}
	],
	reporter: 'list',
	retries: process.env.CI ? 1 : 0,
	testDir: './tests',
	timeout: 60000,
	use: {
		baseURL: 'http://localhost:5174',
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'pnpm dev --port 5174 --strictPort',
		reuseExistingServer: false,
		url: 'http://localhost:5174'
	},
	workers: 1
})
