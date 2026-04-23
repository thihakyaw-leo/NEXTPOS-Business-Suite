// @ts-check

import { writable } from 'svelte/store';

/** @typedef {'owner' | 'cashier'} PosRole */

/** @type {Record<string, string[]>} */
const PLAN_FEATURES = {
  pos_only: ['inventory.read', 'sales.read', 'sales.write', 'pos.checkout'],
  enterprise: ['inventory.read', 'sales.read', 'sales.write', 'pos.checkout', 'hr_payroll'],
};

/** @type {import('svelte/store').Writable<string[]>} */
export const featureStore = writable([]);
export const roleStore = writable(/** @type {PosRole} */ ('owner'));

/**
 * @param {string} [planType]
 * @param {string[]} [features]
 */
export function hydrateFeatures(planType = 'pos_only', features = []) {
  const resolved = new Set([...(PLAN_FEATURES[planType] ?? []), ...features]);
  featureStore.set([...resolved]);
}

export function resetFeatures() {
  featureStore.set([]);
}

/**
 * @param {string[]} features
 */
export function setFeatures(features) {
  featureStore.set([...new Set(features)]);
}

/**
 * @param {string} feature
 */
export function enableFeature(feature) {
  featureStore.update((features) =>
    features.includes(feature) ? features : [...features, feature],
  );
}

/**
 * @param {string} feature
 */
export function disableFeature(feature) {
  featureStore.update((features) => features.filter((entry) => entry !== feature));
}

/**
 * @param {PosRole} role
 */
export function setRole(role) {
  roleStore.set(role);
}
