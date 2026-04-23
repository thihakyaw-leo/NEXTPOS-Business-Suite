<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PwaInstallPrompt from '$lib/components/PwaInstallPrompt.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { auth } from '$lib/stores/auth.svelte';
	import { initSyncManager } from '$lib/syncManager';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		void auth.initialize();

		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			void navigator.serviceWorker.register('/service-worker.js');
		}
	});

	$effect(() => {
		if (!browser || !auth.initialized || !auth.isActivated) {
			return;
		}

		void initSyncManager();
	});

	$effect(() => {
		if (!browser || !auth.initialized) {
			return;
		}

		const pathname = page.url.pathname;
		const search = page.url.search;

		if (pathname === '/') {
			void goto(auth.isActivated ? '/pos/dashboard' : '/auth/register', { replaceState: true });
			return;
		}

		if (!auth.isActivated && !isPublicPath(pathname)) {
			const target = `${pathname}${search}`;
			void goto(`/auth/register?redirect=${encodeURIComponent(target)}`, { replaceState: true });
			return;
		}

		if (auth.isActivated && pathname === '/auth/register') {
			const redirectTarget = page.url.searchParams.get('redirect') || '/pos/dashboard';
			void goto(redirectTarget, { replaceState: true });
		}
	});

	function isPublicPath(pathname: string): boolean {
		return pathname === '/auth/register' || pathname.startsWith('/admin');
	}

	function shouldBlockTenantContent(pathname: string): boolean {
		if (isPublicPath(pathname)) {
			return false;
		}

		return pathname === '/' || !auth.initialized || !auth.isActivated;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png" />
	<meta name="application-name" content="NextPOS Business Suite" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="NextPOS" />
	<meta name="mobile-web-app-capable" content="yes" />
</svelte:head>

{#if shouldBlockTenantContent(page.url.pathname)}
	<div class="tenant-guard">
		<div class="tenant-guard__card">
			<p class="tenant-guard__eyebrow">Tenant Activation</p>
			<h1 class="tenant-guard__title">
				{auth.initialized ? 'Redirecting to device registration...' : 'Validating this device...'}
			</h1>
			<p class="tenant-guard__copy">
				{auth.initialized
					? 'This workspace requires an active tenant license before POS or HR modules can open.'
					: 'Checking the stored tenant token, device fingerprint, and plan permissions.'}
			</p>
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<PwaInstallPrompt />

<style>
	.tenant-guard {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background:
			radial-gradient(circle at top, rgba(45, 212, 191, 0.14), transparent 36%),
			linear-gradient(180deg, #07111f 0%, #0f172a 100%);
	}

	.tenant-guard__card {
		width: min(100%, 34rem);
		padding: 2rem;
		border-radius: 1.5rem;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.82);
		box-shadow: 0 24px 60px rgba(15, 23, 42, 0.42);
		backdrop-filter: blur(16px);
	}

	.tenant-guard__eyebrow {
		margin: 0 0 0.75rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #67e8f9;
	}

	.tenant-guard__title {
		margin: 0;
		font-size: clamp(1.9rem, 4vw, 2.6rem);
		color: #f8fafc;
	}

	.tenant-guard__copy {
		margin: 1rem 0 0;
		line-height: 1.65;
		color: #cbd5e1;
	}
</style>
