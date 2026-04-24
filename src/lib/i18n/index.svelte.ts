/**
 * KT POS Internationalisation store.
 *
 * Uses Svelte 5 runes for reactive, class-based state.
 * Supports English and Myanmar with a single toggle.
 */
import { en } from './en';
import { my } from './my';
import type { Translations } from './en';

export type Locale = 'en' | 'my';

class I18nStore {
  locale = $state<Locale>('en');

  /** Current translation object – reactively updates when locale changes. */
  get t(): Translations {
    return this.locale === 'en' ? en : my;
  }

  /** Toggle between English and Myanmar. */
  toggle() {
    this.locale = this.locale === 'en' ? 'my' : 'en';
  }

  /** Set locale explicitly. */
  setLocale(l: Locale) {
    this.locale = l;
    // Persist preference
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('KT POS-locale', l);
    }
  }

  /** Load saved locale from localStorage. */
  loadSaved() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('KT POS-locale') as Locale | null;
      if (saved === 'en' || saved === 'my') {
        this.locale = saved;
      }
    }
  }
}

export const i18n = new I18nStore();
