# KT POS Business Suite

A premium, offline-ready Enterprise Resource Planning (ERP) and Point of Sale (POS) system built with Svelte 5, Tauri, and Cloudflare.

## 🚀 Overview

KT POS is designed for high-performance retail environments, offering a seamless desktop experience with offline synchronization and real-time analytics.

### Key Features
- **Smart Terminal**: Fast checkout with barcode support and offline local caching.
- **Inventory Matrix**: Robust stock tracking with multi-warehouse support.
- **Financial Engine**: Integrated accounting and automated ledger management.
- **Relationship Nexus**: Customer and vendor relationship management.
- **Reporting Hub**: High-density analytics and PDF/Excel export.

## 🛠️ Technology Stack
- **Frontend**: Svelte 5 (Runes), Tailwind CSS v4, Dexie.js (Offline Storage)
- **Desktop**: Tauri (Rust backend for Windows/macOS)
- **Backend**: Cloudflare Workers & D1 Database
- **Build**: Vite, Rolldown

## 📦 Getting Started

### Local Development
```bash
# Install dependencies
npm install

# Start SvelteKit dev server
npm run dev

# Start Tauri dev mode (Desktop)
npm run tauri:dev
```

### Production Build
```bash
# Create desktop installer
npm run tauri:build

# Build web-only production
npm run build
```

## 🔒 License
© 2026 KT POS Technologies. All rights reserved.
