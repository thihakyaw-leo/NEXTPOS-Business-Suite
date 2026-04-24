<script lang="ts">
  import { warehouseStore, type WarehouseRecord } from '$lib/stores/warehouseStore.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { fade, scale, slide } from 'svelte/transition';

  let showModal = $state(false);
  let showTransferModal = $state(false);
  
  let editingId = $state<string | null>(null);
  let formData = $state({
    name: '',
    code: '',
    address: '',
    manager: '',
    phone: '',
    isActive: true
  });

  function openCreate() {
    editingId = null;
    formData = { name: '', code: '', address: '', manager: '', phone: '', isActive: true };
    showModal = true;
  }

  function openEdit(wh: WarehouseRecord) {
    editingId = wh.id;
    formData = { 
      name: wh.name, 
      code: wh.code, 
      address: wh.address, 
      manager: wh.manager, 
      phone: wh.phone, 
      isActive: wh.isActive 
    };
    showModal = true;
  }

  function handleSave() {
    if (!formData.name.trim() || !formData.code.trim()) {
      ui.error('Name and Code are required');
      return;
    }
    if (editingId) {
      warehouseStore.update(editingId, { ...formData });
      ui.success('Warehouse updated');
    } else {
      warehouseStore.add({ ...formData });
      ui.success('New warehouse created');
    }
    showModal = false;
  }

  function confirmDelete(id: string) {
    if (confirm('Delete this warehouse? This action cannot be undone.')) {
      warehouseStore.remove(id);
      ui.success('Warehouse removed');
    }
  }

  let transferData = $state({
    warehouseId: '',
    itemCode: '',
    quantity: 1,
    direction: 'TO_WAREHOUSE' as 'TO_POS' | 'TO_WAREHOUSE'
  });

  function openTransfer() {
    transferData = {
      warehouseId: warehouseStore.active[0]?.id || '',
      itemCode: products.all[0]?.itemCode || '',
      quantity: 1,
      direction: 'TO_WAREHOUSE'
    };
    showTransferModal = true;
  }

  function handleTransfer() {
    if (!transferData.warehouseId || !transferData.itemCode || transferData.quantity <= 0) {
       ui.error('Invalid transfer parameters');
       return;
    }
    try {
       warehouseStore.transferStock(transferData.warehouseId, transferData.itemCode, transferData.quantity, transferData.direction);
       ui.success('Stock transfer executed successfully');
       showTransferModal = false;
    } catch (e) {
       ui.error(e instanceof Error ? e.message : 'Transfer failed due to stock mismatch');
    }
  }
</script>

