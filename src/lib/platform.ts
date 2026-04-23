import { invoke } from '@tauri-apps/api/core';

declare global {
  interface Window {
    __TAURI__?: Record<string, unknown>;
    __TAURI_INTERNALS__?: Record<string, unknown>;
  }
}

export type Platform = 'tauri' | 'web';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' &&
  (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);

export const getPlatform = (): Platform => (isTauri() ? 'tauri' : 'web');

export const isWeb = (): boolean => !isTauri();

export const printReceipt = async (receiptText: string): Promise<boolean> => {
  if (isTauri()) {
    try {
      await invoke('print_receipt', { receiptText });
      return true;
    } catch (error) {
      console.error('Tauri print_receipt failed:', error);
      return false;
    }
  } else {
    // Web fallback preview
    console.log('========== PRINT PREVIEW (WEB) ==========');
    console.log(receiptText);
    console.log('=========================================');
    return true;
  }
};
