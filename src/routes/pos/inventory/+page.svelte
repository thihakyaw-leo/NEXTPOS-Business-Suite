<script lang="ts">
  import { onMount } from 'svelte';
  import { products } from '$lib/stores/products.svelte';
  import { CATEGORY_META, formatMMK, type Product, type ProductCategory } from '$lib/types/index';
  import { fade, slide, scale } from 'svelte/transition';
  import { exportInventoryPDF, exportInventoryExcel } from '$lib/utils/export';
  import { printBarcodeLabels } from '$lib/utils/barcode';

  const allCategories: ProductCategory[] = [
    'food', 'drinks', 'snacks', 'personal', 'household', 'stationery', 'other'
  ];

  let activeCategory = $derived(products.activeCategory);
  let searchQuery = $derived(products.searchQuery);
  let categories = $derived(['all', ...products.categories] as Array<ProductCategory | 'all'>);

  let showModal = $state(false);
  let editingId = $state<string | null>(null);
  let formError = $state('');

  let formData = $state({
    itemCode: '',
    name: '',
    nameMy: '',
    barcode: '',
    category: 'other' as ProductCategory,
    unit: 'pcs',
    costPrice: 0,
    sellingPrice: 0,
    stock: 0,
    reorderLevel: 5,
  });

  onMount(() => {
    void products.initialize();
  });

  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    products.setSearch(target.value);
  }

  function handleCategoryChange(category: ProductCategory | 'all') {
    products.setCategory(category);
  }

  function openAddModal() {
    editingId = null;
    formError = '';
    formData = {
      itemCode: '', name: '', nameMy: '', barcode: '',
      category: 'other', unit: 'pcs', costPrice: 0,
      sellingPrice: 0, stock: 0, reorderLevel: 5,
    };
    showModal = true;
  }

  function openEditModal(product: Product) {
    editingId = product.itemCode;
    formError = '';
    formData = {
      itemCode: product.itemCode, name: product.name,
      nameMy: product.nameMy || '', barcode: product.barcode,
      category: product.category, unit: product.unit,
      costPrice: product.costPrice, sellingPrice: product.sellingPrice,
      stock: product.stock, reorderLevel: product.reorderLevel,
    };
    showModal = true;
  }

  async function handleSaveProduct() {
    if (!formData.itemCode.trim() || !formData.name.trim()) {
      formError = 'Item code and name are required.';
      return;
    }
    formError = '';
    try {
      if (editingId) {
        await products.updateProduct(editingId as string, { ...formData, icon: 'BOX' });
      } else {
        await products.addProduct({ ...formData, icon: 'BOX' });
      }
      showModal = false;
    } catch (e) {
       const err = e as Error;
       formError = err.message || 'Product could not be saved.';
    }
  }

  let exporting = $state(false);

  async function handleExportPDF() {
    exporting = true;
    try { await exportInventoryPDF(products.filtered); } 
    finally { exporting = false; }
  }

  async function handleExportExcel() {
    exporting = true;
    try { await exportInventoryExcel(products.filtered); }
    finally { exporting = false; }
  }

  async function handlePrintBarcodes() {
    const labels = products.filtered.map((p) => ({
      barcode: p.barcode || p.itemCode,
      name: p.name,
      price: p.sellingPrice,
      itemCode: p.itemCode,
    }));
    await printBarcodeLabels(labels, 1);
  }
</script>

