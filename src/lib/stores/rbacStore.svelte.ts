/**
 * RBAC Store — Role-based Access Control for KT POS.
 * Roles: ADMIN | MANAGER | CASHIER | INVENTORY
 */
import { browser } from '$app/environment';

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'INVENTORY';

export interface PosUser {
  id: string;
  name: string;
  pin: string; // 4-digit hashed PIN
  role: UserRole;
  avatar?: string;
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: [
    'dashboard', 'sales', 'purchase', 'inventory', 'delivery',
    'accounts', 'reports', 'people', 'settings', 'warehouse',
    'ecommerce', 'terminal', 'export', 'delete', 'void',
  ],
  MANAGER: [
    'dashboard', 'sales', 'purchase', 'inventory', 'delivery',
    'accounts', 'reports', 'people', 'warehouse', 'terminal', 'export', 'void',
  ],
  CASHIER: [
    'dashboard', 'sales', 'terminal',
  ],
  INVENTORY: [
    'dashboard', 'inventory', 'purchase', 'warehouse', 'reports',
  ],
};

export const ROLE_META: Record<UserRole, { label: string; labelMy: string; color: string; icon: string }> = {
  ADMIN:     { label: 'Administrator',     labelMy: 'စီမံခန့်ခွဲသူ',    color: 'text-rose-400',   icon: '👑' },
  MANAGER:   { label: 'Manager',           labelMy: 'မန်နေဂျာ',         color: 'text-amber-400',  icon: '🎯' },
  CASHIER:   { label: 'Cashier',           labelMy: 'ငွေသားကိုင်',      color: 'text-emerald-400', icon: '💳' },
  INVENTORY: { label: 'Inventory Staff',   labelMy: 'ကုန်ပစ္စည်းအဖွဲ့', color: 'text-blue-400',   icon: '📦' },
};

const STORAGE_KEY = 'KT POS_rbac';
const SESSION_KEY = 'KT POS_session';

const DEFAULT_USERS: PosUser[] = [
  { id: 'u1', name: 'Admin',     pin: '0000', role: 'ADMIN',     avatar: '👑' },
  { id: 'u2', name: 'Manager',   pin: '1111', role: 'MANAGER',   avatar: '🎯' },
  { id: 'u3', name: 'Cashier',   pin: '2222', role: 'CASHIER',   avatar: '💳' },
  { id: 'u4', name: 'Stock Mgr', pin: '3333', role: 'INVENTORY', avatar: '📦' },
];

function createRbacStore() {
  let users = $state<PosUser[]>([]);
  let currentUser = $state<PosUser | null>(null);
  let pinError = $state<string | null>(null);

  if (browser) {
    const saved = localStorage.getItem(STORAGE_KEY);
    users = saved ? JSON.parse(saved) : [...DEFAULT_USERS];

    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      try {
        currentUser = JSON.parse(session);
      } catch {
        currentUser = null;
      }
    }
  }

  function save() {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    }
  }

  function saveSession(user: PosUser | null) {
    if (browser) {
      if (user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }

  return {
    get users() { return users; },
    get currentUser() { return currentUser; },
    get pinError() { return pinError; },

    get isLoggedIn(): boolean {
      return currentUser !== null;
    },

    get role(): UserRole | null {
      return currentUser?.role ?? null;
    },

    /** Check if current user has a specific permission */
    can(permission: string): boolean {
      if (!currentUser) return false;
      return ROLE_PERMISSIONS[currentUser.role].includes(permission);
    },

    /** Check if current user can access a route segment */
    canAccess(routeSegment: string): boolean {
      if (!currentUser) return false;
      return ROLE_PERMISSIONS[currentUser.role].some((p) => routeSegment.includes(p));
    },

    /** Login with user ID and PIN */
    login(userId: string, pin: string): boolean {
      pinError = null;
      const user = users.find((u) => u.id === userId);
      if (!user) {
        pinError = 'User not found.';
        return false;
      }
      if (user.pin !== pin) {
        pinError = 'Invalid PIN. Try again.';
        return false;
      }
      currentUser = user;
      saveSession(user);
      return true;
    },

    /** Logout current user */
    logout() {
      currentUser = null;
      pinError = null;
      saveSession(null);
    },

    /** Add a new user */
    addUser(user: Omit<PosUser, 'id'>) {
      const newUser: PosUser = { ...user, id: crypto.randomUUID() };
      users.push(newUser);
      save();
      return newUser;
    },

    /** Update a user */
    updateUser(id: string, updates: Partial<Omit<PosUser, 'id'>>) {
      const idx = users.findIndex((u) => u.id === id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        if (currentUser?.id === id) {
          currentUser = users[idx];
          saveSession(currentUser);
        }
        save();
      }
    },

    /** Delete a user (cannot delete self) */
    deleteUser(id: string): boolean {
      if (currentUser?.id === id) return false;
      users = users.filter((u) => u.id !== id);
      save();
      return true;
    },

    clearPinError() {
      pinError = null;
    },
  };
}

export const rbac = createRbacStore();
