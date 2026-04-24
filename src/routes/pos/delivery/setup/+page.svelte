<script lang="ts">
  import { deliveryStore, type DeliveryProviderRecord } from '$lib/stores/deliveryStore.svelte';
  import { formatMMK } from '$lib/types/index';
  import { ui } from '$lib/stores/ui.svelte';
  import { fade, scale, slide } from 'svelte/transition';

  let showModal = $state(false);
  let editingId = $state<string | null>(null);
  let formData = $state({
    name: '',
    contact: '' as string | undefined,
    baseFee: 1500,
    isActive: true
  });

  function openCreate() {
    editingId = null;
    formData = { name: '', contact: '', baseFee: 1500, isActive: true };
    showModal = true;
  }

  function openEdit(provider: DeliveryProviderRecord) {
    editingId = provider.id;
    formData = { 
      name: provider.name, 
      contact: provider.contact, 
      baseFee: provider.baseFee, 
      isActive: provider.isActive 
    };
    showModal = true;
  }

  function handleSave() {
    if (!formData.name.trim()) {
      ui.error('Provider name is required');
      return;
    }
    if (editingId) {
      deliveryStore.update(editingId, { ...formData });
      ui.success('Provider updated');
    } else {
      deliveryStore.add({ ...formData });
      ui.success('Provider added');
    }
    showModal = false;
  }

  function confirmDelete(id: string) {
    if (confirm('Are you sure you want to delete this provider?')) {
      deliveryStore.remove(id);
      ui.success('Provider removed');
    }
  }
</script>

