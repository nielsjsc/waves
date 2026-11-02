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
				ignoreHTTPSErrors: true,
			}
		}
	],
	reporter: 'list',
	retries: process.env.CI ? 1 : 0,
	testDir: './tests',
	timeout: 60000,
	use: {
		baseURL: 'https://localhost:5174',
		ignoreHTTPSErrors: true,
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'pnpm dev --port 5174 --strictPort',
		ignoreHTTPSErrors: true,
		reuseExistingServer: false,
		url: 'https://localhost:5174'
	},
	workers: 1
})
