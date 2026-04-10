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
│   │   ├── ebay.py            # eBay listings, sync, promoted listings, bulk actions, Chase Packs
│   │   ├── admin.py           # Admin panel APIs
│   │   ├── subscription.py    # Plans & billing
│   │   ├── settings.py        # User settings
│   │   ├── shop.py            # Shop/storefront + public chase packs endpoint
│   │   ├── marketplace.py     # Marketplace + public chase packs endpoint
│   │   └── flipfinder.py      # Flip finder/sniper
│   ├── utils/
│   │   ├── image.py           # scanner_auto_process, collage generators (2 cards per row)
│   │   ├── ai.py              # AI card identification (now extracts team)
│   │   └── ebay.py            # eBay OAuth & token management
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CreateListingView.jsx  # Bulk eBay listing publisher
│   │   │   ├── InventoryModule.jsx    # Card inventory management
│   │   │   ├── ListingsModule.jsx     # eBay listings + campaigns
│   │   │   ├── ChasePacksModule.jsx   # Chase Pack management (wizard, inline editing, tier selectors)
│   │   ├── pages/
│   │   │   ├── AdminPage.jsx          # Admin panel (redesigned)
│   │   │   ├── ChaseRevealPage.jsx    # Public chase pack reveal page
│   │   │   ├── Dashboard.jsx          # Main dashboard with Chase Packs routing
│   │   │   ├── ShopPage.jsx           # Public store with Chase Pack banner
│   │   │   ├── MarketplacePage.jsx    # Marketplace with Chase Packs section
├── build_prod.sh              # Frontend build script (ALWAYS use this)
├── fix.sh                     # User's deploy script
├── AGENT_RULES.md             # Critical rules for agents
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
- **Collage Grid**: All collage functions use 2 cards per row for eBay images.
- **Chase Pack eBay Listing**: Uses multipart upload helper, CDATA description, ConditionDescriptor Name/Value format, PostalCode/Location.

## CRITICAL BUILD RULES (READ BEFORE EVERY BUILD)
- **NEVER run `craco build` or `yarn build` directly**. ALWAYS use `bash /app/build_prod.sh`
- Production URL is `https://flipslabengine.com` — this MUST be baked into the frontend build
- The `.env` file has the Emergent preview URL for local testing ONLY
- `build_prod.sh` overrides REACT_APP_BACKEND_URL to the production URL
- **DO NOT change auth.py Google OAuth endpoints**
- `ensure_admin_password()` in server.py fixes admin password on every startup

## Completed Features

### Session - Feb 2026 (Pick Your Card Feature + Bulk Savings)
- New "Pick Your Card" multi-variation listing
- "Set All Prices" bulk button + individual price editing per card
- **Bulk Savings (Volume Discount)**: Configurable tiers via eBay Marketing API

### Session - Feb 2026 (Create Lot Feature + Fix)
- Backend logic for "Create Lot" (Collage generator, new eBay lot endpoint)
- Frontend `CreateLotView` with correct eBay CONDITIONS and SHIPPING_OPTIONS

### Session - Feb 2026 (eBay Cassini SEO)
- Expanded Item Specifics for new eBay listings (20+ fields)

### Session - Feb 2026 (Promoted Listings Standard)
- Campaign Management: Create, pause, resume, end, delete PLS campaigns

### Session - Feb 2026 (UI/UX Improvements + Admin Fixes)
- Bulk action buttons always visible, auto-refresh
- Admin Panel redesigned, subscription migration

### Session - Feb 2026 (Store Promotions Management + Login Fix)
- Store Promotions lifecycle management via eBay Marketing API
- Permanent Login Fix with `ensure_admin_password()` on startup

### Session - Apr 2026 (Chase Card Pack Feature - Full)
- Chase Card Pack listing type with smart pricing, collage generation
- Buyer Reveal Page at `/chase/{packId}` with animated card reveal + 3-tier celebrations
- ChasePacksModule wired into Dashboard: inline editing, tier selectors, buyer grid
- 3-Step Creation Wizard: Select Cards → Set Tiers → Details & Create
- Background Sales Monitor: polls eBay every 60s, auto-assigns buyers, sends eBay messages
- Auto-Pricing: card_value + 30% profit + 13% eBay fees

### Session - Apr 2026 (Chase Pack eBay Fixes + Store/Marketplace Feature)
- **Fixed eBay image upload**: Switched from raw binary to multipart/form-data helper
- **3 tier collages uploaded**: Chase, Mid, Base tier images + individual card photos (up to 12)
- **Rich HTML description**: Detailed explanation of how Chase Pack works, wrapped in CDATA
- **Fixed ConditionDescriptors**: Correct Name/Value XML format (was using wrong tags)
- **Added missing eBay fields**: CategoryMappingAllowed, PostalCode, Location, currencyID
- **Collage grid**: 2 cards per row in all collage functions
- **Buyer message updated**: Full reveal URL for easy copy-paste
- **Frontend sends tiers** to backend at creation time
- **Store Chase Pack Banner**: Hero banner in ShopPage showing featured active pack with progress bar
- **Marketplace Chase Packs Section**: Horizontal scroll of chase pack cards with images, prices, spots remaining
- **Public API endpoints**: `GET /api/shop/{slug}/chase-packs` and `GET /api/marketplace/chase-packs`

## Next Priority
- **P0:** Stripe Production Integration (Rookie, MVP $14.99, Hall of Famer $19.99)
- **P1:** Whatnot & Shopify Integration

## Future/Backlog
- P2: Chase Pack Phase 2 - Direct Purchase on FlipSlab via Stripe
- P3: Seller Hub Features (Sales Dashboard, Order Management, Best Offer Manager)
- P4: New User Onboarding (Setup wizard)
- P5: "Flip Finder" Core Logic Enhancements
- P6: Windows Scanner App
- P7: Team Access (Legend tier)
- P8: Refactor InventoryModule.jsx & ListingsModule.jsx (both very large)

## 3rd Party Integrations
- OpenAI GPT-4o — User API Key
- eBay Trading API (XML) + Marketing API (REST) — User API Key
- Stripe (Payments) — User API Key

## DB Schema Key Fields
- `inventory`: image, thumbnail, store_thumbnail, back_image, back_thumbnail, year, set_name, variation, player, sport, team, grading_company, ebay_item_id
- `listings_cache`: user_id, active (array), sold (array), active_total, sold_total, cached_at
- `subscriptions`: user_id, plan_id (rookie|mvp|hall_of_famer), status
- `chase_packs`: pack_id, user_id, ebay_item_id, title, price, total_spots, cards (array with claim_code, assigned_to, revealed, tier, is_chase), status, created_at
- `card_analyses`: user_id, card_name, created_at (AI analysis records)

## Key API Endpoints
- `POST /api/ebay/sell/create-chase-pack` — Create and list chase pack on eBay
- `POST /api/ebay/sell/chase-preview` — Generate 3 tier collage previews
- `POST /api/ebay/chase/{pack_id}/assign` — Manually assign buyer to spot
- `POST /api/ebay/chase/{pack_id}/reveal` — Public: buyer reveals card with code
- `GET /api/shop/{slug}/chase-packs` — Public: active chase packs for a store
- `GET /api/marketplace/chase-packs` — Public: all active chase packs
