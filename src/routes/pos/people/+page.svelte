<script lang="ts">
  import { purchaseStore } from '$lib/stores/purchaseStore.svelte';
  import { peopleStore } from '$lib/stores/peopleStore.svelte';
  import { sales } from '$lib/stores/sales.svelte';
  import { fade, slide, scale } from 'svelte/transition';

  let activeTab = $state<'customers' | 'suppliers'>('customers');
  let customers = $derived(peopleStore.allCustomers);
  let suppliers = $derived(purchaseStore.allSuppliers);

  let showModal = $state(false);
  let formType = $state<'customer' | 'supplier'>('customer');
  let formData = $state({ name: '', phone: '', address: '' });

  function openAddModal() {
    formType = activeTab === 'customers' ? 'customer' : 'supplier';
    formData = { name: '', phone: '', address: '' };
    showModal = true;
  }

  function handleSave() {
    if (!formData.name.trim() || !formData.phone.trim()) return;
    
    if (formType === 'customer') {
      peopleStore.addCustomer({ name: formData.name, phone: formData.phone });
    } else {
      purchaseStore.addSupplier({ name: formData.name, phone: formData.phone, address: formData.address });
    }
    showModal = false;
  }
</script>

<svelte:head>
  <title>Relationship Intelligence | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- Header Section -->
  <header class="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>

    <div class="space-y-1 relative max-w-4xl">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">Network_Nexus: ACTIVE</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Relationship <span class="text-emerald-500">Intelligence</span>
      </h1>
      <div class="mt-4">
         <p class="text-xs font-black text-white/40 uppercase tracking-widest italic leading-relaxed">
            Managing business relationships is crucial for business growth. 
            With RetailersPOS, you can access full profiles, track past transactions, and communicate better with both customers and suppliers.
         </p>
      </div>
      
      <!-- Selection Matrix -->
      <div class="flex gap-4 mt-8">
         <button 
            onclick={() => activeTab = 'customers'}
            class="px-8 py-3 glass-panel border-none text-[10px] font-black uppercase italic tracking-widest transition-all {activeTab === 'customers' ? 'bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20' : 'bg-white/5 text-white/20 hover:text-white'}"
         >
            Customer Records
         </button>
         <button 
            onclick={() => activeTab = 'suppliers'}
            class="px-8 py-3 glass-panel border-none text-[10px] font-black uppercase italic tracking-widest transition-all {activeTab === 'suppliers' ? 'bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20' : 'bg-white/5 text-white/20 hover:text-white'}"
         >
            Supplier Records
         </button>
      </div>
    </div>
    
    <div class="flex gap-4 relative">
       <button type="button" aria-label="Initialize Entry" onclick={openAddModal} class="glass-button primary px-10 py-4 text-[10px] font-black italic tracking-widest shadow-[0_0_40px_rgba(34,197,94,0.15)] flex items-center gap-3 group active:scale-95">
         <span class="text-lg group-hover:rotate-90 transition-transform duration-500">+</span> INITIALIZE_ENTRY
       </button>
    </div>
  </header>

  <!-- Data Mesh -->
  <div class="glass-panel overflow-hidden border-t-2 border-zinc-800">
    <div class="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
      <div>
        <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">{activeTab === 'customers' ? 'Client_Registry' : 'Vendor_Network'}</h3>
        <p class="text-[9px] text-white/20 mt-1 font-black uppercase tracking-widest italic font-bold">Synchronized relationship database : v2.4</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-4 py-2 glass-panel bg-white/5 text-[10px] font-black text-emerald-500 italic uppercase tracking-widest">
            {activeTab === 'customers' ? customers.length : suppliers.length} ENTITIES_DETECTED
        </span>
      </div>
    </div>
    
    <div class="overflow-x-auto min-h-[500px]">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-zinc-900/50 text-white/20 text-[9px] uppercase font-black tracking-[0.3em] italic">
            <th class="p-6 border-b border-white/5 px-10">Identifier</th>
            <th class="p-6 border-b border-white/5">Personal_Alias</th>
            <th class="p-6 border-b border-white/5">Comm_Protocol</th>
            <th class="p-6 border-b border-white/5 text-right">{activeTab === 'customers' ? 'Aggregate_Value' : 'Active_Contracts'}</th>
            <th class="p-6 border-b border-white/5 text-right px-10">Interface</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          {#if activeTab === 'customers'}
            {#each customers as customer}
              <tr class="hover:bg-emerald-500/[0.03] transition-all group">
                <td class="p-6 px-10 font-mono text-[10px] text-white/20">{customer.id}</td>
                <td class="p-6">
                   <span class="text-xs font-black text-white uppercase italic group-hover:text-emerald-400 transition-colors">{customer.name}</span>
                </td>
                <td class="p-6">
                   <span class="text-[10px] font-black text-white/40 uppercase tracking-widest italic">{customer.phone}</span>
                </td>
                <td class="p-6 text-right">
                   <span class="text-xs font-black text-emerald-500 italic tabular-nums">Ks {customer.totalSpent.toLocaleString()}</span>
                </td>
                <td class="p-6 text-right px-10">
                   <button class="glass-button secondary p-2 px-4 text-[9px] group-hover:border-emerald-500/30">VIEW_LOGS</button>
                </td>
              </tr>
            {/each}
          {:else}
            {#each suppliers as supplier}
              <tr class="hover:bg-emerald-500/[0.03] transition-all group">
                <td class="p-6 px-10 font-mono text-[10px] text-white/20">{supplier.id}</td>
                <td class="p-6">
                   <span class="text-xs font-black text-white uppercase italic group-hover:text-emerald-400 transition-colors">{supplier.name}</span>
                </td>
                <td class="p-6">
                   <span class="text-[10px] font-black text-white/40 uppercase tracking-widest italic">SECURE_LINK</span>
                </td>
                <td class="p-6 text-right">
                   <span class="text-xs font-black text-emerald-500 uppercase tracking-widest italic">Active_Vendor</span>
                </td>
                <td class="p-6 text-right px-10">
                   <button class="glass-button secondary p-2 px-4 text-[9px] group-hover:border-emerald-500/30">AUDIT_NEXUS</button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

{#if showModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10 bg-zinc-950/90 backdrop-blur-xl" in:fade>
    <div class="w-full max-w-lg glass-panel relative" in:scale={{ duration: 300, start: 0.95 }}>
      <!-- Header -->
      <div class="p-6 border-b border-white/5 flex items-center justify-between">
        <h2 class="text-xl font-black italic tracking-tighter uppercase text-white">
          New <span class="text-emerald-500">{formType === 'customer' ? 'Customer' : 'Supplier'}</span>
        </h2>
        <button type="button" class="text-white/30 hover:text-white transition-colors" aria-label="Close" onclick={() => showModal = false}>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- Form Body -->
      <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="p-6 space-y-6">
        <div>
          <label for="name" class="block text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-3 italic">Entity Name / ALIAS</label>
          <input
            id="name"
            type="text"
            required
            bind:value={formData.name}
            class="w-full bg-zinc-900 border border-white/5 px-6 py-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none transition-all italic tracking-widest placeholder:text-white/10"
            placeholder="e.g. Acme Corporation"
          />
        </div>
        
        <div>
          <label for="phone" class="block text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-3 italic">Comm Protocol (Phone)</label>
          <input
            id="phone"
            type="text"
            required
            bind:value={formData.phone}
            class="w-full bg-zinc-900 border border-white/5 px-6 py-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none transition-all italic tracking-widest placeholder:text-white/10"
            placeholder="e.g. 09-123456789"
          />
        </div>

        {#if formType === 'supplier'}
          <div>
            <label for="address" class="block text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-3 italic">Physical Vector (Address)</label>
            <input
              id="address"
              type="text"
              bind:value={formData.address}
              class="w-full bg-zinc-900 border border-white/5 px-6 py-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none transition-all italic tracking-widest placeholder:text-white/10"
              placeholder="e.g. 123 Industrial Park"
            />
          </div>
        {/if}

        <div class="flex gap-4 pt-4">
          <button type="button" class="glass-button secondary flex-1 py-4 text-[10px] font-black" onclick={() => showModal = false}>ABORT</button>
          <button type="submit" class="glass-button primary flex-1 py-4 text-[10px] font-black shadow-[0_0_30px_rgba(34,197,94,0.2)]">EXECUTE_SAVE</button>
        </div>
      </form>
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
