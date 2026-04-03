# FlipSlab Engine - Product Requirements Document

## CRITICAL DEPLOYMENT INFO (DO NOT SKIP)
- **Production URL:** `https://flipslabengine.com`
- **Production REACT_APP_BACKEND_URL:** `https://flipslabengine.com`
- **User's deploy process:** Push to GitHub -> `git pull` on server -> `bash fix.sh`
- **fix.sh copies `frontend/build/*`** to the web root — **NEVER builds on server**
- **NEVER run `yarn build` or `npm run build` on the production server** — it crashes due to limited RAM (3.6GB shared with MySQL, Apache, MongoDB, SpamAssassin)
- **EVERY TIME frontend changes are made:** Run `bash /app/build_prod.sh` — this script FORCES the production URL automatically. NEVER run `yarn build` directly.
- **The `frontend/build/` folder MUST be committed to git**
- **Server OS:** AlmaLinux/cPanel VPS on GoDaddy, 3.6GB RAM + 2GB Swap
- **User language:** Spanish
- **Admin email:** pzsuave007@gmail.com (Google Auth)
- **Scanner token:** `scan_74b1544bdc4a4aa2b3fa9839c4e42f64`

## Original Problem Statement
Build a multi-tiered subscription model for the "FlipSlab Engine" sports card trading platform with admin panel, public Card Shop, eBay syncing, Social Post generator, and public Marketplace.

## Core Features Implemented
- **Public Marketplace** (`/marketplace`): Aggregates all cards, search, filters, 3D flip/swipe
- **Admin Panel** (`/admin`): Private route for admin
- **Public Card Shop** (`/shop/:slug`): Individual seller stores
- **Social Post Editor**: Full editor with presets, frames, icons, text, background colors
- **Subscription System**: 4 tiers with Stripe test keys
- **eBay Integration**: Trading & Fulfillment APIs
- **AI Card Identification**: OpenAI GPT-4o
- **Google Auth**: Emergent-managed
- **Inventory Sold Tab**: Auto-sync from eBay
- **Bulk Shipping Update**: Listings/Active + Inventory/Listed
- **Price Lookup Links**: eBay Sold + CardLadder
- **Listings Search + Sport Filter**: Search + auto-detect sport dropdown
- **Cert Number Feature**: AI extracts cert # from graded card slabs
- **Custom Global Presets (Admin)**: Admin photo presets
- **Photo Editor Mixer**: 7 individual sliders
- **Batch Upload Queue**: Phone uploads raw images, server processes in background

## Payload Optimization (Feb 2026)
- **Inventory Lazy Image Loading (DONE)** — Thumbnails in list, full images in modals
- **Scanner Auto-Crop + Scanner Fix (DONE, IMPROVED Feb 2026)** — Uses "largest contiguous block" algorithm with row/column standard deviation to isolate the card from the semi-rigid holder. Correctly ignores "Gem Mint" text spikes. Removes 16-42% of holder/scanner area depending on card type. Applies Scanner Fix preset. Integrated in `/cards/analyze` and `/cards/batch-upload-queue` via `scanner_mode: true`.
- **Listings Cache (DONE)** — Stale-while-revalidate for eBay listings
- **Listings Image Optimization (DONE)** — eBay images s-l400
- **Auto-Backfill Thumbnails (DONE)**
- **ListingsModule & InventoryModule Updated (DONE)** — Use thumbnails

## Architecture
```
/app/
├── backend/
│   ├── routers/ (cards.py, ebay.py, inventory.py, shop.py, auth.py, etc.)
│   ├── utils/image.py  # scanner_auto_process with _find_largest_block
│   └── utils/ai.py
├── frontend/src/
│   ├── components/ (InventoryModule, ListingsModule, CardScanner, etc.)
│   └── pages/ (Dashboard, MarketplacePage, ShopPage)
├── build_prod.sh  # CRITICAL: Always use for frontend builds
```

## Key API Endpoints
- `POST /api/cards/analyze` — AI card analysis (supports scanner_mode)
- `POST /api/cards/batch-upload-queue` — Fast upload with background processing
- `POST /api/cards/test-scanner-crop` — Test scanner crop endpoint
- `GET /api/ebay/seller/my-listings` — Stale-while-revalidate cached listings
- `GET /api/inventory` — Lightweight, thumbnails only
- `GET /api/inventory/{id}` — Full item with heavy images

## Next Priority
- **P0:** Stripe Production Integration (Rookie, MVP $14.99, Hall of Famer $19.99)
- **P1:** Whatnot & Shopify Integration (Legend tier)

## Backlog
- **P2:** Seller Hub (Dashboard de Ventas, Order Management, Best Offer Manager)
- **P3:** Direct purchase on FlipSlab (Stripe)
- **P4:** New User Onboarding wizard
- **P5:** Flip Finder Core Logic Enhancements
- **P6:** Windows Scanner App
- **P7:** Team Access (Legend tier)
- **P8:** Refactor InventoryModule.jsx (~1530 lines) & ListingsModule.jsx (~1330 lines)
