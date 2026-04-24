<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import PwaInstallPrompt from '$lib/components/PwaInstallPrompt.svelte';
  import favicon from '$lib/assets/favicon.svg';
  import { auth } from '$lib/stores/auth.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { initSyncManager } from '$lib/syncManager';
  import { onMount } from 'svelte';
  import '../app.css';

  let { children } = $props();
  let activationCode = $state('');
  let isActivating = $state(false);
  let error = $state('');

  onMount(() => {
    ui.initializeTheme();
    void auth.initialize();

    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/service-worker.js');
    }
  });

  async function handleDirectActivation() {
    if (!activationCode.trim()) return;
    isActivating = true;
    error = '';
    try {
      await auth.activateWithToken(activationCode);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid code.';
    } finally {
      isActivating = false;
    }
  }

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

    // Still allow standard register/login pages
    if (isPublicPath(pathname)) {
      if (auth.isActivated && pathname === '/auth/register') {
        const redirectTarget = page.url.searchParams.get('redirect') || '/pos/dashboard';
        void goto(redirectTarget, { replaceState: true });
      }
      return;
    }

    if (!auth.isActivated && !isPublicPath(pathname)) {
      // We don't redirect anymore, we show the guard in-place
      return;
    }
  });

  function isPublicPath(pathname: string): boolean {
    return (
      pathname === '/auth/register' ||
      pathname === '/auth/login' ||
      pathname.startsWith('/admin')
    );
  }

  function shouldBlockTenantContent(pathname: string): boolean {
    if (isPublicPath(pathname)) {
      return false;
    }

    return !auth.initialized || !auth.isActivated;
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png" />
  <meta name="application-name" content="KT POS Business Suite" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="KT POS" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#07101d" />
</svelte:head>

{#if shouldBlockTenantContent(page.url.pathname)}
  <div class="fixed inset-0 z-[1000] bg-[#070a0f] flex items-center justify-center p-6 overflow-hidden font-sans">
    <!-- Animated Background Elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
       <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/20 blur-[120px] rounded-full animate-pulse"></div>
       <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>
       <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
    </div>

    <div class="w-full max-w-xl relative animate-in fade-in zoom-in duration-700">
      <!-- Glow Effect -->
      <div class="absolute inset-0 bg-emerald-500/5 blur-[80px] rounded-full"></div>

      <div class="relative bg-[#111823]/80 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden">
        <!-- Top Status Bar -->
        <div class="bg-black/40 border-b border-white/5 px-8 py-3 flex justify-between items-center">
            <div class="flex gap-1.5">
                <div class="w-2.5 h-2.5 rounded-full bg-rose-500/20 border border-rose-500/40"></div>
                <div class="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40"></div>
                <div class="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40"></div>
            </div>
            <div class="text-[9px] font-black tracking-[0.3em] text-white/20 uppercase">
                Secure Environment // Machine: {auth.hardwareId.slice(0, 12)}
            </div>
        </div>

        <div class="p-10 md:p-14">
          <header class="mb-12">
            <div class="inline-flex items-center gap-3 mb-6">
                <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <div class="h-8 w-px bg-white/10 mx-1"></div>
                <h2 class="text-2xl font-black text-white italic tracking-tighter uppercase">
                    KT <span class="text-emerald-500">POS</span>
                </h2>
            </div>
            
            <h1 class="text-4xl font-black text-white leading-tight tracking-tight mb-4 uppercase italic">
                System <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">Locked</span>
            </h1>
            <p class="text-white/40 text-sm leading-relaxed max-w-sm uppercase font-bold tracking-wide italic">
                This workstation requires a valid activation token to join the KT Global Retail Network.
            </p>
          </header>

          <div class="space-y-8">
            <div class="group">
                <div class="flex justify-between items-center mb-3">
                    <label for="terminal-code" class="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 group-focus-within:text-emerald-400 transition-colors">Activation Token</label>
                    <a href="/auth/register" class="text-[9px] font-black text-emerald-500/60 hover:text-emerald-400 transition-all uppercase tracking-widest bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/10">Request Access →</a>
                </div>
                
                <div class="relative">
                    <textarea 
                        id="terminal-code"
                        bind:value={activationCode}
                        placeholder="PASTE YOUR SECURE CODE HERE..."
                        rows="4"
                        class="w-full bg-black/60 border border-white/5 p-6 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/30 focus:bg-black/80 transition-all rounded-xl resize-none uppercase shadow-2xl tracking-tighter leading-relaxed"
                    ></textarea>
                    
                    <div class="absolute bottom-4 right-4 flex items-center gap-2 opacity-30">
                        <kbd class="px-1.5 py-0.5 bg-white/10 border border-white/10 rounded text-[8px] text-white font-mono">CTRL</kbd>
                        <span class="text-[10px] text-white font-mono">+</span>
                        <kbd class="px-1.5 py-0.5 bg-white/10 border border-white/10 rounded text-[8px] text-white font-mono">V</kbd>
                    </div>
                </div>

                {#if error}
                  <div class="mt-4 flex items-center gap-3 text-[10px] font-black text-rose-400 bg-rose-500/5 p-4 rounded-xl border border-rose-500/10 animate-in slide-in-from-top-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                    {error}
                  </div>
                {/if}
            </div>

            <button 
              onclick={handleDirectActivation}
              disabled={isActivating || !activationCode.trim()}
              class="group relative w-full h-16 bg-white text-black text-[12px] font-black uppercase tracking-[0.2em] rounded-xl transition-all overflow-hidden disabled:opacity-20 active:scale-[0.97]"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span class="relative z-10 flex items-center justify-center gap-3 group-hover:text-white transition-colors">
                {#if isActivating}
                  <div class="w-5 h-5 border-3 border-black/10 border-t-black rounded-full animate-spin"></div>
                  Initializing Network Sync...
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Finalize Activation
                {/if}
              </span>
            </button>
          </div>

          <footer class="mt-12 flex flex-col sm:flex-row justify-between items-center gap-6 border-t border-white/5 pt-10">
              <div class="flex items-center gap-4">
                  <div class="text-right">
                      <p class="text-[8px] font-black text-white/20 uppercase tracking-widest">Operator Portal</p>
                      <a href="/auth/login" class="text-[10px] font-bold text-white/50 hover:text-emerald-400 transition-colors uppercase">Legacy Login</a>
                  </div>
                  <div class="w-px h-6 bg-white/10"></div>
                  <div class="text-left">
                      <p class="text-[8px] font-black text-white/20 uppercase tracking-widest">Version</p>
                      <p class="text-[10px] font-bold text-white/40 uppercase">v5.0.1 Stable</p>
                  </div>
              </div>
              
              <div class="px-4 py-2 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
                  <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span class="text-[9px] font-black text-white/30 uppercase tracking-widest">Network Online</span>
              </div>
          </footer>
        </div>
      </div>
    </div>
  </div>
{:else}
  {@render children()}
{/if}

<PwaInstallPrompt />

<style lang="postcss">
    @reference "tailwindcss";
  .tenant-guard {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .tenant-guard__halo {
    position: absolute;
    width: clamp(16rem, 34vw, 28rem);
    height: clamp(16rem, 34vw, 28rem);
    border-radius: 999px;
    background: radial-gradient(circle, var(--accent-soft) 0%, transparent 72%);
    filter: blur(14px);
    opacity: 0.9;
  }

  .tenant-guard__card {
    width: min(100%, 36rem);
    padding: clamp(1.8rem, 4vw, 2.4rem);
    text-align: left;
  }

  .tenant-guard__title {
    margin-top: 0.9rem;
    font-size: clamp(2rem, 5vw, 3.2rem);
    line-height: 0.98;
    font-weight: 800;
    letter-spacing: -0.06em;
  }

  .tenant-guard__copy {
    margin-top: 1rem;
    color: var(--text-secondary);
    line-height: 1.8;
  }
</style>
