import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

// Public URL of the deployed Cloudflare Worker — not a secret, safe to commit.
// Used as the API base in Tauri desktop builds (relative /api won't work there).
// Override with the VITE_WORKER_URL environment variable for staging/CI.
const TAURI_DEFAULT_WORKER_URL = 'https://kt-pos-business-suite.thihakyaw-leo.workers.dev';

const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig(({ mode }) => {
	// Load all VITE_ prefixed vars from .env, .env.local, .env.[mode] etc.
	const env = loadEnv(mode, process.cwd(), 'VITE_');

	// Determine the API base:
	//   - Development: always empty (Vite server.proxy routes /api to the local Worker port 8787).
	//   - Production:  absolute Worker URL (Cloudflare Pages deploy and Tauri builds both need this because they are separate from the backend).
	const workerUrl = mode === 'development'
		? ''
		: (env['VITE_WORKER_URL'] || process.env['VITE_WORKER_URL'] || TAURI_DEFAULT_WORKER_URL);

	return {
		plugins: [tailwindcss(), sveltekit()],
		define: {
			'import.meta.env.VITE_WORKER_URL': JSON.stringify(workerUrl),
		},
		server: {
			proxy: {
				'/api': {
					target: 'http://localhost:8787',
					changeOrigin: true,
				},
			},
		},
		optimizeDeps: {
			include: ['jspdf', 'jspdf-autotable'],
		},
	};
});



