# FlipSlab Engine - Product Requirements Document

## CRITICAL DEPLOYMENT INFO (DO NOT SKIP)
- **Production URL:** `https://flipslabengine.com`
- **Production REACT_APP_BACKEND_URL:** `https://flipslabengine.com`
- **User's deploy process:** Push to GitHub -> `git pull` on server -> `bash fix.sh`
- **fix.sh copies `frontend/build/*`** to the web root — **NEVER builds on server**
- **EVERY TIME frontend changes are made:** Run `bash /app/build_prod.sh`
- **The `frontend/build/` folder MUST be committed to git**
- **Server OS:** AlmaLinux/cPanel VPS on GoDaddy, 3.6GB RAM + 2GB Swap
- **User language:** Spanish
- **Admin email:** pzsuave007@gmail.com (Google Auth)
- **Scanner token:** `scan_74b1544bdc4a4aa2b3fa9839c4e42f64`

## Original Problem Statement
Build a multi-tiered subscription model for the "FlipSlab Engine" sports card trading platform with admin panel, public Card Shop, eBay syncing, Social Post generator, and public Marketplace.

## Core Features Implemented
- Public Marketplace, Admin Panel, Public Card Shop, Social Post Editor
- Subscription System (4 tiers with Stripe)
- eBay Integration (Trading & Fulfillment APIs)
- AI Card Identification (OpenAI GPT-4o)
- Google Auth (Emergent-managed)
- Inventory with Sold Tab, Bulk Shipping, Price Lookup, Cert Number
- Custom Global Presets (Admin), Photo Editor Mixer (7 sliders)
- Batch Upload Queue (background processing)

## Recent Changes (This Session - Feb/Mar 2026)
- **Scanner Auto-Crop (DONE)** — Variance-based "largest contiguous block" algorithm crops semi-rigid holder edges. 4% margin to avoid cutting card. No color preset applied (user requested removal).
- **Back Image Thumbnail Fix (DONE)** — Scanner `/cards/scan-upload` now generates `back_thumbnail` when uploading back images.
- **Bulk Apply Preset (DONE)** — New feature: Select multiple cards → "Preset" button → choose preset (built-in or custom) → applies to front+back images → regenerates all thumbnails. Backend: `PUT /api/inventory/bulk-apply-preset`. Frontend: Orange "Preset" button in select mode toolbar with expandable panel.
- **OpenCV Production Fix (DONE)** — Created `instalar_opencv.sh` to install opencv-python-headless on production server.

## Architecture
```
/app/
├── backend/
│   ├── routers/ (cards.py, ebay.py, inventory.py, shop.py, auth.py, etc.)
│   ├── utils/image.py  # scanner_auto_process, _find_largest_block, _apply_preset_to_image
│   └── utils/ai.py
├── frontend/src/
│   ├── components/ (InventoryModule, ListingsModule, CardScanner, etc.)
│   └── pages/ (Dashboard, MarketplacePage, ShopPage)
├── build_prod.sh, fix.sh, restart_backend.sh, diagnostico.sh, instalar_opencv.sh
```

## Key API Endpoints
- `POST /api/cards/analyze` — AI card analysis (supports scanner_mode)
- `POST /api/cards/scan-upload` — Scanner upload with auto-crop
- `POST /api/cards/batch-upload-queue` — Fast upload with background processing
- `PUT /api/inventory/bulk-apply-preset` — Apply preset to multiple items (front+back+thumbnails)
- `PUT /api/inventory/bulk-update-condition` — Bulk update card condition
- `GET /api/ebay/seller/my-listings` — Stale-while-revalidate cached listings
- `GET /api/inventory` — Lightweight, thumbnails only

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
- **P8:** Refactor InventoryModule.jsx (~1950 lines) & ListingsModule.jsx (~1330 lines)
