<svelte:options runes={false} />

<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { featureStore } from '$lib/stores/featureStore.js';
  import { formatMMK, type ProductCategory, type Product } from '$lib/types/index';

  const ALL_CATEGORIES: ProductCategory[] = ['food', 'drinks', 'snacks', 'personal', 'household', 'stationery', 'other'];

  $: activeCategory = products.activeCategory;
  $: searchQuery = products.searchQuery;
  $: categories = ['all', ...products.categories] as (ProductCategory | 'all')[];

  let showModal = false;
  let editingId: string | null = null;
  let formError = '';

  let formData = {
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
  };

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

  function toneForStock(stock: number, reorderLevel: number): string {
    if (stock <= Math.max(2, reorderLevel / 2)) {
      return 'text-rose-300 bg-rose-500/15 border-rose-400/25';
    }
    if (stock <= reorderLevel) {
      return 'text-amber-200 bg-amber-500/15 border-amber-400/25';
    }
    return 'text-emerald-200 bg-emerald-500/15 border-emerald-400/25';
  }

  function openAddModal() {
    editingId = null;
    formError = '';
    formData = {
      itemCode: '',
      name: '',
      nameMy: '',
      barcode: '',
      category: 'other',
      unit: 'pcs',
      costPrice: 0,
      sellingPrice: 0,
      stock: 0,
      reorderLevel: 5,
    };
    showModal = true;
  }

  function openEditModal(product: Product) {
    editingId = product.itemCode;
    formError = '';
    formData = {
      itemCode: product.itemCode,
      name: product.name,
      nameMy: product.nameMy || '',
      barcode: product.barcode,
      category: product.category,
      unit: product.unit,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      reorderLevel: product.reorderLevel,
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  async function handleSaveProduct() {
    if (!formData.itemCode.trim() || !formData.name.trim()) {
      formError = 'Item Code and Name are required.';
      return;
    }

    try {
      if (editingId) {
        await products.updateProduct(editingId, { ...formData });
      } else {
        const existing = products.getByCode(formData.itemCode);
        if (existing) {
          formError = 'Item Code already exists!';
          return;
        }
        await products.addProduct({ ...formData, icon: '📦' }); // Default icon for now
      }
      closeModal();
    } catch (e) {
      formError = e instanceof Error ? e.message : 'Error saving product';
    }
  }

  async function handleDeleteProduct(itemCode: string) {
    if (confirm(`Are you sure you want to delete ${itemCode}?`)) {
      await products.deleteProduct(itemCode);
    }
  }
</script>

<svelte:head>
  <title>NextPOS Inventory</title>
</svelte:head>

<div class="px-4 py-5 sm:px-6 lg:px-8 lg:py-8 relative">
  <div class="mx-auto max-w-[90rem] space-y-6">
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.45em] text-orange-200/80">Inventory</p>
        <h2 class="mt-2 text-3xl font-bold text-white">Product Catalog</h2>
        <p class="mt-2 max-w-2xl text-sm text-slate-300">
          View your store's entire stock list. Use the search or filter by category to find specific items quickly.
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <button 
          class="touch-button rounded-2xl bg-cyan-400 px-5 py-3 text-slate-950 font-semibold shadow-[0_20px_40px_-22px_rgba(34,211,238,0.9)] hover:bg-cyan-300"
          on:click={openAddModal}
        >
          Add Product
        </button>
        <button class="touch-button rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-slate-200 hover:bg-white/[0.09]">
          Export Replenishment List
        </button>
      </div>
    </header>

    <section class="grid gap-4 md:grid-cols-3">
      <article class="panel-surface p-5">
        <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Catalog Valuation</p>
        <div class="mt-5">
          <p class="text-3xl font-bold text-white">{formatMMK(products.totalValue)} MMK</p>
          <p class="mt-2 text-sm text-slate-400">Total potential revenue of all items in stock at selling price.</p>
        </div>
      </article>
      
      <article class="panel-surface p-5 md:col-span-2">
        <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Search & Filter</p>
        <div class="mt-5 flex flex-col gap-4 sm:flex-row">
          <div class="flex-1 relative">
            <input 
              type="text" 
              class="w-full rounded-2xl border border-white/10 bg-slate-950/60 pl-4 pr-10 py-3 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              placeholder="Search item code, name, or barcode..."
              value={searchQuery}
              on:input={handleSearch}
            />
          </div>
          <div class="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {#each categories as category}
              <button
                class={`whitespace-nowrap rounded-2xl border px-4 py-2 text-sm transition ${
                  activeCategory === category
                    ? 'border-cyan-400/30 bg-cyan-400/15 text-white'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
                }`}
                on:click={() => handleCategoryChange(category)}
              >
                {category === 'all' ? 'All Categories' : category}
              </button>
            {/each}
          </div>
        </div>
      </article>
    </section>

    <section class="panel-surface overflow-hidden">
      <div class="flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div>
          <h3 class="text-lg font-semibold text-white">Item List</h3>
          <p class="text-sm text-slate-400">Showing {products.filtered.length} products matching criteria</p>
        </div>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-white/[0.03] text-xs uppercase tracking-[0.22em] text-slate-400">
            <tr>
              <th class="px-5 py-3">Code / Barcode</th>
              <th class="px-5 py-3">Item Details</th>
              <th class="px-5 py-3">Category</th>
              <th class="px-5 py-3 text-right">Selling Price</th>
              <th class="px-5 py-3 text-right">Stock</th>
              <th class="px-5 py-3 text-center">Status</th>
              <th class="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if products.filtered.length === 0}
              <tr>
                <td colspan="7" class="px-5 py-10 text-center text-slate-400">
                  No products found matching your search and category filter.
                </td>
              </tr>
            {/if}
            {#each products.filtered as product (product.itemCode)}
              <tr class="border-t border-white/6 text-slate-200 hover:bg-white/[0.02] transition-colors">
                <td class="px-5 py-4">
                  <p class="font-semibold text-white">{product.itemCode}</p>
                  <p class="mt-1 text-xs font-mono text-slate-500">{product.barcode || 'N/A'}</p>
                </td>
                <td class="px-5 py-4">
                  <p class="font-semibold text-slate-100">{product.name}</p>
                  {#if product.nameMy}
                    <p class="mt-1 text-xs text-slate-400">{product.nameMy}</p>
                  {/if}
                </td>
                <td class="px-5 py-4">
                  <span class="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.1em] text-slate-300">
                    {product.category}
                  </span>
                </td>
                <td class="px-5 py-4 text-right font-semibold text-cyan-200">
                  {formatMMK(product.sellingPrice)} Ks
                </td>
                <td class="px-5 py-4 text-right">
                  <span class="text-lg font-bold {product.stock <= product.reorderLevel ? 'text-rose-300' : 'text-slate-100'}">
                    {product.stock}
                  </span>
                </td>
                <td class="px-5 py-4 text-center">
                  <span class={`inline-block rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${toneForStock(product.stock, product.reorderLevel)}`}>
                    {product.stock <= 0 ? 'Out of Stock' : (product.stock <= product.reorderLevel ? 'Low Stock' : 'Good')}
                  </span>
                </td>
                <td class="px-5 py-4 text-right">
                  <div class="flex justify-end gap-2 text-xs">
                    <button 
                      class="rounded border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-teal-200 hover:bg-teal-400/20"
                      on:click={() => openEditModal(product)}
                    >
                      Edit
                    </button>
                    <button 
                      class="rounded border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-rose-200 hover:bg-rose-400/20"
                      on:click={() => handleDeleteProduct(product.itemCode)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </div>
</div>  
  {#if showModal}
    <div class="absolute inset-0 z-50 flex items-center justify-center p-4">
      <div 
        class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        on:click={closeModal}
        on:keydown={(e) => e.key === 'Escape' && closeModal()}
        role="button"
        tabindex="0"
      ></div>
      <div class="panel-surface relative w-full max-w-2xl overflow-hidden rounded-[1.4rem] border shadow-2xl">
        <div class="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h3 class="text-lg font-bold text-white">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
          <button class="text-slate-400 hover:text-white transition" on:click={closeModal}>✕</button>
        </div>
        
        <div class="p-6 max-h-[70vh] overflow-y-auto">
          {#if formError}
            <div class="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {formError}
            </div>
          {/if}
          
          <div class="grid gap-5 md:grid-cols-2">
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Item Code</span>
              <input 
                type="text" 
                bind:value={formData.itemCode} 
                disabled={!!editingId}
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
              />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Barcode</span>
              <input 
                type="text" 
                bind:value={formData.barcode} 
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Name (English)</span>
              <input 
                type="text" 
                bind:value={formData.name} 
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Name (Myanmar)</span>
              <input 
                type="text" 
                bind:value={formData.nameMy} 
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Category</span>
              <select 
                bind:value={formData.category}
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                {#each ALL_CATEGORIES as cat}
                  <option value={cat}>{cat}</option>
                {/each}
              </select>
            </label>
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Unit (e.g., pcs, kg)</span>
              <input 
                type="text" 
                bind:value={formData.unit} 
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Cost Price (MMK)</span>
              <input 
                type="number" 
                bind:value={formData.costPrice} 
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Selling Price (MMK)</span>
              <input 
                type="number" 
                bind:value={formData.sellingPrice} 
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Current Stock</span>
              <input 
                type="number" 
                bind:value={formData.stock} 
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Reorder Level</span>
              <input 
                type="number" 
                bind:value={formData.reorderLevel} 
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </label>
          </div>
        </div>
        
        <div class="border-t border-white/10 bg-white/[0.02] px-6 py-4 flex justify-end gap-3">
          <button class="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition" on:click={closeModal}>Cancel</button>
          <button class="rounded-xl bg-cyan-400 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 transition shadow-[0_0_20px_-5px_rgba(34,211,238,0.5)]" on:click={handleSaveProduct}>
            {editingId ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  {/if}
