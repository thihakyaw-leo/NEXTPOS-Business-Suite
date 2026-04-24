import { browser } from '$app/environment';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalSpent: number;
  lastVisit: string;
}

function createPeopleStore() {
  let initialCustomers: Customer[] = [];

  if (browser) {
    const saved = localStorage.getItem('pos_customers');
    if (saved) {
      try {
        initialCustomers = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse customers', e);
      }
    }

    if (initialCustomers.length === 0) {
      initialCustomers = [
        { id: 'C-001', name: 'Kyaw Kyaw', phone: '09791234567', totalSpent: 450000, lastVisit: new Date().toISOString() },
        { id: 'C-002', name: 'Aye Aye', phone: '09451234567', totalSpent: 120000, lastVisit: new Date().toISOString() },
        { id: 'C-003', name: 'Zaw Zaw', phone: '09251234567', totalSpent: 89000, lastVisit: new Date().toISOString() },
      ];
    }
  }

  let customers = $state<Customer[]>(initialCustomers);

  function save() {
    if (browser) {
      localStorage.setItem('pos_customers', JSON.stringify(customers));
    }
  }

  return {
    get allCustomers() { return customers; },
    addCustomer(cust: Omit<Customer, 'id' | 'totalSpent' | 'lastVisit'>) {
      const newCust: Customer = {
        ...cust,
        id: `C-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        totalSpent: 0,
        lastVisit: new Date().toISOString()
      };
      customers.push(newCust);
      save();
    }
  };
}

export const peopleStore = createPeopleStore();
