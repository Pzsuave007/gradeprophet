# FlipSlab Engine - Product Requirements Document

## CRITICAL DEPLOYMENT INFO (DO NOT SKIP)
- **Production URL:** `https://flipslabengine.com`
- **Production REACT_APP_BACKEND_URL:** `https://flipslabengine.com`
- **User's deploy process:** Push to GitHub -> `git pull` on server -> `bash fix.sh`
- **fix.sh copies `frontend/build/*`** to the web root — **NEVER builds on server**
- **NEVER run `yarn build` or `npm run build` on the production server** — it crashes due to limited RAM (3.6GB shared with MySQL, Apache, MongoDB, SpamAssassin)
- **EVERY TIME frontend changes are made:** Build locally in preview with `REACT_APP_BACKEND_URL=https://flipslabengine.com yarn build`, then commit `frontend/build/` to git. Then restore preview URL for local dev.
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

## Key DB Schema
- **inventory**: `cert_number: Optional[str]`, `card_value: float`, standard card fields
- **card_analyses**: `psa_cert_number: Optional[str]`

## Next Priority
- **P0:** Stripe Production Integration
- **P1:** Whatnot & Shopify Integration (Legend tier)

## Recent Changes (This Session)
- **Batch Upload Mobile Fix (Feb 2026)** — Root cause: mobile browsers invalidate File object references during long async operations (OpenAI calls take 30-60s/card). Fix: 
  1. **Frontend**: Files now immediately buffered into JS heap via `new File([arrayBuffer], ...)` on selection — immune to mobile OS reclamation
  2. **Frontend**: Added retry logic (2 attempts per card) for transient failures
  3. **Frontend**: Snapshot pairs array at upload start to prevent closure issues  
  4. **Backend**: Explicit memory cleanup (`del`, `gc.collect()`) after each card
  5. **Backend**: `form.close()` to release file handles between requests
  6. **Backend**: `asyncio.wait_for` timeout (120s) on OpenAI calls to prevent hangs
  7. **Frontend**: Added "buffering" loading state when reading files from device
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
