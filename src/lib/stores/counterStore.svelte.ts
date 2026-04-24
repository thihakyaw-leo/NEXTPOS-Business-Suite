import { browser } from '$app/environment';

export interface CounterSession {
  id: string;
  counterName: string;
  openingBalance: number;
  openedAt: string;
  openedBy: string;
  status: 'OPEN' | 'CLOSED';
}

function createCounterStore() {
  let session = $state<CounterSession | null>(null);

  if (browser) {
    const saved = localStorage.getItem('pos_counter_session');
    if (saved) {
      try {
        session = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load counter session', e);
      }
    }
  }

  function save() {
    if (browser) {
      if (session) {
        localStorage.setItem('pos_counter_session', JSON.stringify(session));
      } else {
        localStorage.removeItem('pos_counter_session');
      }
    }
  }

  return {
    get current() { return session; },
    get isOpen() { return session !== null && session.status === 'OPEN'; },
    
    open(counterName: string, openingBalance: number, username: string) {
      session = {
        id: crypto.randomUUID(),
        counterName,
        openingBalance,
        openedAt: new Date().toISOString(),
        openedBy: username,
        status: 'OPEN'
      };
      save();
    },
    
    close() {
      session = null;
      save();
    }
  };
}

export const counterStore = createCounterStore();
