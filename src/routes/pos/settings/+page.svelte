<script lang="ts">
  import { featureStore } from '$lib/stores/featureStore.js';
  import { formatMMK } from '$lib/types/index';
  import { fade, scale, slide } from 'svelte/transition';

  const apps = [
    { id: 'pos', name: 'POS_TERMINAL', desc: 'MISSION_CRITICAL_SALES_ENGINE', icon: '🏷️', status: 'CORE_SYSTEM', color: 'bg-emerald-500' },
    { id: 'inventory', name: 'INV_INTEL', desc: 'LOGISTICS_MATRIX_CONTROL', icon: '🏭', status: 'ACTIVE', color: 'bg-blue-500/50' },
    { id: 'hrm', name: 'HR_SYNC', desc: 'PERSONNEL_NETWORK_MGMT', icon: '👥', status: 'INACTIVE', color: 'bg-indigo-500/50' },
    { id: 'accounting', name: 'FIN_STREAM', desc: 'LEDGER_INTELLIGENCE_LAYER', icon: '💰', status: 'ACTIVE', color: 'bg-teal-600/50' },
    { id: 'crm', name: 'CLIENT_CORE', desc: 'ENTITY_RELATION_MAPPING', icon: '🤝', status: 'INACTIVE', color: 'bg-rose-500/50' },
    { id: 'whatsapp', name: 'COMM_LINK_WA', desc: 'RECEIPT_DISTRIBUTION_API', icon: '💬', status: 'ADD_ON', color: 'bg-green-500/50' },
    { id: 'sms', name: 'COMM_LINK_SMS', desc: 'NOTIFICATION_BROADCAST', icon: '📱', status: 'ADD_ON', color: 'bg-sky-500/50' },
    { id: 'kitchen', name: 'KITCHEN_OPS', desc: 'ORDER_LIFECYCLE_TRACKING', icon: '🍳', status: 'INACTIVE', color: 'bg-orange-500/50' },
  ];

  let activeTab = $state('all');
</script>

<svelte:head>
  <title>Executive Control Hub | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- Executive Header -->
  <header class="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>
    
    <div class="space-y-1 relative">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">System_Infrastructure Active</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Executive <span class="text-emerald-500">Control Hub</span>
      </h1>
      <p class="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] italic mt-2">Managing advanced business modules and mission-critical integrations</p>
    </div>

    <div class="flex gap-4 relative">
       <button type="button" class="glass-button primary px-10 py-4 text-[10px] font-black italic tracking-widest shadow-[0_0_40px_rgba(34,197,94,0.15)] flex items-center gap-3 active:scale-95 group">
         <span class="text-lg group-hover:rotate-90 transition-transform">⚙️</span> SYSTEM_MARKETPLACE
       </button>
    </div>
  </header>

  <!-- Health Telemetry Grid -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
    <div class="glass-panel p-8 border-t-2 border-emerald-500/30">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic text-emerald-500">Active_Matrix</p>
       <div class="flex items-baseline gap-2">
          <p class="text-4xl font-black text-white italic tabular-nums">05</p>
          <p class="text-xs font-black text-white/20 italic uppercase tracking-tighter">/ 08 MODULES</p>
       </div>
    </div>
    <div class="glass-panel p-8 border-t-2 border-zinc-700">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Resource_Quota</p>
       <p class="text-4xl font-black text-white italic tabular-nums">92%</p>
       <div class="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div class="h-full bg-emerald-500 w-[92%] shadow-[0_0_10px_#22c55e]"></div>
       </div>
    </div>
    <div class="glass-panel p-8 border-t-2 border-zinc-700">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Sync_Integrity</p>
       <p class="text-4xl font-black text-emerald-500 italic uppercase">OPTIMAL</p>
    </div>
    <div class="glass-panel p-8 border-t-2 border-zinc-700">
       <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Firmware_Ver</p>
       <p class="text-2xl font-black text-white/40 italic uppercase tracking-tighter">ENTERPRISE_V6.0_BETA</p>
    </div>
  </div>

  <!-- Filtration Matrix -->
  <div class="flex gap-10 border-b border-white/5 relative z-10">
     {#each ['all', 'core', 'marketing', 'inactive'] as tab}
       <button 
         class="pb-6 text-[10px] font-black uppercase tracking-[0.3em] italic transition-all relative {activeTab === tab ? 'text-emerald-500' : 'text-white/20 hover:text-white/40'}"
         onclick={() => activeTab = tab}
       >
         {tab}_PROTOCOL
         {#if activeTab === tab}
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_#22c55e]" in:fade></div>
         {/if}
       </button>
     {/each}
  </div>

  <!-- Applications Matrix Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
    {#each apps as app}
       <div class="glass-panel flex flex-col group hover:border-emerald-500/30 transition-all duration-500 active:scale-[0.98] cursor-pointer overflow-hidden" in:scale={{ duration: 300 }}>
          <div class="p-8 flex-1">
             <div class="flex justify-between items-start mb-6">
                <div class="w-16 h-16 glass-panel border-none {app.color} flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(255,255,255,0.05)] group-hover:scale-110 transition-transform duration-500">{app.icon}</div>
                <span class="text-[8px] font-black uppercase italic px-3 py-1 glass-panel border-none {app.status === 'INACTIVE' ? 'text-white/10 bg-white/5' : 'text-emerald-500 bg-emerald-500/10'}">
                  {app.status}
                </span>
             </div>
             <h3 class="text-sm font-black text-white uppercase italic tracking-tighter mb-2 group-hover:text-emerald-400 transition-colors">{app.name}</h3>
             <p class="text-[9px] font-black text-white/20 uppercase italic tracking-widest leading-relaxed line-clamp-2">{app.desc}</p>
          </div>
          <div class="p-6 bg-white/[0.01] border-t border-white/5 flex justify-between items-center transition-colors group-hover:bg-white/[0.03]">
             <button class="text-[9px] font-black uppercase tracking-widest italic {app.status === 'INACTIVE' ? 'text-white/40 hover:text-emerald-500' : 'text-emerald-500 hover:text-white'} transition-colors">
                {app.status === 'INACTIVE' ? 'INITIALIZE_APP' : 'CONFIGURE_NODE'}
             </button>
             
             <div class="flex items-center gap-2">
                <div class="w-10 h-1.5 glass-panel border-white/10 rounded-full overflow-hidden p-[2px] bg-white/5">
                   <div class="h-full rounded-full transition-all duration-1000 {app.status === 'INACTIVE' ? 'w-0 bg-white/20' : 'w-full bg-emerald-500 shadow-[0_0_8px_#22c55e]'}"></div>
                </div>
             </div>
          </div>
       </div>
    {/each}
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
</style>
