import adapterStatic from '@sveltejs/adapter-static';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';

const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Use adapter-static for Tauri desktop builds (SSG/SPA mode)
		// Use adapter-cloudflare for web deployment to Cloudflare Pages
		adapter: isTauriBuild
			? adapterStatic({
					pages: 'build',
					assets: 'build',
					fallback: 'index.html',
					precompress: false,
					strict: true
				})
			: adapterCloudflare({
					routes: {
						include: ['/*'],
						exclude: ['<all>']
					}
				})
	}
};

export default config;
