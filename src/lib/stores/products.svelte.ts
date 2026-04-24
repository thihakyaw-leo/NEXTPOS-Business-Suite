/**
 * Products Store — manages product catalog with search and category filtering,
 * now connected to Dexie Local Database.
 */
import { browser } from '$app/environment';
import type { Product, ProductCategory } from '$lib/types/index';
import { MOCK_PRODUCTS } from '$lib/api/mock-data';
import { KTPOSDb } from '$lib/db';
import { uid } from '$lib/types/index';
import { fetchRemoteProducts, upsertRemoteProduct, deleteRemoteProduct } from '$lib/api/products';

class ProductsStore {
  all = $state<Product[]>([]);
  searchQuery = $state('');
  activeCategory = $state<ProductCategory | 'all'>('all');
  initialized = $state(false);

  async initialize() {
    if (!browser || this.initialized) return;

    try {
      if (navigator.onLine) {
        try {
          const remoteProducts = await fetchRemoteProducts();
          await KTPOSDb.products.clear();
          if (remoteProducts.length > 0) {
            await KTPOSDb.products.bulkAdd(remoteProducts);
          }
        } catch (syncErr) {
          console.warn('Products sync failed (fallback to local cache):', syncErr);
        }
      }

      let dbProducts = await KTPOSDb.products.toArray();
      if (dbProducts.length === 0) {
        // Seed database if empty
        await KTPOSDb.products.bulkAdd(MOCK_PRODUCTS);
        dbProducts = await KTPOSDb.products.toArray();
      }
      this.all = dbProducts;
      this.initialized = true;
    } catch (e) {
      console.error('Failed to initialize products DB:', e);
    }
  }

  get filtered(): Product[] {
    let result = this.all;

    if (this.activeCategory !== 'all') {
      result = result.filter((p) => p.category === this.activeCategory);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nameMy && p.nameMy.includes(q)) ||
          p.itemCode.toLowerCase().includes(q) ||
          p.barcode.includes(q)
      );
    }

    return result;
  }

  get categories(): ProductCategory[] {
    const cats = new Set(this.all.map((p) => p.category));
    return [...cats] as ProductCategory[];
  }

  get totalValue(): number {
    return this.all.reduce((sum, p) => sum + p.sellingPrice * p.stock, 0);
  }

  get lowStockCount(): number {
    return this.all.filter((p) => p.stock > 0 && p.stock <= p.reorderLevel).length;
  }

  get outOfStockCount(): number {
    return this.all.filter((p) => p.stock <= 0).length;
  }

  setSearch(q: string) {
    this.searchQuery = q;
  }

  setCategory(cat: ProductCategory | 'all') {
    this.activeCategory = cat;
  }

  async addProduct(product: Omit<Product, 'id'>) {
    if (!navigator.onLine) {
      throw new Error('Adding products requires an active internet connection.');
    }

    const newProduct: Product = {
      ...product,
      id: uid(),
    };
    
    const syncedProduct = await upsertRemoteProduct(newProduct);
    await KTPOSDb.products.add(syncedProduct);
    this.all.push(syncedProduct);
  }

  async updateProduct(itemCode: string, updates: Partial<Product>) {
    if (!navigator.onLine) {
      throw new Error('Updating products requires an active internet connection.');
    }

    const idx = this.all.findIndex((p) => p.itemCode === itemCode);
    if (idx >= 0) {
      const updated = { ...this.all[idx], ...updates };
      const syncedProduct = await upsertRemoteProduct(updated);
      await KTPOSDb.products.put(syncedProduct);
      this.all[idx] = syncedProduct;
    }
  }

  async deleteProduct(itemCode: string) {
    if (!navigator.onLine) {
      throw new Error('Deleting products requires an active internet connection.');
    }

    const product = this.all.find((p) => p.itemCode === itemCode);
    if (product) {
      await deleteRemoteProduct(itemCode);
      await KTPOSDb.products.delete(product.id);
      this.all = this.all.filter((p) => p.itemCode !== itemCode);
    }
  }

  getByCode(itemCode: string): Product | undefined {
    return this.all.find((p) => p.itemCode === itemCode);
  }

  getByBarcode(barcode: string): Product | undefined {
    return this.all.find((p) => p.barcode === barcode);
  }

  async decreaseStock(itemCode: string, qty: number) {
    const product = this.all.find((p) => p.itemCode === itemCode);
    if (product) {
      const updated = { ...product, stock: Math.max(0, product.stock - qty) };
      await KTPOSDb.products.put(updated);
      const idx = this.all.findIndex((p) => p.itemCode === itemCode);
      if (idx >= 0) this.all[idx] = updated;
    }
  }

  async increaseStock(itemCode: string, qty: number) {
    const product = this.all.find((p) => p.itemCode === itemCode);
    if (product) {
      const updated = { ...product, stock: Math.max(0, product.stock + qty) };
      await KTPOSDb.products.put(updated);
      const idx = this.all.findIndex((p) => p.itemCode === itemCode);
      if (idx >= 0) this.all[idx] = updated;
    }
  }
}

export const products = new ProductsStore();
