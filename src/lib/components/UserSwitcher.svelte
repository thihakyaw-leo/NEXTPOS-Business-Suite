<script lang="ts">
  import { rbac, ROLE_META } from '$lib/stores/rbacStore.svelte';
  import { scale, fade } from 'svelte/transition';

  let showSwitcher = $state(false);
  let selectedUserId = $state('');
  let pin = $state('');

  function selectUser(id: string) {
    selectedUserId = id;
    pin = '';
    rbac.clearPinError();
  }

  function handlePinKey(digit: string) {
    if (pin.length < 4) pin += digit;
  }

  function handleBackspace() {
    pin = pin.slice(0, -1);
    rbac.clearPinError();
  }

  function handleLogin() {
    if (pin.length === 4) {
      const ok = rbac.login(selectedUserId, pin);
      if (ok) {
        showSwitcher = false;
        selectedUserId = '';
        pin = '';
      }
    }
  }

  function handleLogout() {
    rbac.logout();
    showSwitcher = false;
    selectedUserId = '';
    pin = '';
  }

  $effect(() => {
    if (pin.length === 4 && selectedUserId) {
      handleLogin();
    }
  });
</script>

<!-- Trigger Button -->
<button
  type="button"
  onclick={() => { showSwitcher = !showSwitcher; selectedUserId = ''; pin = ''; }}
  class="flex items-center gap-2 px-3 py-2 glass-panel border-none hover:bg-white/10 transition-all group"
  aria-label="Switch user"
>
  <span class="text-base leading-none">{rbac.currentUser?.avatar ?? '👤'}</span>
  <div class="text-left">
    <p class="text-[9px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors leading-none">
      {rbac.currentUser?.name ?? 'Guest'}
    </p>
    {#if rbac.currentUser}
      <p class="text-[7px] font-black uppercase tracking-widest {ROLE_META[rbac.currentUser.role].color} mt-0.5">
        {ROLE_META[rbac.currentUser.role].label}
      </p>
    {/if}
  </div>
  <svg class="w-3 h-3 text-white/20 group-hover:text-white transition-colors ml-1 {showSwitcher ? 'rotate-180' : ''} transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
  </svg>
</button>

<!-- Switcher Panel -->
{#if showSwitcher}
  <div
    class="absolute top-full right-0 mt-2 w-80 glass-panel shadow-2xl z-[200] border-t-2 border-emerald-500/50 overflow-hidden"
    in:scale={{ duration: 200, start: 0.95 }}
    out:scale={{ duration: 150, start: 0.95 }}
  >
    {#if !selectedUserId}
      <!-- User Selection -->
      <div class="p-4 bg-white/5 border-b border-white/5">
        <p class="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 italic">Switch Operator</p>
      </div>
      <div class="p-2 space-y-1">
        {#each rbac.users as user}
          <button
            type="button"
            onclick={() => selectUser(user.id)}
            class="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all group rounded-sm text-left
              {rbac.currentUser?.id === user.id ? 'bg-emerald-500/10 border border-emerald-500/20' : ''}"
          >
            <span class="text-xl">{user.avatar ?? '👤'}</span>
            <div class="flex-1">
              <p class="text-xs font-black text-white uppercase italic">{user.name}</p>
              <p class="text-[8px] font-black uppercase tracking-widest {ROLE_META[user.role].color}">{ROLE_META[user.role].label}</p>
            </div>
            {#if rbac.currentUser?.id === user.id}
              <span class="text-[8px] font-black text-emerald-500 uppercase tracking-widest">ACTIVE</span>
            {/if}
            <svg class="w-3 h-3 text-white/20 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        {/each}
      </div>
      {#if rbac.currentUser}
        <div class="p-4 border-t border-white/5">
          <button type="button" onclick={handleLogout} class="w-full py-3 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 transition-all border border-rose-500/20 hover:border-rose-500/40">
            LOGOUT
          </button>
        </div>
      {/if}

    {:else}
      <!-- PIN Entry -->
      {@const selectedUser = rbac.users.find(u => u.id === selectedUserId)}
      <div class="p-4 bg-white/5 border-b border-white/5 flex items-center gap-3">
        <button type="button" onclick={() => { selectedUserId = ''; pin = ''; }} class="text-white/30 hover:text-white transition-colors" aria-label="Go back">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span class="text-lg">{selectedUser?.avatar}</span>
        <div>
          <p class="text-[9px] font-black uppercase tracking-widest text-white italic">{selectedUser?.name}</p>
          {#if selectedUser}
            <p class="text-[7px] font-black uppercase tracking-widest {ROLE_META[selectedUser.role].color}">{ROLE_META[selectedUser.role].label}</p>
          {/if}
        </div>
      </div>
      
      <div class="p-6">
        <!-- PIN Dots -->
        <div class="flex justify-center gap-3 mb-6">
          {#each [0,1,2,3] as i}
            <div class="w-3 h-3 rounded-full border-2 transition-all duration-200 {i < pin.length ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'border-white/20'}"></div>
          {/each}
        </div>

        {#if rbac.pinError}
          <p class="text-[9px] font-black text-rose-400 uppercase tracking-widest text-center mb-4 animate-pulse" in:fade>{rbac.pinError}</p>
        {/if}
        
        <!-- Numpad -->
        <div class="grid grid-cols-3 gap-2">
          {#each ['1','2','3','4','5','6','7','8','9','','0','⌫'] as key}
            {#if key === ''}
              <div></div>
            {:else if key === '⌫'}
              <button
                type="button"
                onclick={handleBackspace}
                class="aspect-square glass-panel border-none text-white/40 hover:text-white hover:bg-white/10 transition-all font-black text-lg"
                aria-label="Backspace"
              >{key}</button>
            {:else}
              <button
                type="button"
                onclick={() => handlePinKey(key)}
                class="aspect-square glass-panel border-none text-white hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all font-black text-lg"
              >{key}</button>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style lang="postcss">
    @reference "tailwindcss";
  .glass-panel {
    @apply bg-[#111111]/95 backdrop-blur-xl border border-white/5 shadow-2xl;
  }
</style>
