/// <reference types="vitest/config" />

import os from 'node:os'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import {defineConfig, type Connect, type Plugin} from 'vite'

const VIRTUAL_INTERFACE_RE = /loopback|vethernet|wsl|hyper-v|virtualbox|vmware|docker|tailscale|zerotier/i

function getHostLanIps(): string[] {
	const ips: string[] = []
	for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
		if (!addrs || VIRTUAL_INTERFACE_RE.test(name)) continue
		for (const addr of addrs) {
			if (addr.family !== 'IPv4' || addr.internal) continue
			if (addr.address.startsWith('127.') || addr.address.startsWith('169.254.')) continue
			ips.push(addr.address)
		}
	}
	return ips
}

function attachHostNetworkRoute(middlewares: Connect.Server) {
	middlewares.use('/api/host-network', (_req, res) => {
		const ips = getHostLanIps()
		res.statusCode = 200
		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Cache-Control', 'no-store')
		res.end(JSON.stringify({online: ips.length > 0, ips}))
	})
}

function hostNetworkStatusPlugin(): Plugin {
	return {
		name: 'waves-host-network-status',
		configureServer(server) {
			attachHostNetworkRoute(server.middlewares)
		},
		configurePreviewServer(server) {
			attachHostNetworkRoute(server.middlewares)
		},
	}
}

export default defineConfig(() => ({
	plugins: [react(), tailwindcss(), hostNetworkStatusPlugin()],
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
		allowedHosts: true,
	}
}))
