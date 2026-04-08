# FlipSlab Engine - Product Requirements Document

## Product Overview
FlipSlab Engine is a card management and selling platform for sports card collectors/sellers. It provides AI-powered card scanning, inventory management, eBay listing creation, and promotional tools.

## Core Architecture
```
/app/
├── backend/
│   ├── routers/
│   │   ├── cards.py           # Single item uploads, eBay XML generation
│   │   ├── inventory.py       # Batch uploads, saves, queues
│   │   ├── ebay.py            # eBay listings, sync, promoted listings, bulk actions
│   │   ├── admin.py           # Admin panel APIs
│   │   ├── subscription.py    # Plans & billing
│   │   ├── settings.py        # User settings
│   │   ├── shop.py            # Shop/storefront
│   │   └── flipfinder.py      # Flip finder/sniper
│   ├── utils/
│   │   ├── image.py           # scanner_auto_process (fixed crop)
│   │   ├── ai.py              # AI card identification (now extracts team)
│   │   └── ebay.py            # eBay OAuth & token management
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CreateListingView.jsx  # Bulk eBay listing publisher
│   │   │   ├── InventoryModule.jsx    # Card inventory management
│   │   │   ├── ListingsModule.jsx     # eBay listings + campaigns
│   │   ├── pages/
│   │   │   ├── AdminPage.jsx          # Admin panel (redesigned)
├── build_prod.sh              # Frontend build script
├── fix.sh                     # User's deploy script
```

## Subscription Plans (Current)
- **Rookie** (Free)
- **MVP** ($14.99/mo)
- **Hall of Famer** ($19.99/mo)
- Old plan IDs migrated: all_star→mvp, hall_of_fame→hall_of_famer, legend→hall_of_famer

## Key Technical Decisions
- **Fixed Auto-Crop**: Top 240px, Left/Right/Bottom 40px. DO NOT revert to AI/Canny detection.
- **eBay XML payloads**: Uses Trading API (XML) for listings, Marketing API (REST) for promotions.
- **Auth**: Google Auth. DO NOT modify auth system.
- **AI Team Extraction**: CARD_IDENTIFY_PROMPT now includes "team" field.

## Completed Features

### Session - Feb 2026 (Create Lot Feature + Fix)
- Backend logic for "Create Lot" (Collage generator in `image.py`, new eBay lot endpoint)
- Frontend `CreateLotView` full-page component (replaced popup modal) with correct eBay CONDITIONS (400010-400013) and SHIPPING_OPTIONS (Free/PWE/FirstClass/Priority)
- Backend: Fixed ConditionID to use 4000 + ConditionDescriptors (matching single-listing flow), fixed shipping XML (FreeShipping/PWEEnvelope handling)
- **Fixed P0 crash**: `CreateLotModal` was rendered in wrong scope. Converted to full-page `CreateLotView`.

### Session - Feb 2026 (eBay Cassini SEO)
- Expanded Item Specifics for new eBay listings (20+ fields): Type, Year Manufactured, Card Size, Country, Language, Original/Reprint, Vintage, Autographed, Card Name, League, Manufacturer, Parallel/Variety, Features, Custom Bundle, Material, Team, Print Run, Signed By
- `build_item_specifics()` helper in ebay.py
- `extract_manufacturer()` to parse brand from set_name
- `POST /api/ebay/sell/bulk-revise-specifics` endpoint for bulk updating existing listings
- "Specifics" bulk action button in ListingsModule.jsx
- Fixed Signed By (always = player name), Team (from inventory), Print Run (from /XX in variation)
- Updated AI prompt to extract `team` field, added `team` to inventory models

### Session - Feb 2026 (Promoted Listings Standard)
- **Campaign Management**: Create, pause, resume, end, delete PLS campaigns
- **Bulk Promote/Remove**: Add/remove listings from campaigns in bulk
- **Campaign View**: Grid view of promoted listings with ad rate, status, and remove button
- **AD Badge**: Orange "AD" badge on promoted listings in the main grid
- **Endpoints**: GET /promoted/campaigns, POST /promoted/create-campaign, POST /promoted/bulk-add, POST /promoted/bulk-remove, GET /promoted/campaign/{id}/ads, POST /promoted/campaign/{id}/pause|resume|end, DELETE /promoted/campaign/{id}, POST /promoted/campaign/{id}/remove-ads

### Session - Feb 2026 (UI/UX Improvements)
- Bulk action buttons (Shipping, Condition, Best Offer, Specifics, Promote) always visible in both ListingsModule and InventoryModule (disabled until Select mode)
- Auto-refresh on browser tab visibility change (not polling timer)
- CreateListingView calls onSuccess() after publishing to refresh data
- Admin Panel completely redesigned: large user cards, text labels on all buttons, clickable plan badges, stats grid, plan distribution bars, confirm modals, 3 clear tabs (Users/Transactions/Presets)

### Session - Feb 2026 (Admin Fixes)
- Fixed valid_plans from old 4-plan to new 3-plan system
- Fixed PLAN_ALIASES: hall_of_fame→hall_of_famer (was incorrectly mvp)
- Migrated all DB subscriptions to new plan IDs
- Fixed admin stats to normalize old plan IDs
- Fixed Scans count: now = inventory count (every card scanned by AI)
- Fixed Listings count: now uses listings_cache.active_total (synced from eBay)
- Added Total eBay Listings to global stats

## Next Priority
- **P0:** Stripe Production Integration (Rookie, MVP $14.99, Hall of Famer $19.99)
- **P1:** Whatnot & Shopify Integration

## Future/Backlog
- P2: Seller Hub Features (Sales Dashboard, Order Management, Best Offer Manager)
- P3: Direct Purchase on FlipSlab (Stripe direct buys)
- P4: New User Onboarding (Setup wizard)
- P5: "Flip Finder" Core Logic Enhancements
- P6: Windows Scanner App
- P7: Team Access
- P8: Refactor InventoryModule.jsx & ListingsModule.jsx (both very large)

## 3rd Party Integrations
- OpenAI GPT-4o — User API Key
- eBay Trading API (XML) + Marketing API (REST) — User API Key
- Stripe (Payments) — User API Key

## DB Schema Key Fields
- `inventory`: image, thumbnail, store_thumbnail, back_image, back_thumbnail, year, set_name, variation, player, sport, team, grading_company, ebay_item_id
- `listings_cache`: user_id, active (array), sold (array), active_total, sold_total, cached_at
- `subscriptions`: user_id, plan_id (rookie|mvp|hall_of_famer), status
- `card_analyses`: user_id, card_name, created_at (AI analysis records)