<svelte:head>
  <title>Warehouse Intelligence | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- Intelligent Header -->
  <header class="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>
    
    <div class="space-y-1 relative">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">Logistics Hub_Active</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Warehouse <span class="text-emerald-500">Intelligence</span>
      </h1>
      <p class="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] italic mt-2">Active storage locations and inventory distribution nodes</p>
    </div>

    <div class="flex gap-4 relative">
       <button 
            type="button" 
            class="glass-button secondary px-8 py-4 text-[10px] font-black italic tracking-widest flex items-center gap-3 group active:scale-95" 
            onclick={openTransfer}
            disabled={warehouseStore.active.length === 0}
        >
         <span>📦</span> EXECUTE_TRANSFER
       </button>
       <button 
            type="button" 
            class="glass-button primary px-10 py-4 text-[10px] font-black italic tracking-widest shadow-[0_0_40px_rgba(34,197,94,0.15)] flex items-center gap-3 group active:scale-95" 
            onclick={openCreate}
        >
         <span class="text-lg group-hover:rotate-180 transition-transform duration-500">+</span> REGISTER_STORAGE_UNIT
       </button>
    </div>
  </header>

  <!-- Capacity Telemetry -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
    <div class="glass-panel p-8 border-t-2 border-emerald-500/30">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Total_Nodes_Online</p>
       <div class="flex items-baseline gap-3">
         <p class="text-4xl font-black text-white italic tabular-nums">{warehouseStore.all.length}</p>
         <span class="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Active_Clusters</span>
       </div>
    </div>
    
    <div class="glass-panel p-8 border-t-2 border-amber-500/30">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Operational_Pressure</p>
       <div class="flex items-center gap-4">
         <p class="text-4xl font-black text-amber-500 italic uppercase">Optimal</p>
         <div class="flex gap-1">
            {#each Array(5) as _, i}
              <div class="w-1 h-6 {i < 4 ? 'bg-amber-500' : 'bg-white/10'} rounded-full"></div>
            {/each}
         </div>
       </div>
    </div>

    <div class="glass-panel p-8 border-t-2 border-zinc-700">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Aggregate_Saturation</p>
       <div class="flex items-baseline gap-3">
         <p class="text-4xl font-black text-white italic tabular-nums">64%</p>
         <div class="flex-1 h-2 bg-white/5 rounded-full overflow-hidden self-center">
            <div class="h-full bg-emerald-500 shadow-[0_0_10px_#22c55e]" style="width: 64%"></div>
         </div>
       </div>
    </div>
  </div>

  <!-- Storage Node Grid -->
  <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
    {#each warehouseStore.all as wh (wh.id)}
       <div class="glass-panel flex flex-col group hover:border-emerald-500/30 transition-all duration-500 overflow-hidden" in:scale={{ duration: 400 }}>
          <div class="p-8 flex-1 flex gap-8">
             <div class="w-24 h-24 glass-panel bg-white/5 border-none flex items-center justify-center text-4xl shrink-0 group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all duration-500">
                🏛️
             </div>
             <div class="flex-1">
                <div class="flex justify-between items-start">
                   <div class="space-y-1">
                      <h3 class="text-xl font-black text-white uppercase italic tracking-tighter group-hover:text-emerald-400 transition-colors">{wh.name}</h3>
                      <p class="text-[9px] font-black uppercase text-white/20 tracking-[0.3em] italic">{wh.id}</p>
                   </div>
                   <span class="px-4 py-1.5 glass-panel bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase italic border-emerald-500/30">NODE_{wh.code}</span>
                </div>
                <p class="text-[11px] text-white/40 mt-4 font-black leading-relaxed italic border-l-2 border-emerald-500/20 pl-4">{wh.address}</p>
                
                <div class="mt-8 grid grid-cols-2 gap-8">
                   <div class="space-y-1">
                      <p class="text-[8px] font-black uppercase text-white/20 tracking-widest italic">Node_Manager</p>
                      <p class="text-[11px] font-black text-white italic uppercase">{wh.manager}</p>
                   </div>
                   <div class="space-y-1">
                      <p class="text-[8px] font-black uppercase text-white/20 tracking-widest italic">Comm_Channel</p>
                      <p class="text-[11px] font-black text-white italic uppercase">{wh.phone}</p>
                   </div>
                </div>
             </div>
          </div>
          <div class="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end gap-6">
             <button onclick={() => confirmDelete(wh.id)} class="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-rose-500 transition-colors italic">DECOMMISSION_NODE</button>
             <button onclick={() => openEdit(wh)} class="glass-button secondary px-8 py-2.5 text-[9px] font-black italic">CONFIGURE_MATRIX</button>
          </div>
       </div>
    {/each}

    {#if warehouseStore.all.length === 0}
      <div class="col-span-full py-40 glass-panel border-dashed flex flex-col items-center justify-center opacity-10">
          <div class="w-20 h-20 mb-6 border-2 border-white/10 rounded-full flex items-center justify-center text-3xl">🏛️</div>
          <p class="text-sm font-black uppercase tracking-[0.5em] italic">No logistics hubs detected in local cluster</p>
      </div>
    {/if}
  </div>
</div>

<!-- Immersive Registration Portal -->
{#if showModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl" in:fade>
    <div class="glass-panel w-full max-w-xl border-t-4 border-emerald-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] animate-in zoom-in duration-500">
      <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
        <div>
          <h2 class="text-2xl font-black uppercase italic tracking-tighter text-white">{editingId ? 'CONFIGURE_NODE' : 'REGISTER_LOGISTICS_HUB'}</h2>
          <p class="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mt-1">Infrastructure verification protocol : v9.1</p>
        </div>
        <button type="button" class="h-10 w-10 glass-panel flex items-center justify-center text-white/20 hover:text-white hover:bg-rose-500/20 transition-all font-black text-lg" onclick={() => showModal = false}>✕</button>
      </div>
      
      <div class="p-10 space-y-8">
        <div class="grid grid-cols-2 gap-8">
           <div class="space-y-3">
             <label for="wh-name" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Asset_Name</label>
             <input id="wh-name" type="text" placeholder="MAIN_HUB_ALPHA" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.2em] transition-all" bind:value={formData.name} />
           </div>
           <div class="space-y-3">
             <label for="wh-code" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Node_Tag</label>
             <input id="wh-code" type="text" placeholder="WH-000" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.2em] transition-all" bind:value={formData.code} />
           </div>
        </div>

        <div class="space-y-3">
          <label for="wh-address" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Geographic_Signature (Address)</label>
          <textarea id="wh-address" placeholder="COORDINATES_AND_STREET_IDENTIFIER" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.1em] transition-all h-24" bind:value={formData.address}></textarea>
        </div>

        <div class="grid grid-cols-2 gap-8">
          <div class="space-y-3">
            <label for="wh-manager" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Vector_Manager</label>
            <input id="wh-manager" type="text" placeholder="UNASSIGN_USER_0x" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.2em] transition-all" bind:value={formData.manager} />
          </div>
          <div class="space-y-3">
            <label for="wh-phone" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Comm_Frequency (Phone)</label>
            <input id="wh-phone" type="text" placeholder="+95-00-00000" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.2em] transition-all" bind:value={formData.phone} />
          </div>
        </div>
      </div>

      <div class="p-8 bg-white/5 border-t border-white/5 flex justify-end gap-6">
        <button type="button" class="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-colors italic" onclick={() => showModal = false}>ABORT_SETUP</button>
        <button type="button" class="glass-button primary px-12 py-4 text-[10px] font-black italic shadow-2xl shadow-emerald-500/20" onclick={handleSave}>CONFIRM_INFRASTRUCTURE_DEPLOY</button>
      </div>
    </div>
  </div>
{/if}

