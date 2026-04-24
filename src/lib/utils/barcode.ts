/**
 * Barcode Utility — generates and prints barcode labels using bwip-js.
 * Supports Code128, Code39, QR Code, EAN-13.
 */

export type BarcodeType = 'code128' | 'code39' | 'qrcode' | 'ean13';

export interface BarcodeLabel {
  barcode: string;
  name: string;
  price: number;
  itemCode?: string;
}

/**
 * Render a single barcode onto a canvas element.
 * Returns the canvas data URL (PNG).
 */
export async function renderBarcode(
  value: string,
  type: BarcodeType = 'code128',
  width = 200,
  height = 60
): Promise<string> {
  // @ts-ignore
  const bwipjs = await import('bwip-js');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  await bwipjs.toCanvas(canvas, {
    bcid: type,
    text: value,
    scale: 3,
    height: 14,
    includetext: true,
    textxalign: 'center',
    backgroundcolor: 'ffffff',
    barcolor: '000000',
    textcolor: '000000',
  });

  return canvas.toDataURL('image/png');
}

/**
 * Print barcode labels for a list of products.
 * Opens a new print window with formatted label grid.
 */
export async function printBarcodeLabels(
  labels: BarcodeLabel[],
  copies = 1,
  type: BarcodeType = 'code128'
): Promise<void> {
  // Generate all barcode images first
  const rendered: Array<{ label: BarcodeLabel; dataUrl: string }> = [];

  for (const label of labels) {
    try {
      const dataUrl = await renderBarcode(label.barcode, type);
      for (let i = 0; i < copies; i++) {
        rendered.push({ label, dataUrl });
      }
    } catch (e) {
      console.error(`Failed to render barcode for ${label.name}:`, e);
    }
  }

  const labelWidth = 85; // mm
  const labelHeight = 42; // mm

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>KT POS — Barcode Labels</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Arial', sans-serif; }
        body { background: white; }
        .grid {
          display: flex;
          flex-wrap: wrap;
          gap: 2mm;
          padding: 5mm;
        }
        .label {
          width: ${labelWidth}mm;
          height: ${labelHeight}mm;
          border: 0.5px solid #ccc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 2mm;
          page-break-inside: avoid;
        }
        .label__name {
          font-size: 7pt;
          font-weight: bold;
          text-transform: uppercase;
          text-align: center;
          max-width: 100%;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          color: #111;
        }
        .label__code {
          font-size: 6pt;
          color: #666;
          font-family: monospace;
        }
        .label__barcode img {
          max-width: 100%;
          height: auto;
        }
        .label__price {
          font-size: 9pt;
          font-weight: 900;
          color: #1a2e1a;
        }
        @media print {
          body { margin: 0; }
          @page { margin: 5mm; size: A4 portrait; }
        }
      </style>
    </head>
    <body>
      <div class="grid">
        ${rendered
          .map(
            ({ label, dataUrl }) => `
          <div class="label">
            <div class="label__name">${label.name}</div>
            <div class="label__barcode"><img src="${dataUrl}" alt="${label.barcode}" /></div>
            ${label.itemCode ? `<div class="label__code">${label.itemCode}</div>` : ''}
            <div class="label__price">${new Intl.NumberFormat('en-MM').format(label.price)} Ks</div>
          </div>`
          )
          .join('')}
      </div>
      <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Popup blocked. Please allow popups for printing.');
    return;
  }

  win.document.write(htmlContent);
  win.document.close();
}

/**
 * Download a single barcode as a PNG image.
 */
export async function downloadBarcode(
  value: string,
  filename = 'barcode',
  type: BarcodeType = 'code128'
): Promise<void> {
  const dataUrl = await renderBarcode(value, type, 300, 100);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${filename}.png`;
  link.click();
}