<svelte:head>
  <title>Inventory Intelligence | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- Global Telemetry Header -->
  <header class="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -left-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>

    <div class="space-y-1 relative max-w-3xl">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">Stock_Audit_Status: SYNCHRONIZED</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Inventory <span class="text-emerald-500">& Asset</span> Intelligence
      </h1>
      <div class="mt-4">
         <p class="text-xs font-black text-white/40 uppercase tracking-widest italic leading-relaxed">
            Messy product lists make it hard to know what’s actually in stock. RetailersPOS simplifies product management with powerful tools to organize, categorize, and update inventory instantly and accurately. 
            Automated restock protocols and real-time tracking give you total visibility across all store locations.
         </p>
      </div>
      
      <!-- Rapid Access Nodes -->
      <div class="flex flex-wrap gap-4 mt-6">
         {#each ['Outlets', 'Brands', 'Categories', 'Units', 'Barcodes', 'Adjustments'] as node}
            <span class="px-4 py-1.5 glass-panel border-none bg-white/5 text-[8px] font-black uppercase italic tracking-widest text-white/40 group hover:text-emerald-500 transition-colors cursor-default">
               <span class="text-emerald-500 mr-2">/</span> {node}
            </span>
         {/each}
      </div>
    </div>
    
    <div class="flex gap-3 relative flex-wrap">
       <button type="button" onclick={handleExportPDF} disabled={exporting} class="glass-button secondary px-6 py-4 text-[9px] font-black italic tracking-widest flex items-center gap-2">
         <span>📄</span> PDF
       </button>
       <button type="button" onclick={handleExportExcel} disabled={exporting} class="glass-button secondary px-6 py-4 text-[9px] font-black italic tracking-widest flex items-center gap-2">
         <span>📊</span> EXCEL
       </button>
       <button type="button" onclick={handlePrintBarcodes} class="glass-button secondary px-6 py-4 text-[9px] font-black italic tracking-widest flex items-center gap-2">
         <span>🏷️</span> BARCODES
       </button>
       <button type="button" class="glass-button primary px-10 py-4 text-[10px] font-black italic tracking-widest shadow-[0_0_40px_rgba(34,197,94,0.15)] flex items-center gap-3 group active:scale-95" onclick={openAddModal}>
         <span class="text-lg group-hover:rotate-180 transition-transform duration-500">+</span> REGISTER_NEW_ASSET
       </button>
    </div>
  </header>

  <!-- Metric Telemetry Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
    <div class="glass-panel p-8 group border-t-2 border-emerald-500/30">
      <div class="flex justify-between items-start mb-6">
        <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic">Aggregate Valuation</p>
        <div class="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
      </div>
      <div class="flex items-baseline gap-3">
        <p class="text-4xl font-black text-white tracking-tighter italic tabular-nums">{formatMMK(products.totalValue)}</p>
        <span class="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Growth_α</span>
      </div>
      <div class="mt-8 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div class="h-full bg-emerald-500 shadow-[0_0_15px_#22c55e]" style="width: 75%"></div>
      </div>
    </div>
    
    <div class="glass-panel p-8 group border-t-2 border-amber-500/30">
      <div class="flex justify-between items-start mb-6">
        <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic">Threshold Alerts</p>
        <div class="h-2 w-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
      </div>
      <p class="text-4xl font-black text-amber-500 tracking-tighter italic tabular-nums">{products.lowStockCount} <span class="text-xs text-white/20 not-italic uppercase ml-2 tracking-widest">SKUs_Low</span></p>
      <p class="text-[9px] text-white/20 font-black uppercase mt-8 tracking-widest italic leading-relaxed">System protocols advise immediate replenishment cycles</p>
    </div>

    <div class="glass-panel p-8 group border-t-2 border-rose-500/30">
      <div class="flex justify-between items-start mb-6">
        <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic">System Depletion</p>
        <div class="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div>
      </div>
      <p class="text-4xl font-black text-rose-500 tracking-tighter italic tabular-nums">{products.outOfStockCount} <span class="text-xs text-white/20 not-italic uppercase ml-2 tracking-widest">SKUs_Zero</span></p>
      <p class="text-[9px] text-white/20 font-black uppercase mt-8 tracking-widest italic leading-relaxed">Direct revenue erosion protocols active</p>
    </div>
  </div>

  <!-- Filtration Intelligence -->
  <div class="glass-panel p-10 relative overflow-hidden">
    <div class="absolute -top-20 -right-20 w-40 h-40 bg-white/5 blur-3xl pointer-events-none"></div>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div>
        <label for="search-input" class="block text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-4 italic">Query Index Matrix</label>
        <div class="relative group">
          <input 
            id="search-input"
            type="text" 
            placeholder="INPUT_SCANNER_DATA_OR_TITLE..." 
            class="w-full bg-zinc-900 border border-white/5 px-6 py-4 text-xs font-black text-white placeholder:text-white/5 focus:border-emerald-500/50 outline-none transition-all italic tracking-widest"
            bind:value={products.searchQuery}
            oninput={handleSearch}
          />
          <div class="absolute right-4 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-emerald-500 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      </div>
      
      <div>
        <span class="block text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-4 italic">Domain Classification Matrix</span>
        <div class="flex flex-wrap gap-3">
          {#each categories as category}
            <button
              type="button"
              class="px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border italic {activeCategory === category ? 'bg-emerald-500 text-white border-emerald-500 shadow-xl shadow-emerald-500/20' : 'bg-white/5 text-white/30 border-white/5 hover:bg-white/10 hover:text-white'}"
              onclick={() => handleCategoryChange(category)}
            >
              {category === 'all' ? 'All_Unified' : (CATEGORY_META[category as ProductCategory]?.labelMy || category)}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- High-Density Asset Registry -->
  <div class="glass-panel overflow-hidden border-t-2 border-zinc-800">
    <div class="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
      <div>
        <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">Asset Vector Registry</h3>
        <p class="text-[9px] text-white/20 mt-1 font-black uppercase tracking-widest italic">Synchronized local index state : active</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-4 py-2 glass-panel bg-white/5 text-[10px] font-black text-emerald-500 italic uppercase tracking-widest">
            {products.filtered.length} NODES_DETECTED
        </span>
      </div>
    </div>
    
    <div class="overflow-x-auto min-h-[600px] scrollbar-thin">
      <table class="w-full text-left border-separate border-spacing-0">
        <thead>
          <tr class="bg-zinc-900/50 text-white/20 text-[9px] uppercase font-black tracking-[0.25em] italic">
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">Identifier</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">Asset Description</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">Classification</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10 text-right">Valuation_MMK</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10 text-right">Supply_Level</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">Vector_Status</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10 text-right">Interface</th>
          </tr>
        </thead>
        <tbody class="text-xs font-bold text-white/60 divide-y divide-white/5">
          {#each products.filtered as product (product.itemCode)}
            <tr class="hover:bg-emerald-500/[0.03] transition-all duration-300 group">
              <td class="p-6">
                  <span class="font-mono text-[10px] text-white/20 group-hover:text-white/40 transition-colors uppercase italic">{product.itemCode}</span>
              </td>
              <td class="p-6">
                <div class="flex flex-col gap-1.5">
                  <span class="text-xs font-black text-white uppercase italic tracking-wider group-hover:text-emerald-400 transition-colors">{product.name}</span>
                  <span class="text-[9px] text-white/10 uppercase tracking-widest font-black italic">{product.nameMy || product.barcode || 'RAW_ENTRY'}</span>
                </div>
              </td>
              <td class="p-6">
                <span class="px-3 py-1 bg-white/5 text-white/30 text-[9px] uppercase font-black tracking-widest border border-white/5">{product.category}</span>
              </td>
              <td class="p-6 text-right">
                <span class="text-xs font-black text-emerald-500 italic tabular-nums">{formatMMK(product.sellingPrice)}</span>
              </td>
              <td class="p-6 text-right font-black text-white tabular-nums italic text-sm">{product.stock}</td>
              <td class="p-6">
                <div class="flex items-center gap-3">
                  <div class="h-1.5 w-1.5 rounded-full {product.stock <= 0 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]' : product.stock <= product.reorderLevel ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]'}"></div>
                  <span class="text-[9px] font-black uppercase tracking-[0.2em] italic {product.stock <= 0 ? 'text-rose-500' : product.stock <= product.reorderLevel ? 'text-amber-500' : 'text-emerald-500'}">
                    {product.stock <= 0 ? 'DEPLETED' : product.stock <= product.reorderLevel ? 'CRITICAL_TH' : 'STABLE_NODE'}
                  </span>
                </div>
              </td>
              <td class="p-6 text-right">
                <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                  <button type="button" class="h-9 w-9 glass-panel flex items-center justify-center hover:bg-emerald-500/20 text-white/40 hover:text-white transition-all" onclick={() => openEditModal(product)} aria-label="Edit product">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button type="button" class="h-9 w-9 glass-panel flex items-center justify-center hover:bg-rose-500/20 text-white/40 hover:text-rose-500 transition-all" aria-label="Delete product">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if products.filtered.length === 0}
      <div class="p-40 text-center flex flex-col items-center justify-center opacity-10">
        <div class="w-24 h-24 mb-6 border-2 border-white/10 rounded-full flex items-center justify-center">
           <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <p class="text-sm font-black uppercase tracking-[0.5em] italic">No matching vectors found in local registry</p>
      </div>
    {/if}
  </div>
</div>

<!-- Immersive Modal Portal -->
{#if showModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10 bg-zinc-950/90 backdrop-blur-xl" in:fade>
    <div class="glass-panel w-full max-w-3xl border-t-4 border-emerald-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] animate-in zoom-in duration-500">
      <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
        <div>
          <h2 class="text-xl font-black uppercase italic tracking-tighter text-white">{editingId ? 'Modify_Asset_Signature' : 'Register_Alpha_Component'}</h2>
          <p class="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mt-1">Asset Verification Protocol : Catalog_v2.8</p>
        </div>
        <button type="button" class="h-10 w-10 glass-panel flex items-center justify-center text-white/20 hover:text-white hover:bg-rose-500/20 transition-all font-black text-lg" onclick={() => showModal = false} aria-label="Close modal">✕</button>
      </div>
      
      <div class="p-10 max-h-[75vh] overflow-y-auto scrollbar-thin space-y-10">
        {#if formError}
          <div class="p-5 bg-rose-500/10 border border-rose-500/30 text-[10px] font-black uppercase tracking-widest text-rose-400 italic flex items-center gap-4" in:slide>
            <div class="h-2 w-2 rounded-full bg-rose-500"></div>
            ERROR_REPORT: {formError}
          </div>
        {/if}
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div class="space-y-3">
            <label for="item-code" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Asset_Identifier</label>
            <input id="item-code" type="text" placeholder="SKU_REF_000" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.2em] transition-all disabled:opacity-20" bind:value={formData.itemCode} disabled={!!editingId} />
          </div>
          
          <div class="space-y-3">
            <label for="barcode" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">GTIN_Scanner_Index</label>
            <input id="barcode" type="text" placeholder="0000_0000_0000" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white/60 focus:border-emerald-500/50 outline-none tracking-widest transition-all" bind:value={formData.barcode} />
          </div>
          
          <div class="space-y-3 md:col-span-2">
            <label for="name-en" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Canonical_Identity (EN)</label>
            <input id="name-en" type="text" placeholder="COMMERCIAL_TITLE" class="w-full bg-zinc-900 border border-white/10 p-4 text-sm font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-tight transition-all" bind:value={formData.name} />
          </div>
          
          <div class="space-y-3 md:col-span-2">
            <label for="name-my" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Vernacular_Script (MY)</label>
            <input id="name-my" type="text" placeholder="ကုန်ပစ္စည်းအမည်" class="w-full bg-zinc-900 border border-white/10 p-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all" bind:value={formData.nameMy} />
          </div>
          
          <div class="space-y-3">
            <label for="category" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Operational_Sector</label>
            <div class="relative">
                <select id="category" class="w-full bg-zinc-900 border border-white/10 p-4 text-[10px] font-black text-white focus:border-emerald-500/50 outline-none appearance-none uppercase tracking-[0.2em] transition-all" bind:value={formData.category}>
                    {#each allCategories as cat}<option value={cat} class="bg-[#0a0a0a] uppercase">{cat}</option>{/each}
                </select>
                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 italic">▼</div>
            </div>
          </div>
          
          <div class="space-y-3">
            <label for="price" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Unit_Valiation (Ks)</label>
            <input id="price" type="number" class="w-full bg-zinc-900 border border-white/10 p-4 text-lg font-black text-emerald-500 focus:border-emerald-500 outline-none tabular-nums italic transition-all" bind:value={formData.sellingPrice} />
          </div>
          
          <div class="space-y-3">
            <label for="stock" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Real_Time_Supply</label>
            <input id="stock" type="number" class="w-full bg-zinc-900 border border-white/10 p-4 text-lg font-black text-white focus:border-emerald-500 outline-none tabular-nums italic transition-all" bind:value={formData.stock} />
          </div>
          
          <div class="space-y-3">
            <label for="reorder" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Critical_Floor_Th</label>
            <input id="reorder" type="number" class="w-full bg-zinc-900 border border-white/10 p-4 text-lg font-black text-amber-500 focus:border-amber-500 outline-none tabular-nums italic transition-all" bind:value={formData.reorderLevel} />
          </div>
        </div>
      </div>
      
      <div class="p-8 bg-white/5 border-t border-white/5 flex justify-end gap-6">
        <button type="button" class="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-colors italic" onclick={() => showModal = false}>ABORT_OPERATION</button>
        <button type="button" class="glass-button primary px-12 py-4 text-[10px] font-black italic shadow-2xl shadow-emerald-500/20" onclick={handleSaveProduct}>COMMIT_REGISTRY_STATE</button>
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
    
    .scrollbar-thin::-webkit-scrollbar {
        width: 4px;
        height: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
    .scrollbar-thin::-webkit-scrollbar-thumb { @apply bg-white/10 rounded-full hover:bg-emerald-500/30; }
</style>
