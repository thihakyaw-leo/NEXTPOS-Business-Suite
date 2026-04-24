<script lang="ts">
  import { products } from '$lib/stores/products.svelte';
  import { formatMMK } from '$lib/types/index';
  import { ui } from '$lib/stores/ui.svelte';
  import { fade, slide } from 'svelte/transition';

  interface SaleRow {
    id: string;
    productName: string;
    avQty: number;
    unit: string;
    qty: number;
    rate: number;
    discountPct: number;
    vatPct: number;
    total: number;
  }

  let items = $state<SaleRow[]>([
    { id: '1', productName: '', avQty: 0, unit: '', qty: 0, rate: 0, discountPct: 0, vatPct: 0, total: 0 }
  ]);

  let formData = $state({
    customer: 'Walk-In-Customer',
    address: '',
    invoiceNo: '',
    date: new Date().toISOString().slice(0, 10),
    outlet: 'Main Warehouse',
    saleType: 'Regular Sale',
    remarks: '',
    discountValue: 0,
    saleVatPct: 5,
    additionalExpenses: 0
  });

  let itemTotal = $derived(items.reduce((s, i) => s + i.total, 0));
  let totalDiscount = $derived(formData.discountValue);
  let totalVatValue = $derived(itemTotal * (formData.saleVatPct / 100));
  let grandTotal = $derived(itemTotal - totalDiscount + totalVatValue + formData.additionalExpenses);

  function addRow() {
    items.push({ id: crypto.randomUUID(), productName: '', avQty: 0, unit: '', qty: 0, rate: 0, discountPct: 0, vatPct: 0, total: 0 });
  }

  function removeRow(id: string) {
    if (items.length > 1) {
      items = items.filter(i => i.id !== id);
    }
  }

  function calculateRow(index: number) {
    const item = items[index];
    const base = item.qty * item.rate;
    const disc = base * (item.discountPct / 100);
    const vat = (base - disc) * (item.vatPct / 100);
    items[index].total = base - disc + vat;
  }
</script>

