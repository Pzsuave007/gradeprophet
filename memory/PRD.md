# FlipSlab Engine - Product Requirements Document

## CRITICAL DEPLOYMENT INFO (DO NOT SKIP)
- **Production URL:** `https://flipslabengine.com`
- **Production REACT_APP_BACKEND_URL:** `https://flipslabengine.com`
- **User's deploy process:** Push to GitHub -> `git pull` on server -> `bash fix.sh`
- **fix.sh copies `frontend/build/*`** to the web root — **NEVER builds on server**
- **NEVER run `yarn build` or `npm run build` on the production server** — it crashes due to limited RAM (3.6GB shared with MySQL, Apache, MongoDB, SpamAssassin)
- **EVERY TIME frontend changes are made:** Run `bash /app/build_prod.sh` — this script FORCES the production URL automatically. NEVER run `yarn build` directly. The script verifies no preview URL leaks into the build.
- **The `frontend/build/` folder MUST be committed to git** — the server pulls and copies these pre-built files directly
- **Server scripts:** `fix.sh` (backend+frontend copy), `deploy.sh` (alias), `fix_false_sold.sh`, `check_memory.sh`, `optimize_server.sh`, `setup_swap.sh`, `server_audit.sh`
- **Server OS:** AlmaLinux/cPanel VPS on GoDaddy, 3.6GB RAM + 2GB Swap
- **User language:** Spanish (comfortable in English too)
- **Admin email:** pzsuave007@gmail.com (Google Auth)
- **Scanner token:** `scan_74b1544bdc4a4aa2b3fa9839c4e42f64`

## Original Problem Statement
Build a multi-tiered subscription model for the "FlipSlab Engine" sports card trading platform with admin panel, public Card Shop, eBay syncing, Social Post generator, and public Marketplace.

## Core Features Implemented
- **Public Marketplace** (`/marketplace`): Aggregates all cards from all sellers, search, filters (sport, condition, seller, price sort), card modal with 3D flip/swipe, seller info, eBay buy links
- **Admin Panel** (`/admin`): Private route for admin
- **Public Card Shop** (`/shop/:slug`): Individual seller stores
- **Social Post Editor**: Full editor with presets, frames, icons, text, background colors
- **Subscription System**: 4 tiers with Stripe test keys
- **eBay Integration**: Trading & Fulfillment APIs
- **AI Card Identification**: OpenAI GPT-4o
- **Google Auth**: Emergent-managed
- **Inventory Sold Tab**: Auto-sync from eBay
- **Bulk Shipping Update**: Listings/Active + Inventory/Listed
- **Price Lookup Links**: eBay Sold + CardLadder (structured card data)
- **Listings Search + Sport Filter**: Search + auto-detect sport dropdown
- **Shipping Selection Fix**: React state race condition fixed
- **Cert Number Feature**: AI extracts cert # from graded card slabs, stored in inventory, displayed in detail views, passed to eBay as Item Specific
- **Custom Global Presets (Admin)**: Admin can create, edit, delete photo presets from Admin Panel
- **Photo Editor Mixer**: Full manual control panel with 7 sliders
- **Auth Bug Fix**: Fixed ValueError in session expiry calculation
- **Test Login**: Added password hash to Google Auth user for email/password login testing

## Payload Optimization (Feb 2026)
- **Inventory Lazy Image Loading (DONE)** — Backend excludes heavy base64 fields, returns only thumbnails. Full images lazy-loaded in modals.
- **Scanner Auto-Crop + Scanner Fix (DONE, VERIFIED Feb 2026)** — Variance-based crop using row/column standard deviation to detect card edges in scanner images. Removes scanner bed and top-loader borders. Applies Scanner Fix preset (brightness 1.12, contrast 0.95, saturation 1.20, shadow lift). Tested: 1435x715 -> 416x515 (79% area removed). Integrated in `/cards/analyze` and `/cards/batch-upload-queue` via `scanner_mode: true`.
- **Listings Cache (DONE)** — Stale-while-revalidate cache for eBay listings. Background refresh after 5 min.
- **Listings Image Optimization (DONE)** — eBay images reduced from s-l800 to s-l400.
- **Auto-Backfill Thumbnails (DONE)** — Background task generates missing thumbnails.
- **Thumbnail Backfill Endpoint Enhanced (DONE)** — Backfills all missing thumbnail types.
- **ListingsModule & InventoryModule Updated (DONE)** — All frontend views use thumbnails.

## Batch Upload Architecture (Feb 2026)
- Phone ONLY uploads raw images (fast). Server processes in background via `batch_queue` collection.
- `POST /api/cards/batch-upload-queue` — stores raw images, returns immediately
- `GET /api/cards/batch-queue-status` — shows status of queued cards
- Background: `_process_queued_card()` — compresses, AI identifies, saves to inventory

## Architecture
```
/app/
├── backend/routers/
│   ├── marketplace.py     # Public marketplace API
│   ├── ebay.py            # eBay listing/revise/bulk shipping + cert_number + stale-while-revalidate cache
│   ├── inventory.py       # Inventory CRUD with cert_number, auto-backfill thumbnails
│   ├── cards.py           # AI card analysis/identify/scan with scanner_auto_process
│   ├── shop.py, auth.py, settings.py, admin.py, etc.
│   └── utils/image.py     # Thumbnails, EXIF, scanner_auto_process (variance-based crop)
├── frontend/src/
│   ├── pages/
│   │   ├── MarketplacePage.jsx
│   │   ├── ShopPage.jsx, Dashboard.jsx
│   ├── components/
│   │   ├── InventoryModule.jsx  # Edit form with cert_number, detail display
│   │   ├── ListingsModule.jsx   # Listing detail with cert_number display
│   │   ├── CreateListingView.jsx # Passes cert_number to eBay create
│   │   ├── CardScanner.jsx       # Sends scanner_mode: true
│   │   ├── LandingPage.jsx
│   └── App.js
├── build_prod.sh           # CRITICAL: Always use for frontend builds
```

## Key API Endpoints
- `GET /api/marketplace` - Public: all listed cards
- `POST /api/ebay/sell/create` - Create eBay listing (accepts cert_number)
- `POST /api/ebay/sell/bulk-revise-shipping` - Bulk update shipping
- `GET /api/inventory` - Get inventory items (lightweight, thumbnails only)
- `GET /api/inventory/{id}` - Get full item with heavy images
- `POST /api/inventory` - Create inventory item
- `PUT /api/inventory/{id}` - Update inventory item
- `POST /api/cards/analyze` - AI card analysis (supports scanner_mode)
- `POST /api/cards/scan-upload` - Scanner upload
- `POST /api/cards/batch-upload-queue` - Fast upload with background processing
- `GET /api/cards/batch-queue-status` - Status of queued batch cards
- `POST /api/cards/test-scanner-crop` - Test scanner crop endpoint
- `GET /api/ebay/seller/my-listings` - Stale-while-revalidate cached listings

## Key DB Schema
- **inventory**: `cert_number`, `card_value`, `store_thumbnail`, `thumbnail`, `ebay_picture`, `image`, `back_image`
- **card_analyses**: `psa_cert_number`
- **listings_cache**: Cached eBay listings for instant loading
- **batch_queue**: Queued cards for background processing

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
