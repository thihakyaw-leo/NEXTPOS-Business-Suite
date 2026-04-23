<svelte:options runes={false} />

<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { isWeb } from '$lib/platform';

  interface DeferredInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
      outcome: 'accepted' | 'dismissed';
      platform: string;
    }>;
  }

  type NavigatorWithStandalone = Navigator & {
    standalone?: boolean;
  };

  const DISMISS_KEY = 'nextpos-pwa-install-dismissed-at';
  const DISMISS_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;

  let deferredPrompt: DeferredInstallPromptEvent | null = null;
  let visible = false;
  let installing = false;

  function isStandaloneMode(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as NavigatorWithStandalone).standalone)
    );
  }

  function dismissedRecently(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    const rawValue = localStorage.getItem(DISMISS_KEY);
    const dismissedAt = rawValue ? Number(rawValue) : 0;

    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_WINDOW_MS;
  }

  function syncVisibility(): void {
    visible = Boolean(deferredPrompt) && !dismissedRecently() && !isStandaloneMode();
  }

  function dismissPrompt(): void {
    visible = false;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  }

  async function installApp(): Promise<void> {
    if (!deferredPrompt || installing) {
      return;
    }

    installing = true;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;

    try {
      await promptEvent.prompt();
      const result = await promptEvent.userChoice;

      if (result.outcome === 'accepted') {
        visible = false;

        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(DISMISS_KEY);
        }
      } else {
        dismissPrompt();
      }
    } catch {
      deferredPrompt = promptEvent;
      syncVisibility();
    } finally {
      installing = false;
    }
  }

  onMount(() => {
    if (!isWeb() || typeof window === 'undefined') {
      return;
    }

    const displayModeQuery = window.matchMedia('(display-mode: standalone)');

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as DeferredInstallPromptEvent;
      promptEvent.preventDefault();
      deferredPrompt = promptEvent;
      syncVisibility();
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      visible = false;

      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(DISMISS_KEY);
      }
    };

    const handleDisplayModeChange = () => {
      if (isStandaloneMode()) {
        deferredPrompt = null;
        visible = false;
      } else {
        syncVisibility();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    displayModeQuery.addEventListener('change', handleDisplayModeChange);

    syncVisibility();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);

      displayModeQuery.removeEventListener('change', handleDisplayModeChange);
    };
  });
</script>

{#if visible && deferredPrompt}
  <section
    class="pointer-events-none fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-md"
    transition:fly={{ y: 28, duration: 220 }}
  >
    <div class="panel-surface pointer-events-auto overflow-hidden border border-teal-300/15 bg-slate-950/88 p-4 shadow-[0_30px_90px_-48px_rgba(45,212,191,0.9)]">
      <div class="flex items-start gap-4">
        <img
          alt="NextPOS app icon"
          class="h-14 w-14 rounded-[1.1rem] border border-white/10"
          height="56"
          src="/pwa/icon-192.png"
          width="56"
        />

        <div class="min-w-0 flex-1">
          <p class="text-xs uppercase tracking-[0.28em] text-teal-200/80">Install App</p>
          <h3 class="mt-2 text-lg font-semibold text-white">Install NextPOS</h3>
          <p class="mt-2 text-sm text-slate-300">
            Launch checkout faster from the home screen with offline-ready assets and a full-screen app shell.
          </p>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          class="touch-button rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.1]"
          onclick={dismissPrompt}
        >
          Not Now
        </button>
        <button
          class="touch-button rounded-2xl bg-teal-400 px-5 text-slate-950 shadow-[0_24px_50px_-24px_rgba(45,212,191,0.95)] hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={installing}
          onclick={() => void installApp()}
        >
          {installing ? 'Opening Prompt...' : 'Install App'}
        </button>
      </div>
    </div>
  </section>
{/if}