<svelte:head>
  <title>New Transaction | Sales Intelligence</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200" in:fade>
  <!-- Top Control Bar -->
  <nav class="h-14 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-50 sticky top-0">
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          </div>
          <h1 class="text-sm font-black text-white uppercase tracking-[0.3em] italic">New <span class="text-emerald-500">Transaction</span></h1>
      </div>
      <div class="h-4 w-px bg-white/10 hidden md:block"></div>
      <div class="hidden md:flex gap-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">
          <span class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Terminal Active</span>
          <span class="flex items-center gap-2 text-rose-500/80"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Enterprise Trial</span>
      </div>
    </div>
    
    <div class="flex items-center gap-3">
       <button class="glass-button secondary px-4 py-1.5 text-[9px]">CLOSE_REG</button>
       <button class="h-8 w-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">⌨️</button>
       <a href="/pos/sales/manage" class="glass-button emerald px-4 py-1.5 text-[9px]">VIEW_LEDGER</a>
    </div>
  </nav>

  <main class="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full">
    <!-- Header Intelligence Panel -->
    <div class="glass-panel p-6 border-l-4 border-l-emerald-500">
      <div class="grid grid-cols-12 gap-8">
        <!-- Customer Segment -->
        <div class="col-span-12 lg:col-span-4 space-y-4">
          <div class="space-y-1.5">
            <label for="customer-select" class="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Identity Verification
            </label>
            <div class="flex gap-2 group">
               <input id="customer-select" type="text" bind:value={formData.customer} class="flex-1 bg-zinc-900 border border-white/10 p-2.5 px-4 text-xs text-white outline-none focus:border-emerald-500/50 transition-all font-bold placeholder:text-white/10 uppercase tracking-widest" placeholder="SELECT CUSTOMER..." />
               <button class="w-10 bg-emerald-500 text-white font-black hover:bg-emerald-400 transition-all active:scale-90 shadow-lg shadow-emerald-500/20">+</button>
            </div>
          </div>
          <div class="space-y-1.5 opacity-60 group">
            <label for="contact-node-address" class="text-[9px] font-black text-emerald-500/50 uppercase tracking-[0.2em]">Contact Node Address</label>
            <input id="contact-node-address" type="text" bind:value={formData.address} class="w-full bg-zinc-900 border border-white/10 p-2 px-4 text-[10px] text-white/50 outline-none italic" />
          </div>
        </div>

        <!-- Ledger Segment -->
        <div class="col-span-12 lg:col-span-4 space-y-4">
          <div class="space-y-1.5">
            <label for="invoice-id" class="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Reference/Invoice ID</label>
            <input id="invoice-id" type="text" bind:value={formData.invoiceNo} class="w-full bg-zinc-900 border border-white/10 p-2.5 px-4 text-xs text-emerald-400 font-mono italic outline-none focus:border-emerald-500/50" placeholder="LEAVE BLANK FOR AUTO-ID" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
                <label for="audit-date" class="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Audit Date</label>
                <input id="audit-date" type="date" bind:value={formData.date} class="w-full bg-zinc-900 border border-white/10 p-2 px-3 text-[10px] text-white font-bold outline-none uppercase" />
            </div>
            <div class="space-y-1.5">
                <label for="active-port" class="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Active Port/Outlet</label>
                <input id="active-port" type="text" bind:value={formData.outlet} class="w-full bg-zinc-900 border border-white/10 p-2 px-3 text-[10px] text-white/40 outline-none uppercase tracking-tighter" readonly />
            </div>
          </div>
        </div>

        <!-- Operational Status -->
        <div class="col-span-12 lg:col-span-4 space-y-4">
          <div class="space-y-3">
             <span class="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Registry Protocol</span>
             <div class="flex flex-wrap gap-2">
               {#each ['Regular Sale', 'Delivery Sale', 'Draft Sale'] as t}
                 <label class="group cursor-pointer">
                   <input type="radio" value={t} bind:group={formData.saleType} class="hidden peer" />
                   <span class="px-4 py-1.5 rounded-sm border border-white/10 text-[9px] font-black uppercase text-white/30 peer-checked:bg-emerald-500/20 peer-checked:text-emerald-400 peer-checked:border-emerald-500/50 transition-all flex items-center gap-2">
                       <span class="w-1 h-1 rounded-full bg-current"></span>
                       {t}
                   </span>
                 </label>
               {/each}
             </div>
          </div>
          <div class="space-y-1.5">
             <label for="operation-remarks" class="text-[9px] font-black text-blue-500/50 uppercase tracking-[0.2em]">Operation Remarks</label>
             <textarea id="operation-remarks" bind:value={formData.remarks} placeholder="ADD TRANSACTION NOTES..." class="w-full bg-zinc-900 border border-white/10 p-3 h-16 text-[10px] text-white outline-none focus:border-blue-500/50 italic placeholder:text-white/5"></textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- Inventory Dispatch Console -->
    <div class="glass-panel overflow-hidden border-t-4 border-t-zinc-800 shadow-3xl">
      <div class="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
              <div class="h-8 w-1 bg-emerald-500 rounded-full"></div>
              <span class="text-[10px] font-black text-white uppercase tracking-[0.3em] italic">Dispatch Inventory</span>
          </div>
          <div class="relative flex-1 max-w-2xl group">
             <input type="text" placeholder="SCAN BARCODE OR MANUAL SYMBOL SEARCH..." class="w-full bg-zinc-900 border border-white/10 p-2.5 px-10 text-xs text-white outline-none focus:border-emerald-500/40 transition-all font-bold placeholder:text-white/10 uppercase tracking-widest italic" />
             <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">🔍</span>
             <span class="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 text-[9px] font-black border border-white/20 px-1 rounded-sm">F1</span>
          </div>
      </div>
      
      <div class="overflow-x-auto min-h-[300px]">
        <table class="w-full text-left border-collapse">
          <thead class="bg-zinc-900 text-[9px] font-black text-white/30 uppercase tracking-[0.2em] italic">
            <tr>
              <th class="p-4 border-r border-white/5">SKU Designation</th>
              <th class="p-4 border-r border-white/5 text-center">Av_Buff</th>
              <th class="p-4 border-r border-white/5 text-center w-24">Dispatch_Qty</th>
              <th class="p-4 border-r border-white/5 text-center w-32">Rate_Ks</th>
              <th class="p-4 border-r border-white/5 text-center w-24">Disc_%</th>
              <th class="p-4 border-r border-white/5 text-center w-24">Tax_%</th>
              <th class="p-4 border-r border-white/5 text-right w-40">Valuation</th>
              <th class="p-4 text-center w-16">Ops</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each items as item, index (item.id)}
              <tr class="group hover:bg-emerald-500/[0.02] border-b border-white/5 last:border-0 transition-all duration-300">
                <td class="p-0 border-r border-white/5 relative">
                   <input type="text" bind:value={item.productName} class="w-full bg-transparent p-4 text-[11px] font-black text-white outline-none uppercase tracking-widest placeholder:text-white/5" placeholder="SELECT PAYLOAD..." />
                   <span class="absolute bottom-1 left-4 text-[7px] font-bold text-white/10 uppercase">Registry Reference</span>
                </td>
                <td class="p-4 border-r border-white/5 text-center">
                    <span class="text-[10px] font-black text-blue-400 tabular-nums">{item.avQty}</span>
                </td>
                <td class="p-0 border-r border-white/5">
                    <input type="number" bind:value={item.qty} oninput={() => calculateRow(index)} class="w-full bg-transparent p-4 text-[10px] font-black text-emerald-500 text-center outline-none" />
                </td>
                <td class="p-0 border-r border-white/5">
                    <input type="number" bind:value={item.rate} oninput={() => calculateRow(index)} class="w-full bg-transparent p-4 text-[10px] font-black text-white text-center outline-none tabular-nums" />
                </td>
                <td class="p-0 border-r border-white/5">
                    <input type="number" bind:value={item.discountPct} oninput={() => calculateRow(index)} class="w-full bg-transparent p-4 text-[10px] font-black text-rose-500 text-center outline-none" />
                </td>
                <td class="p-0 border-r border-white/5">
                    <input type="number" bind:value={item.vatPct} oninput={() => calculateRow(index)} class="w-full bg-transparent p-4 text-[10px] font-black text-blue-500 text-center outline-none" />
                </td>
                <td class="p-4 border-r border-white/5 text-right bg-white/[0.02]">
                    <span class="text-xs font-black text-white italic tabular-nums">{formatMMK(item.total)}</span>
                </td>
                <td class="p-2 text-center">
                   <div class="flex flex-col gap-1 items-center">
                       <button onclick={addRow} class="h-6 w-6 rounded bg-emerald-500 text-white font-black hover:bg-emerald-400 flex items-center justify-center transition-all shadow-lg shadow-emerald-500/20 active:scale-90">+</button>
                       <button onclick={() => removeRow(item.id)} class="h-6 w-6 rounded bg-rose-500/10 text-rose-500 font-black hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">×</button>
                   </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Financial Reconciliation Console -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-white/10">
          <div class="p-8 border-r border-white/5 bg-zinc-900/30">
              <h3 class="text-xs font-black text-white/40 uppercase tracking-[0.3em] italic mb-6">Financial Overrides</h3>
              <div class="space-y-4 max-w-sm">
                  <div class="flex items-center justify-between group">
                    <label for="tax-vat" class="text-[10px] font-black text-white/30 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">Tax Computation [VAT]:</label>
                    <div class="flex gap-2 w-48">
                        <input id="tax-vat" type="number" bind:value={formData.saleVatPct} class="w-16 bg-zinc-950 border border-white/5 p-2 text-[10px] font-bold text-blue-400 text-center outline-none focus:border-blue-500/50" />
                        <div class="flex-1 bg-zinc-950 border border-white/5 p-2 text-[10px] font-black text-white/50 text-right italic tabular-nums">{formatMMK(totalVatValue)}</div>
                    </div>
                  </div>
                  <div class="flex items-center justify-between group">
                    <label for="direct-rebate" class="text-[10px] font-black text-white/30 uppercase tracking-widest group-hover:text-rose-400 transition-colors">Direct Rebate [Ks]:</label>
                    <input id="direct-rebate" type="number" bind:value={formData.discountValue} class="w-48 bg-zinc-950 border border-white/5 p-2 text-[10px] font-black text-rose-500 text-right outline-none focus:border-rose-500/50 tabular-nums" />
                  </div>
                  <div class="flex items-center justify-between group">
                    <label for="logistic-exp" class="text-[10px] font-black text-white/30 uppercase tracking-widest group-hover:text-blue-400 transition-colors">Logistic Expenses:</label>
                    <input id="logistic-exp" type="number" bind:value={formData.additionalExpenses} class="w-48 bg-zinc-950 border border-white/5 p-2 text-[10px] font-black text-blue-400 text-right outline-none focus:border-blue-500/50 tabular-nums" />
                  </div>
                  <button class="w-full glass-button emerald py-3 text-[10px] font-black mt-4 shadow-2xl shadow-emerald-500/10 active:shadow-none">ADDITIONAL_INPUT_FIELDS</button>
              </div>
          </div>
          
          <div class="p-8 flex flex-col justify-end items-end space-y-6">
              <div class="space-y-4 w-full">
                  <div class="flex justify-between items-center px-4 py-2 border-b border-white/5">
                      <span class="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Dispatch Item Valuation</span>
                      <span class="text-sm font-black text-white italic tabular-nums">{formatMMK(itemTotal)}</span>
                  </div>
                  <div class="flex justify-between items-center px-4 py-2 border-b border-white/5">
                      <span class="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Total Surcharge/Tax</span>
                      <span class="text-sm font-bold text-white/60 tabular-nums">{formatMMK(totalVatValue)}</span>
                  </div>
                  <div class="flex justify-between items-center px-4 py-2 border-b border-white/5">
                      <span class="text-[10px] font-black text-rose-500/50 uppercase tracking-[0.2em]">Active Rebates</span>
                      <span class="text-sm font-black text-rose-500 italic tabular-nums">-{formatMMK(totalDiscount)}</span>
                  </div>
              </div>
              
              <div class="w-full glass-panel !bg-emerald-500/10 p-6 border-l-8 border-l-emerald-500 group overflow-hidden relative">
                  <div class="absolute -right-4 -top-4 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  </div>
                  <div class="relative z-10">
                      <div class="flex justify-between items-center mb-1">
                          <span class="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Net Inbound Assets</span>
                          <span class="text-[9px] font-bold text-white/20 uppercase">Calculated Real-time</span>
                      </div>
                      <div class="flex justify-between items-baseline gap-4">
                          <p class="text-4xl font-black text-white italic tabular-nums tracking-tighter">{formatMMK(grandTotal)}</p>
                          <p class="text-xs font-bold text-emerald-400 uppercase tracking-widest italic">Kyats Only</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  </main>

  <!-- Finalize Action Ribbon -->
  <footer class="bg-zinc-900 border-t border-white/10 p-4 px-8 flex items-center justify-between gap-6 z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
     <div class="flex items-center gap-8 overflow-hidden text-ellipsis whitespace-nowrap">
        <div class="flex flex-col">
           <p class="text-[9px] font-black text-white/20 uppercase tracking-widest">Active Customer</p>
           <p class="text-xs font-black text-white uppercase italic truncate max-w-[200px]">{formData.customer}</p>
        </div>
        <div class="h-8 w-px bg-white/5 hidden md:block"></div>
        <div class="hidden md:flex items-center gap-10">
            <div class="flex flex-col">
               <p class="text-[9px] font-black text-white/20 uppercase tracking-widest">Qty Items</p>
               <p class="text-xs font-black text-white text-center tabular-nums">{items.length}</p>
            </div>
            <div class="flex flex-col">
               <p class="text-[9px] font-black text-white/20 uppercase tracking-widest">Vat/Tax</p>
               <p class="text-xs font-black text-blue-400 tabular-nums">{formData.saleVatPct}%</p>
            </div>
        </div>
     </div>
     
     <div class="flex items-center gap-4">
        <button class="glass-button secondary px-10 py-3 text-[10px] font-black">CANCEL_DRAFT</button>
        <button class="glass-button primary px-16 py-3 text-[10px] font-black shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:scale-105 active:scale-95 transition-all">
            <span class="tracking-[0.4em]">FINALIZE & COMMIT</span>
        </button>
     </div>
  </footer>
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

    .glass-button.emerald {
        @apply bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-emerald-500;
    }

    /* Input focus states for consistency */
    input[type="date"]::-webkit-calendar-picker-indicator {
        filter: invert(1) brightness(0.8) sepia(100%) saturate(1000%) hue-rotate(90deg);
        cursor: pointer;
    }

    /* Hide number arrows */
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
</style>
