// Keep client-side navigation enabled, but allow SSR on the web build so
// hooks.server.ts can enforce admin cookies for /admin routes.
export const csr = true;
