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
- **Custom Global Presets (Admin)**: Admin can create, edit, delete photo presets from Admin Panel. These presets appear for ALL users in the Photo Editor alongside default presets.
- **Photo Editor Mixer**: Full manual control panel with 7 individual sliders (Brightness, Contrast, Shadows, Highlights, Saturation, Temperature, Sharpness)
- **Auth Bug Fix**: Fixed `ValueError: day is out of range for month` in session expiry calculation (replaced `.replace(day=)` with `timedelta`)
- **Test Login**: Added password hash to Google Auth user for email/password login testing

## Architecture
```
/app/
├── backend/routers/
│   ├── marketplace.py     # Public marketplace API
│   ├── ebay.py            # eBay listing/revise/bulk shipping + cert_number support
│   ├── inventory.py       # Inventory CRUD with cert_number field
│   ├── cards.py           # AI card analysis/identify/scan with cert_number extraction
│   ├── shop.py, auth.py, settings.py, admin.py, etc.
│   └── utils/ai.py        # AI prompts including cert_number in CARD_IDENTIFY_PROMPT
├── frontend/src/
│   ├── pages/
│   │   ├── MarketplacePage.jsx
│   │   ├── ShopPage.jsx, Dashboard.jsx
│   ├── components/
│   │   ├── InventoryModule.jsx  # Edit form with cert_number, detail display
│   │   ├── ListingsModule.jsx   # Listing detail with cert_number display
│   │   ├── CreateListingView.jsx # Passes cert_number to eBay create
│   │   ├── LandingPage.jsx
│   └── App.js
```

## Key API Endpoints
- `GET /api/marketplace` - Public: all listed cards
- `POST /api/ebay/sell/create` - Create eBay listing (accepts cert_number)
- `POST /api/ebay/sell/bulk-revise-shipping` - Bulk update shipping
- `GET /api/inventory` - Get inventory items (includes cert_number)
- `POST /api/inventory` - Create inventory item (accepts cert_number)
- `PUT /api/inventory/{id}` - Update inventory item (accepts cert_number)
- `POST /api/cards/identify` - AI card identification (returns cert_number for graded)
- `POST /api/cards/scan-upload` - Scanner upload (saves cert_number)
- `POST /api/cards/batch-upload-queue` - Fast upload: stores raw images, AI processes in background
- `GET /api/cards/batch-queue-status` - Status of queued batch cards

## Key DB Schema
- **inventory**: `cert_number: Optional[str]`, `card_value: float`, standard card fields
- **card_analyses**: `psa_cert_number: Optional[str]`

## Recent Changes (Feb 2026 - Payload Optimization)
- **Inventory Lazy Image Loading (DONE)** — Backend `GET /api/inventory` now excludes heavy `image` and `back_image` base64 fields (100KB+ each) via MongoDB projection. Returns only lightweight `thumbnail` (~20KB) and `store_thumbnail` (~47KB WebP). Full images are lazy-loaded from `GET /api/inventory/{item_id}` when CardDetailModal opens.
- **Auto-Backfill Thumbnails (DONE)** — When GET /api/inventory detects items missing thumbnails, automatically triggers a background task to generate them. First load may show placeholders, subsequent loads show thumbnails. Prevents the "no images" issue on existing production data.
- **Thumbnail Backfill Endpoint Enhanced (DONE)** — `POST /api/inventory/generate-store-thumbnails` now backfills all missing thumbnail types (thumbnail, store_thumbnail, back_thumbnail) for existing items.
- **ListingsModule & InventoryModule Updated (DONE)** — All frontend references to `item.image`/`item.back_image` in list/grid views updated to use `item.thumbnail`/`item.store_thumbnail`. CardDetailModal lazy-loads full images. Edit form shows thumbnail preview.

## Next Priority
- **P0:** Stripe Production Integration
- **P1:** Whatnot & Shopify Integration (Legend tier)

## Recent Changes (This Session)
- **Batch Upload → Queue Architecture (Feb 2026)** — Complete rewrite of the batch upload flow:
  - **Before**: Phone waited for each card to be processed (compress + AI identify + save) = 30-60s per card. Phone had to stay awake the entire time.
  - **After**: Phone ONLY uploads raw images (fast, seconds per card). Server stores images in `batch_queue` collection and processes them in background (`asyncio.create_task`). Phone can sleep after upload.
  - **New endpoint**: `POST /api/cards/batch-upload-queue` — stores raw images, returns immediately, kicks off background AI processing
  - **New endpoint**: `GET /api/cards/batch-queue-status` — shows status of queued cards
  - **Background task**: `_process_queued_card()` — compresses, AI identifies, saves to inventory, cleans up raw data from queue
  - **Frontend**: Files buffered into JS heap on selection. Upload shows only file transfer progress. "Upload Complete" screen tells user cards are being processed in background.
  - Status: PENDING USER MOBILE VERIFICATION
- **Bug Fix: False Sold Items** — Items were incorrectly marked as "sold" in inventory when eBay's `GetMyeBaySelling` API returned paginated results (only first 200). Items beyond page 1 were flagged as "sold" by aggressive cross-reference logic. **Fix:** Now ONLY marks items as sold if confirmed in eBay's `SoldList`. Never marks items sold just because they're absent from `ActiveList`.
- **Listings Pagination ("Load More")** — Changed from loading 200 items at once to loading 50 at a time with a "Load More" button. Both Active and Sold tabs support incremental loading. Shows "X of Y listings" counter.
- **New endpoint `POST /api/ebay/fix-false-sold`** — Queries ALL pages of eBay active listings and restores inventory items that were incorrectly marked as sold. Has a "Fix Sold" button in Listings UI.
- **Server Memory Optimization** — Created scripts: `setup_swap.sh` (2GB swap), `optimize_server.sh` (SpamAssassin 5→2, Apache 6→3), `check_memory.sh` (health monitor). Result: RAM usage dropped from 2.4GB to 1.7GB, available went from 306MB to 1.8GB.

## Backlog
- **P2:** Direct purchase on FlipSlab
- **P3:** New User Onboarding wizard
- **P4:** Flip Finder Core Logic Enhancements
- **P5:** Windows Scanner App
- **P6:** Team Access (Legend tier)
- **P7:** Refactor InventoryModule.jsx (~1530 lines) & ListingsModule.jsx (~1330 lines)
