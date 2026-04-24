<script lang="ts">
  import { ecommerceStore, type EcommerceOrderStatus, type PaymentStatus } from '$lib/stores/ecommerceStore.svelte';
  import { formatMMK } from '$lib/types/index';
  import { ui } from '$lib/stores/ui.svelte';
  import { fade, scale, slide } from 'svelte/transition';

  let activeTab = $state('ALL');

  let filteredOrders = $derived(
    activeTab === 'ALL' 
      ? ecommerceStore.all 
      : ecommerceStore.all.filter(o => o.status === activeTab)
  );

  function getStatusStyle(status: EcommerceOrderStatus) {
    switch (status) {
      case 'PENDING': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'CONFIRMED': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'PROCESSING': return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
      case 'SHIPPED': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
      case 'DELIVERED': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'CANCELLED': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-white/20 bg-white/5 border-white/10';
    }
  }

  function getPaymentStyle(status: PaymentStatus) {
    switch (status) {
      case 'PAID': return 'text-emerald-500 font-black';
      case 'UNPAID': return 'text-rose-500 font-black';
      default: return 'text-white/20 font-bold';
    }
  }
</script>

<svelte:head>
  <title>eCommerce Intelligence | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- eCommerce Header -->
  <header class="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>
    
    <div class="space-y-1 relative">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">OmniChannel_Stream Active</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Inbound <span class="text-emerald-500">Logistics</span>
      </h1>
      <p class="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] italic mt-2">Harmonizing digital storefront transactions with local inventory</p>
    </div>

    <div class="flex gap-4 relative">
       <button type="button" class="glass-button secondary px-8 py-3 text-[9px] font-black italic">EXPORT_AUDIT_LOG</button>
       <button type="button" class="glass-button primary px-10 py-3 text-[9px] font-black italic shadow-[0_0_40px_rgba(34,197,94,0.15)] flex items-center gap-3 active:scale-95">
         SYNC_MASTER_DATA
       </button>
    </div>
  </header>

  <!-- Status Filters -->
  <div class="flex flex-wrap gap-3 p-1 relative z-10">
    {#each ['ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as tab}
      <button 
        onclick={() => activeTab = tab}
        class="px-8 py-3 glass-panel border-none text-[9px] font-black uppercase tracking-widest italic transition-all {activeTab === tab ? 'bg-emerald-500 text-white shadow-[0_0_25px_#22c55e44]' : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white'}"
      >
        {tab === 'ALL' ? 'Everything' : tab.replace('_', ' ')}
      </button>
    {/each}
  </div>

  <!-- Shipment Stream Table -->
  <div class="glass-panel overflow-hidden" in:scale={{ duration: 400 }}>
    <div class="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
       <div class="flex items-center gap-4">
          <h3 class="text-xs font-black uppercase tracking-[0.2em] text-white italic">Operational_Shipment_Matrix</h3>
          <div class="h-4 w-px bg-white/10"></div>
          <span class="text-[9px] font-black text-emerald-500 uppercase italic tabular-nums tracking-widest">{filteredOrders.length} INBOUND_EVENTS</span>
       </div>
    </div>

    <div class="overflow-x-auto thin-scrollbar">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] italic border-b border-white/5 bg-white/[0.01]">
            <th class="p-6">Order_Source</th>
            <th class="p-6">Entity_Hub</th>
            <th class="p-6">Fiscal_Payload</th>
            <th class="p-6">Settlement_Status</th>
            <th class="p-6">Logistics_Protocol</th>
            <th class="p-6 text-right">System_Actions</th>
          </tr>
        </thead>
        <tbody class="text-[11px] font-black">
          {#each filteredOrders as order (order.id)}
            <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
              <td class="p-6">
                <div class="flex flex-col gap-1">
                    <span class="text-emerald-400 uppercase italic tracking-tighter text-sm">{order.orderNumber}</span>
                    <span class="text-[8px] text-white/20 uppercase font-black italic tracking-widest">Portal: {order.source}</span>
                </div>
              </td>
              <td class="p-6">
                <div class="flex flex-col gap-1">
                    <span class="text-white uppercase italic">{order.customerName}</span>
                    <span class="text-[8px] text-white/20 font-black italic tabular-nums">{order.phone}</span>
                </div>
              </td>
              <td class="p-6 text-white italic tabular-nums text-sm">
                {formatMMK(order.totalAmount)}
              </td>
              <td class="p-6">
                <span class={getPaymentStyle(order.paymentStatus)}>{order.paymentStatus}</span>
              </td>
              <td class="p-6">
                <span class="px-3 py-1 text-[8px] font-black uppercase italic glass-panel border-none {getStatusStyle(order.status)}">
                    {order.status}
                </span>
              </td>
              <td class="p-6 text-right">
                <div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
                   <select 
                     class="bg-zinc-800 border border-white/10 text-[8px] font-black uppercase p-2 outline-none italic tracking-widest focus:border-emerald-500/50 text-white/60"
                     value={order.status}
                     onchange={(e) => ecommerceStore.updateStatus(order.id, e.currentTarget.value as EcommerceOrderStatus)}
                   >
                     <option value="PENDING">SET_PENDING</option>
                     <option value="CONFIRMED">AUTHORIZE</option>
                     <option value="PROCESSING">INITIATE_PROC</option>
                     <option value="SHIPPED">DEPLOY_SHIP</option>
                     <option value="DELIVERED">VERIFY_DELIVERY</option>
                     <option value="CANCELLED">ABORT_TRANS</option>
                   </select>
                   <button class="glass-button secondary px-4 py-2 text-[8px] font-black italic transition-all hover:bg-emerald-500/20 hover:text-white hover:border-emerald-500/30">VIEW_DETAILS</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      
      {#if filteredOrders.length === 0}
         <div class="p-32 text-center text-white/10 font-black text-sm italic tracking-[0.4em] uppercase">No distribution events detected in local matrix</div>
      {/if}
    </div>
  </div>
</div>

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

    .thin-scrollbar::-webkit-scrollbar {
        height: 6px;
        width: 6px;
    }

    .thin-scrollbar::-webkit-scrollbar-track {
        @apply bg-transparent;
    }

    .thin-scrollbar::-webkit-scrollbar-thumb {
        @apply bg-white/5 rounded-full hover:bg-emerald-500/30 transition-all;
    }
</style>
