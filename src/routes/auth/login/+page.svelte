<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';

  let email = $state('');
  let activationCode = $state('');
  let mode = $state<'email' | 'code'>('email');
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  onMount(async () => {
    await auth.initialize();
    email = auth.activation.email;
  });

  async function handleAction() {
    errorMessage = '';
    successMessage = '';
    
    if (mode === 'email') {
      if (!email.trim()) {
        errorMessage = 'Email address is required to proceed.';
        return;
      }
      isSubmitting = true;
      try {
        await auth.loginTenant({ email });
        successMessage = 'Access granted. Authenticating session...';
        const redirectTarget = page.url.searchParams.get('redirect') || '/pos/dashboard';
        await goto(redirectTarget, { invalidateAll: true, replaceState: true });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Authentication failed.';
      } finally {
        isSubmitting = false;
      }
    } else {
      if (!activationCode.trim()) {
        errorMessage = 'Please enter your activation code.';
        return;
      }
      isSubmitting = true;
      try {
        await auth.activateWithToken(activationCode);
        successMessage = 'Code validated successfully. System activated.';
        const redirectTarget = page.url.searchParams.get('redirect') || '/pos/dashboard';
        await goto(redirectTarget, { invalidateAll: true, replaceState: true });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Invalid or expired activation code.';
      } finally {
        isSubmitting = false;
      }
    }
  }
</script>

<svelte:head>
  <title>System Authentication | KT POS Business Suite</title>
</svelte:head>

<div class="min-h-screen bg-[#222d32] flex items-center justify-center p-6 bg-texture font-sans">
  <div class="w-full max-w-md bg-white border-t-8 border-[#1a8c5f] shadow-2xl relative overflow-hidden">
    <!-- Decorative top bar -->
    <div class="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50"></div>

    <div class="p-10 relative z-10">
      <div class="mb-8 text-center">
         <div class="inline-flex items-center justify-center w-14 h-14 bg-[#222d32] text-white text-2xl font-black mb-4 shadow-lg rounded-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>
         </div>
         <h1 class="text-2xl font-black text-[#222d32] uppercase tracking-tighter leading-none">KT <span class="text-[#1a8c5f]">POS</span></h1>
         <p class="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-3 opacity-70">Enterprise Business Management</p>
      </div>

      <!-- Mode Toggle -->
      <div class="flex border-b border-gray-100 mb-8">
        <button 
          onclick={() => mode = 'email'}
          class="flex-1 pb-3 text-[10px] uppercase font-black tracking-tighter transition-all {mode === 'email' ? 'text-[#1a8c5f] border-b-2 border-[#1a8c5f]' : 'text-slate-400 hover:text-slate-600'}"
        >
          Email Access
        </button>
        <button 
          onclick={() => mode = 'code'}
          class="flex-1 pb-3 text-[10px] uppercase font-black tracking-tighter transition-all {mode === 'code' ? 'text-[#1a8c5f] border-b-2 border-[#1a8c5f]' : 'text-slate-400 hover:text-slate-600'}"
        >
          Activation Code
        </button>
      </div>

      <form onsubmit={(e) => { e.preventDefault(); void handleAction(); }} class="space-y-6">
        {#if mode === 'email'}
          <div class="space-y-2">
            <label for="email" class="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Business Email Address</label>
            <div class="relative">
              <input 
                id="email"
                type="email" 
                bind:value={email} 
                autocomplete="email" 
                placeholder="e.g. owner@ketpos.com"
                class="w-full bg-[#f9fafb] border border-gray-200 p-4 text-xs font-black focus:outline-none focus:border-[#1a8c5f] focus:bg-white transition-all rounded-sm"
                required 
              />
              <div class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </div>
            </div>
          </div>
        {:else}
          <div class="space-y-2">
            <label for="authcode" class="block text-[10px] font-black uppercase text-slate-400 tracking-wider">System Activation Code</label>
            <div class="relative">
              <textarea 
                id="authcode"
                bind:value={activationCode} 
                placeholder="Paste your auth code here..."
                rows="3"
                class="w-full bg-[#f9fafb] border border-gray-200 p-4 text-[10px] font-mono font-bold focus:outline-none focus:border-[#1a8c5f] focus:bg-white transition-all rounded-sm resize-none uppercase"
                required 
              ></textarea>
            </div>
            <p class="text-[9px] text-slate-400 italic">Enter the token received during registration to activate this machine.</p>
          </div>
        {/if}

        {#if errorMessage}
          <div class="bg-rose-50 text-rose-500 text-[10px] font-black p-4 border-l-4 border-rose-500 uppercase flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {errorMessage}
          </div>
        {/if}

        {#if successMessage}
          <div class="bg-emerald-50 text-[#1a8c5f] text-[10px] font-black p-4 border-l-4 border-[#1a8c5f] uppercase flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            {successMessage}
          </div>
        {/if}

        <button 
          type="submit" 
          disabled={isSubmitting} 
          class="w-full bg-[#1a8c5f] text-white py-4 text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:bg-[#15734d] active:scale-[0.98] transition-all disabled:opacity-50 rounded-sm"
        >
          {isSubmitting ? 'Verifying...' : mode === 'email' ? 'Confirm Identity' : 'Activate System'}
        </button>

        <div class="pt-6 border-t border-gray-100 flex flex-col items-center gap-4">
           <a href="/auth/register" class="text-[10px] font-black uppercase text-slate-400 hover:text-[#1a8c5f] transition-colors tracking-tight">Deploy Machine to Global Network</a>
        </div>
      </form>
    </div>
    
    <div class="bg-gray-50 p-4 text-center border-t border-gray-100">
       <p class="text-[9px] font-bold text-slate-300 uppercase tracking-widest">KT POS Node v1.0.2 / Secure Environment</p>
    </div>
  </div>
</div>

<style lang="postcss">
    @reference "tailwindcss";
  .bg-texture {
    background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0);
    background-size: 32px 32px;
  }
</style>
