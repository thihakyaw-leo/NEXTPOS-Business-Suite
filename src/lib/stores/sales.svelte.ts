/**
 * Sales Store — manages sales history.
 */
import type { Sale, SaleDetail } from '$lib/types/index';
import { MOCK_SALES } from '$lib/api/mock-data';

export type DateFilter = 'today' | 'week' | 'month' | 'all';

class SalesStore {
  all = $state<Sale[]>([...MOCK_SALES]);
  details = $state<Map<number, SaleDetail[]>>(new Map());
  searchQuery = $state('');
  dateFilter = $state<DateFilter>('all');

  get filtered(): Sale[] {
    let result = this.all;

    // Date filter
    const now = new Date();
    if (this.dateFilter === 'today') {
      const today = now.toISOString().slice(0, 10);
      result = result.filter((s) => s.saleDate.startsWith(today));
    } else if (this.dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter((s) => new Date(s.saleDate) >= weekAgo);
    } else if (this.dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter((s) => new Date(s.saleDate) >= monthAgo);
    }

    // Search filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.saleNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q)
      );
    }

    return result.sort(
      (a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
    );
  }

  get totalRevenue(): number {
    return this.filtered
      .filter((sale) => sale.status === 'COMPLETED')
      .reduce((sum, sale) => sum + sale.netAmount, 0);
  }

  get totalCount(): number {
    return this.filtered.filter((sale) => sale.status === 'COMPLETED').length;
  }

  get avgSale(): number {
    return this.totalCount > 0 ? Math.round(this.totalRevenue / this.totalCount) : 0;
  }

  setSearch(q: string) {
    this.searchQuery = q;
  }

  setDateFilter(f: DateFilter) {
    this.dateFilter = f;
  }

  addSale(sale: Sale, saleDetails?: SaleDetail[]) {
    this.all.unshift(sale);
    if (saleDetails) {
      this.details.set(sale.id, saleDetails);
    }
  }

  findBySaleNumber(saleNumber: string): Sale | undefined {
    return this.all.find((sale) => sale.saleNumber === saleNumber);
  }

  updateSale(saleNumber: string, updates: Partial<Sale>) {
    const sale = this.findBySaleNumber(saleNumber);

    if (sale) {
      Object.assign(sale, updates);
    }
  }

  voidSale(saleNumber: string) {
    this.updateSale(saleNumber, { status: 'VOIDED' });
  }

  deleteSale(saleNumber: string) {
    const sale = this.findBySaleNumber(saleNumber);

    if (sale) {
      this.details.delete(sale.id);
    }

    this.all = this.all.filter((entry) => entry.saleNumber !== saleNumber);
  }

  getSaleDetails(saleId: number): SaleDetail[] {
    return this.details.get(saleId) ?? [];
  }

  /** Get recent sales for dashboard (last N). */
  recent(n = 5): Sale[] {
    return [...this.all]
      .filter((sale) => sale.status === 'COMPLETED')
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
      .slice(0, n);
  }

  /** Get last 7 days trend data for dashboard chart. */
  last7DaysTrend(): { label: string; value: number }[] {
    const days: { label: string; value: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayLabel = date.toLocaleDateString('en', { weekday: 'short' });
      const dayTotal = this.all
        .filter((s) => s.saleDate.startsWith(dateStr) && s.status === 'COMPLETED')
        .reduce((sum, s) => sum + s.netAmount, 0);

      days.push({ label: dayLabel, value: dayTotal });
    }

    return days;
  }
}

export const sales = new SalesStore();