<!-- Asset Transfer Portal -->
{#if showTransferModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl" in:fade>
    <div class="glass-panel w-full max-w-xl border-t-4 border-amber-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] animate-in zoom-in duration-500">
      <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
        <div>
          <h2 class="text-2xl font-black uppercase italic tracking-tighter text-white">ASSET_TRANSFER<span class="text-amber-500">_NEXUS</span></h2>
          <p class="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mt-1">Cross-node inventory synchronization</p>
        </div>
        <button type="button" class="h-10 w-10 glass-panel flex items-center justify-center text-white/20 hover:text-white hover:bg-rose-500/20 transition-all font-black text-lg" onclick={() => showTransferModal = false}>✕</button>
      </div>
      
      <div class="p-10 space-y-8">
        <div>
           <label for="tr-direction" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1 mb-3 block">Vector_Direction</label>
           <div class="flex gap-4">
              <button type="button" onclick={() => transferData.direction = 'TO_WAREHOUSE'} class="flex-1 glass-button py-4 text-[10px] font-black italic {transferData.direction === 'TO_WAREHOUSE' ? 'bg-amber-500 border-amber-500 text-zinc-950' : 'secondary'}">POS → WAREHOUSE</button>
              <button type="button" onclick={() => transferData.direction = 'TO_POS'} class="flex-1 glass-button py-4 text-[10px] font-black italic {transferData.direction === 'TO_POS' ? 'bg-emerald-500 border-emerald-500 text-white' : 'secondary'}">WAREHOUSE → POS</button>
           </div>
        </div>

        <div class="space-y-3">
          <label for="tr-wh" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Target_Node (Warehouse)</label>
          <select id="tr-wh" bind:value={transferData.warehouseId} class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-amber-500/50 outline-none uppercase italic tracking-[0.2em] transition-all appearance-none cursor-pointer">
            {#each warehouseStore.active as wh}
               <option value={wh.id}>{wh.name} [{wh.code}]</option>
            {/each}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-8">
           <div class="space-y-3">
             <label for="tr-item" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Asset_Class (Product)</label>
             <select id="tr-item" bind:value={transferData.itemCode} class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-amber-500/50 outline-none uppercase italic tracking-[0.2em] transition-all appearance-none cursor-pointer">
               {#each products.all as p}
                 <option value={p.itemCode}>{p.name} [{p.itemCode}]</option>
               {/each}
             </select>
           </div>
           <div class="space-y-3">
             <label for="tr-qty" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Payload_Volume (Qty)</label>
             <input id="tr-qty" type="number" min="1" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-amber-500/50 outline-none uppercase italic tracking-[0.2em] transition-all" bind:value={transferData.quantity} />
           </div>
        </div>
      </div>

      <div class="p-8 bg-white/5 border-t border-white/5 flex justify-end gap-6">
        <button type="button" class="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-colors italic" onclick={() => showTransferModal = false}>ABORT</button>
        <button type="button" class="glass-button px-12 py-4 text-[10px] font-black italic bg-amber-500 text-zinc-950 border-amber-500 hover:bg-amber-400 shadow-2xl shadow-amber-500/20" onclick={handleTransfer}>INITIATE_TRANSFER_PROTOCOL</button>
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