<svelte:head>
  <title>Logistics Network | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- Logistics Header -->
  <header class="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>

    <div class="space-y-1 relative max-w-3xl">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">Distribution_Matrix: OPERATIONAL</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Delivery <span class="text-emerald-500">Management</span>
      </h1>
      <div class="mt-4">
         <p class="text-xs font-black text-white/40 uppercase tracking-widest italic leading-relaxed">
            Get your orders out faster with advanced delivery management of RetailersPOS. 
            Track every order in real time, manage shipping, and deliver a seamless experience your customers can count on.
         </p>
      </div>
      
      <!-- Rapid Access Nodes -->
      <div class="flex flex-wrap gap-4 mt-6">
         {#each ['Dynamic Filtering', 'Delivery Overview', 'Shipment Tracking', 'Partner Management'] as node}
            <span class="px-4 py-1.5 glass-panel border-none bg-white/5 text-[8px] font-black uppercase italic tracking-widest text-white/40 group hover:text-emerald-500 transition-colors cursor-default">
               <span class="text-emerald-500 mr-2">/</span> {node}
            </span>
         {/each}
      </div>
    </div>
    
    <div class="flex gap-4 relative">
       <button type="button" class="glass-button primary px-10 py-4 text-[10px] font-black italic tracking-widest shadow-[0_0_40px_rgba(34,197,94,0.15)] flex items-center gap-3 group active:scale-95" onclick={openCreate}>
         <span class="text-lg group-hover:rotate-180 transition-transform duration-500">+</span> INITIALIZE_NEW_PARTNER
       </button>
    </div>
  </header>

  <!-- Network Stats -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
    <div class="glass-panel p-8 border-t-2 border-emerald-500/30">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Active_Carriers</p>
       <p class="text-4xl font-black text-white italic tabular-nums">{deliveryStore.all.filter(p => p.isActive).length}</p>
    </div>
    <div class="glass-panel p-8 border-t-2 border-zinc-700">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Total_Nodes</p>
       <p class="text-4xl font-black text-white italic tabular-nums">{deliveryStore.all.length}</p>
    </div>
    <div class="glass-panel p-8 border-t-2 border-zinc-700">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Avg_Payload_Cost</p>
       <p class="text-4xl font-black text-white italic tabular-nums">Ks 2,400</p>
    </div>
    <div class="glass-panel p-8 border-t-2 border-zinc-700">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Network_Health</p>
       <p class="text-4xl font-black text-emerald-500 italic uppercase">Stable</p>
    </div>
  </div>

  <!-- Carrier Matrix -->
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
    {#each deliveryStore.all as provider (provider.id)}
       <div class="glass-panel flex flex-col group hover:border-emerald-500/30 transition-all duration-500 overflow-hidden" in:scale={{ duration: 400 }}>
          <div class="p-8 flex-1">
             <div class="flex justify-between items-start mb-8">
                <div class="w-16 h-16 glass-panel border-none bg-white/5 flex items-center justify-center text-3xl group-hover:bg-emerald-500/10 group-hover:scale-110 transition-all duration-500">
                    🚛
                </div>
                <div class="flex flex-col items-end gap-2">
                   <span class="px-3 py-1 glass-panel border-none text-[8px] font-black uppercase italic {provider.isActive ? 'text-emerald-500 bg-emerald-500/10' : 'text-white/20 bg-white/5'}">
                      {provider.isActive ? 'SYSTEM_ONLINE' : 'DEACTIVATED'}
                   </span>
                   <p class="text-[8px] font-black text-white/10 uppercase tracking-widest italic">{provider.id}</p>
                </div>
             </div>

             <div class="space-y-1 mb-8">
                <h3 class="text-xl font-black text-white uppercase italic tracking-tighter group-hover:text-emerald-400 transition-colors">{provider.name}</h3>
                <p class="text-[11px] text-white/40 font-black italic uppercase tracking-widest">{provider.contact || 'COMM_LINK_OFFLINE'}</p>
             </div>

             <div class="p-6 glass-panel border-white/5 bg-white/[0.02]">
                <p class="text-[8px] font-black text-white/20 uppercase tracking-widest mb-2 italic">Standard_Transit_Fee</p>
                <div class="text-2xl font-black text-white italic tabular-nums leading-none tracking-tighter">
                    {formatMMK(provider.baseFee)}
                </div>
             </div>
          </div>

          <div class="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end gap-6 items-center">
             <button onclick={() => confirmDelete(provider.id)} class="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-rose-500 transition-colors italic">TERMINATE_PARTNER</button>
             <button onclick={() => openEdit(provider)} class="glass-button secondary px-8 py-2.5 text-[9px] font-black italic">CONFIGURE_CARRIER</button>
          </div>
       </div>
    {:else}
       <div class="col-span-full py-40 glass-panel border-dashed flex flex-col items-center justify-center opacity-10">
          <div class="w-20 h-20 mb-6 border-2 border-white/10 rounded-full flex items-center justify-center text-3xl">🚛</div>
          <p class="text-sm font-black uppercase tracking-[0.5em] italic">No distribution vectors detected in local matrix</p>
       </div>
    {/each}
  </div>
</div>

<!-- Partner Configuration Portal -->
{#if showModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl" in:fade>
    <div class="glass-panel w-full max-w-lg border-t-4 border-emerald-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] animate-in zoom-in duration-500">
      <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
        <div>
          <h2 class="text-2xl font-black uppercase italic tracking-tighter text-white">{editingId ? 'CONFIGURE_VECTOR' : 'INITIALIZE_CARRIER'}</h2>
          <p class="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mt-1">Logistics protocol : s-tier v2.0</p>
        </div>
        <button type="button" class="h-10 w-10 glass-panel flex items-center justify-center text-white/20 hover:text-white hover:bg-rose-500/20 transition-all font-black text-lg" onclick={() => showModal = false}>✕</button>
      </div>
      
      <div class="p-10 space-y-8">
        <div class="space-y-3">
          <label for="p-name" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Carrier_Alias</label>
          <input id="p-name" type="text" placeholder="e.g. ALPHA_LOGISTICS_HUB" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.2em] transition-all" bind:value={formData.name} />
        </div>
        
        <div class="space-y-3">
          <label for="p-contact" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Primary_Comm_Link (Phone)</label>
          <input id="p-contact" type="text" placeholder="+95-00-000000" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.2em] transition-all" bind:value={formData.contact} />
        </div>
        
        <div class="space-y-3">
          <label for="p-fee" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Base_Transit_Payload (Ks)</label>
          <input id="p-fee" type="number" step="100" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-bold text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.2em] transition-all" bind:value={formData.baseFee} />
        </div>

        <label class="flex items-center gap-4 cursor-pointer group p-4 glass-panel border-white/5 bg-white/[0.02] hover:bg-emerald-500/5 transition-all">
          <div class="relative flex items-center justify-center">
            <input type="checkbox" bind:checked={formData.isActive} class="peer h-5 w-5 opacity-0 absolute" />
            <div class="h-5 w-5 border-2 border-white/10 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-all flex items-center justify-center">
                <span class="text-white text-[10px] font-black peer-checked:block hidden transition-all">✓</span>
            </div>
          </div>
          <span class="text-[10px] font-black uppercase text-white/30 group-hover:text-white transition-colors italic tracking-widest">Authorize_Operational_Status</span>
        </label>
      </div>

      <div class="p-8 bg-white/5 border-t border-white/5 flex justify-end gap-6">
        <button type="button" class="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-colors italic" onclick={() => showModal = false}>ABORT_PROCEDURE</button>
        <button type="button" class="glass-button primary px-12 py-4 text-[10px] font-black italic shadow-2xl shadow-emerald-500/20" onclick={handleSave}>DEPLOY_CARRIER_CONFIG</button>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
    @reference "tailwindcss";
    .glass-panel {
        @apply bg-[#111111]/80 backdrop-blur-xl border border-white/5 shadow-2xl;
    }

    .glass-button {
        @apply border rounded-sm uppercase tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed;
    }

    .glass-button.primary {
        @apply bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-400;
    }

    .glass-button.secondary {
        @apply bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20;
    }
</style>
