/**
 * Export Utility — PDF & Excel export for KT POS reports.
 * Uses jspdf + jspdf-autotable for PDF, xlsx for Excel.
 */

import type { Sale, Product } from '$lib/types/index';
import type { PurchaseInvoice } from '$lib/stores/purchaseStore.svelte';

// ── Helpers ───────────────────────────────────────────────────────────────────

const headerColor: [number, number, number] = [26, 46, 26]; // emerald green dark
const accentColor: [number, number, number] = [34, 197, 94]; // emerald-500
const textDark: [number, number, number] = [15, 15, 15];
const textLight: [number, number, number] = [100, 100, 100];

function mmk(n: number): string {
  return new Intl.NumberFormat('en-MM', { maximumFractionDigits: 0 }).format(n) + ' Ks';
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB');
}

// ── PDF: Sales Report ─────────────────────────────────────────────────────────

export async function exportSalesPDF(sales: Sale[], filterLabel = 'All Time'): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header band
  doc.setFillColor(...headerColor);
  doc.rect(0, 0, 297, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('KT POS — Sales Report', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${filterLabel}   |   Generated: ${new Date().toLocaleString()}`, 14, 20);

  // KPI strip
  const completed = sales.filter((s) => s.status === 'COMPLETED');
  const totalRev = completed.reduce((s, x) => s + x.netAmount, 0);
  const avgTx = completed.length > 0 ? Math.round(totalRev / completed.length) : 0;

  doc.setFontSize(8);
  doc.setTextColor(...accentColor);
  doc.text(`TOTAL REVENUE: ${mmk(totalRev)}`, 14, 33);
  doc.text(`TRANSACTIONS: ${completed.length}`, 100, 33);
  doc.text(`AVG ORDER VALUE: ${mmk(avgTx)}`, 180, 33);

  // Table
  autoTable(doc, {
    startY: 38,
    head: [['Sale #', 'Date', 'Customer', 'Payment', 'Amount', 'Tax', 'Discount', 'Net Amount', 'Status']],
    body: sales.map((s) => [
      s.saleNumber,
      fmtDate(s.saleDate),
      s.customerName,
      s.paymentMethod,
      mmk(s.totalAmount),
      mmk(s.taxAmount),
      mmk(s.discountAmount),
      mmk(s.netAmount),
      s.status,
    ]),
    headStyles: { fillColor: headerColor, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: textDark },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    columnStyles: { 8: { textColor: accentColor, fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  doc.save(`KT POS_Sales_Report_${Date.now()}.pdf`);
}

// ── PDF: Purchase Report ──────────────────────────────────────────────────────

export async function exportPurchasePDF(invoices: PurchaseInvoice[]): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(...headerColor);
  doc.rect(0, 0, 297, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('KT POS — Purchase Report', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);

  const totalSpend = invoices.reduce((s, i) => s + i.totalAmount, 0);
  doc.setFontSize(8);
  doc.setTextColor(...accentColor);
  doc.text(`TOTAL SPEND: ${mmk(totalSpend)}`, 14, 33);
  doc.text(`INVOICES: ${invoices.length}`, 100, 33);

  autoTable(doc, {
    startY: 38,
    head: [['Invoice #', 'Date', 'Supplier', 'Amount', 'Status']],
    body: invoices.map((i) => [
      i.invoiceNumber,
      fmtDate(i.purchaseDate),
      i.supplierName,
      mmk(i.totalAmount),
      i.status,
    ]),
    headStyles: { fillColor: headerColor, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: textDark },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`KT POS_Purchase_Report_${Date.now()}.pdf`);
}

// ── PDF: Inventory / Stock Report ─────────────────────────────────────────────

export async function exportInventoryPDF(products: Product[]): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(...headerColor);
  doc.rect(0, 0, 297, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('KT POS — Inventory Report', 14, 12);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);

  const totalValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const lowStock = products.filter((p) => p.stock <= p.reorderLevel).length;
  doc.setFontSize(8);
  doc.setTextColor(...accentColor);
  doc.text(`STOCK VALUE: ${mmk(totalValue)}`, 14, 33);
  doc.text(`LOW STOCK ITEMS: ${lowStock}`, 120, 33);
  doc.text(`TOTAL SKUs: ${products.length}`, 210, 33);

  autoTable(doc, {
    startY: 38,
    head: [['Code', 'Name', 'Category', 'Unit', 'Cost Price', 'Selling Price', 'Stock', 'Reorder Lvl', 'Stock Value', 'Status']],
    body: products.map((p) => [
      p.itemCode,
      p.name,
      p.category,
      p.unit,
      mmk(p.costPrice),
      mmk(p.sellingPrice),
      p.stock,
      p.reorderLevel,
      mmk(p.stock * p.costPrice),
      p.stock <= 0 ? 'DEPLETED' : p.stock <= p.reorderLevel ? 'LOW' : 'OK',
    ]),
    headStyles: { fillColor: headerColor, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: textDark },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    columnStyles: {
      9: {
        fontStyle: 'bold',
      },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 9) {
        const val = data.cell.raw as string;
        if (val === 'DEPLETED') data.cell.styles.textColor = [220, 38, 38];
        else if (val === 'LOW') data.cell.styles.textColor = [234, 179, 8];
        else data.cell.styles.textColor = accentColor;
      }
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`KT POS_Inventory_Report_${Date.now()}.pdf`);
}

// ── Excel: Sales ──────────────────────────────────────────────────────────────

export async function exportSalesExcel(sales: Sale[], filterLabel = 'All Time'): Promise<void> {
  const XLSX = await import('xlsx');

  const wsData = [
    ['KT POS — Sales Report', '', '', '', '', '', '', '', ''],
    [`Period: ${filterLabel}`, '', '', `Generated: ${new Date().toLocaleString()}`, '', '', '', '', ''],
    [],
    ['Sale #', 'Date', 'Customer', 'Payment', 'Total Amount', 'Tax', 'Discount', 'Net Amount', 'Status'],
    ...sales.map((s) => [
      s.saleNumber,
      fmtDate(s.saleDate),
      s.customerName,
      s.paymentMethod,
      s.totalAmount,
      s.taxAmount,
      s.discountAmount,
      s.netAmount,
      s.status,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [14, 14, 20, 12, 16, 12, 12, 16, 12].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  XLSX.writeFile(wb, `KT POS_Sales_${Date.now()}.xlsx`);
}

// ── Excel: Purchase ───────────────────────────────────────────────────────────

export async function exportPurchaseExcel(invoices: PurchaseInvoice[]): Promise<void> {
  const XLSX = await import('xlsx');

  const wsData = [
    ['KT POS — Purchase Report', '', '', '', ''],
    [`Generated: ${new Date().toLocaleString()}`, '', '', '', ''],
    [],
    ['Invoice #', 'Date', 'Supplier', 'Amount', 'Status'],
    ...invoices.map((i) => [i.invoiceNumber, fmtDate(i.purchaseDate), i.supplierName, i.totalAmount, i.status]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [16, 14, 24, 16, 14].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
  XLSX.writeFile(wb, `KT POS_Purchase_${Date.now()}.xlsx`);
}

// ── Excel: Inventory ──────────────────────────────────────────────────────────

export async function exportInventoryExcel(products: Product[]): Promise<void> {
  const XLSX = await import('xlsx');

  const wsData = [
    ['KT POS — Inventory Report', '', '', '', '', '', '', '', '', ''],
    [`Generated: ${new Date().toLocaleString()}`, '', '', '', '', '', '', '', '', ''],
    [],
    ['Code', 'Name', 'Category', 'Unit', 'Cost Price', 'Selling Price', 'Stock', 'Reorder Level', 'Stock Value', 'Status'],
    ...products.map((p) => [
      p.itemCode,
      p.name,
      p.category,
      p.unit,
      p.costPrice,
      p.sellingPrice,
      p.stock,
      p.reorderLevel,
      p.stock * p.costPrice,
      p.stock <= 0 ? 'DEPLETED' : p.stock <= p.reorderLevel ? 'LOW' : 'OK',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [12, 22, 14, 8, 14, 14, 8, 12, 14, 10].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  XLSX.writeFile(wb, `KT POS_Inventory_${Date.now()}.xlsx`);
}
