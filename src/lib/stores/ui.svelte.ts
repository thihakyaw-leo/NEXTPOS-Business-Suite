/**
 * UI Store — sidebar state, language, toasts, global UI state.
 */
import { type Toast, type ToastType, uid } from '$lib/types/index';

class UIStore {
  sidebarCollapsed = $state(false);
  activeModal = $state<string | null>(null);
  toasts = $state<Toast[]>([]);

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  openModal(id: string) {
    this.activeModal = id;
  }

  closeModal() {
    this.activeModal = null;
  }

  /** Show a toast notification. */
  toast(type: ToastType, message: string, duration = 3500) {
    const id = uid();
    this.toasts.push({ id, type, message, duration });
    setTimeout(() => this.dismissToast(id), duration);
  }

  dismissToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  success(message: string) { this.toast('success', message); }
  error(message: string)   { this.toast('error', message, 5000); }
  warning(message: string) { this.toast('warning', message); }
  info(message: string)    { this.toast('info', message); }
}

export const ui = new UIStore();
