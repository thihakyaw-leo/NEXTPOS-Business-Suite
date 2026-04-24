import { browser } from '$app/environment';
import { type Toast, type ToastType, uid } from '$lib/types/index';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'KT POS-theme';

class UIStore {
  sidebarCollapsed = $state(false);
  activeModal = $state<string | null>(null);
  toasts = $state<Toast[]>([]);
  theme = $state<ThemeMode>('dark');
  themeInitialized = $state(false);

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  openModal(id: string) {
    this.activeModal = id;
  }

  closeModal() {
    this.activeModal = null;
  }

  initializeTheme() {
    if (!browser || this.themeInitialized) {
      return;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    this.theme =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : prefersDark
          ? 'dark'
          : 'light';

    this.applyTheme();
    this.themeInitialized = true;
  }

  setTheme(theme: ThemeMode) {
    this.theme = theme;
    this.applyTheme();
  }

  toggleTheme() {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
  }

  applyTheme() {
    if (!browser) {
      return;
    }

    const root = document.documentElement;

    root.classList.toggle('dark', this.theme === 'dark');
    root.dataset.theme = this.theme;
    root.style.colorScheme = this.theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, this.theme);

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    themeMeta?.setAttribute('content', this.theme === 'dark' ? '#07101d' : '#f6f1e8');
  }

  toast(type: ToastType, message: string, duration = 3500) {
    const id = uid();
    this.toasts.push({ id, type, message, duration });
    setTimeout(() => this.dismissToast(id), duration);
  }

  dismissToast(id: string) {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
  }

  success(message: string) {
    this.toast('success', message);
  }

  error(message: string) {
    this.toast('error', message, 5000);
  }

  warning(message: string) {
    this.toast('warning', message);
  }

  info(message: string) {
    this.toast('info', message);
  }
}

export const ui = new UIStore();
