/// <reference types="vitest/config" />

import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'
import fs from 'fs';

export default defineConfig(() => ({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(import.meta.dirname, './src')
		}
	},
	test: {
		bail: 1,
		clearMocks: true,
		coverage: {
			enabled: false,
			exclude: ['src/main.tsx'],
			include: ['src/**/*'],
			reporter: ['text', 'lcov'],
			reportsDirectory: 'coverage'
		},
		css: false,
		environment: 'happy-dom',
		globals: true,
		include: ['src/**/*.test.ts?(x)'],
		setupFiles: 'src/test-setup.ts'
	},
	server: {
		host: true,
		https: {
			key: fs.readFileSync('../security/waves-key.pem'),
			cert: fs.readFileSync('../security/waves-cert.pem')
		},
	}
}))
