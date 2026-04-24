import { browser } from '$app/environment';

export interface DeliveryProviderRecord {
  id: string;
  name: string;
  contact?: string;
  baseFee: number;
  isActive: boolean;
}

function createDeliveryStore() {
  let initialProviders: DeliveryProviderRecord[] = [];

  if (browser) {
    const saved = localStorage.getItem('pos_delivery_providers');
    if (saved) {
      try {
        initialProviders = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load delivery providers', e);
      }
    }
    
    // If empty after load, add one sample manual provider if the user wants
    if (initialProviders.length === 0) {
      initialProviders = [
        { id: 'p1', name: 'Own Delivery', contact: '09XXXXXXX', baseFee: 1500, isActive: true }
      ];
    }
  }

  let providers = $state<DeliveryProviderRecord[]>(initialProviders);

  function save() {
    if (browser) {
      localStorage.setItem('pos_delivery_providers', JSON.stringify(providers));
    }
  }

  return {
    get all() { return providers; },
    get active() { return providers.filter(p => p.isActive); },
    
    add(provider: Omit<DeliveryProviderRecord, 'id'>) {
      const newProvider = { ...provider, id: crypto.randomUUID() };
      providers.push(newProvider);
      save();
    },
    
    update(id: string, updates: Partial<DeliveryProviderRecord>) {
      const idx = providers.findIndex(p => p.id === id);
      if (idx !== -1) {
        providers[idx] = { ...providers[idx], ...updates };
        save();
      }
    },
    
    remove(id: string) {
      providers = providers.filter(p => p.id !== id);
      save();
    },
    
    toggleActive(id: string) {
      const idx = providers.findIndex(p => p.id === id);
      if (idx !== -1) {
        providers[idx].isActive = !providers[idx].isActive;
        save();
      }
    }
  };
}

export const deliveryStore = createDeliveryStore();
