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
│   │   │   ├── ChasePacksModule.jsx   # Chase Pack management (inline editing, tier selectors, buyer grid)
│   │   ├── pages/
│   │   │   ├── AdminPage.jsx          # Admin panel (redesigned)
│   │   │   ├── ChaseRevealPage.jsx    # Public chase pack reveal page
│   │   │   ├── Dashboard.jsx          # Main dashboard with Chase Packs routing
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
- Combined front+back images side by side, max 4 cards per collage, max 15 cards per lot

### Session - Feb 2026 (eBay Cassini SEO)
- Expanded Item Specifics for new eBay listings (20+ fields)
- `build_item_specifics()` helper, `extract_manufacturer()`, bulk revise specifics

### Session - Feb 2026 (Promoted Listings Standard)
- Campaign Management: Create, pause, resume, end, delete PLS campaigns
- Bulk Promote/Remove, Campaign View, AD Badge

### Session - Feb 2026 (UI/UX Improvements)
- Bulk action buttons always visible, auto-refresh on tab visibility
- Admin Panel redesigned: large user cards, text labels, clickable plan badges

### Session - Feb 2026 (Admin Fixes)
- Fixed valid_plans, PLAN_ALIASES, migrated DB subscriptions, fixed stats

### Session - Feb 2026 (Store Promotions Management + Login Fix)
- Store Promotions lifecycle management via eBay Marketing API
- Permanent Login Fix with `ensure_admin_password()` on startup

### Session - Feb 2026 (Chase Card Pack Feature)
- Chase Card Pack listing type with smart pricing, collage generation
- Buyer Reveal Page at `/chase/{packId}` with animated card reveal
- Seller Management: assign buyers, generate claim codes, track progress
- End Listing Fix: cards return to inventory

### Session - Apr 2026 (Chase Packs Management Tab) - COMPLETE
- **ChasePacksModule wired into Dashboard** as new sidebar tab
- Pack list view with stats (Active Packs, Spots Sold, Revenue, Completed)
- **Full Management Controls**: Edit title/price, Pause/Resume/End/Delete pack, Unassign buyers, Regenerate claim codes, Change chase card, Sync to eBay
- **Inline Editing**: Click-to-edit Title and Price (Save/Cancel buttons, Enter/Escape keyboard shortcuts) - VERIFIED WORKING Apr 2026
- **2-Column Buyer Grid**: Thumbnails, buyer names, codes, status, action buttons
- **Tier Management**: Manual Chaser/Mid/Base tier assignment per card
- **Spot Tracker (Mini Slabs)**: Visual mini-slab cards on public page with Framer Motion 3D flip

### Session - Apr 2026 (Chase Reveal Page Redesign)
- **Responsive Layout**: Redesigned ChaseRevealPage for desktop/tablet - bigger chasers, centered layout, horizontal spot tracker + store info side by side on desktop
- **3-Tier Celebration System**: CelebrationEffect component with confetti particles
  - Base (low): 25 silver/white sparkles, subtle celebration
  - Mid: 55 blue/purple confetti pieces + blue screen flash
  - Chase: 110 gold/orange/red confetti storm + golden screen flash + pulsing ring
- **Backend Fix**: Added `tier` field to reveal endpoint response so celebration tier is correctly detected
- **Better Spacing**: More padding on desktop/tablet, bigger card grids, better visual hierarchy
- **Mobile Fixes (Apr 2026)**: 
  - Claim code input + REVEAL button stack vertically on mobile (no overflow)
  - Spinning card now has front + back face (always visible during rotation, never disappears)
  - Spin card sized appropriately per breakpoint (48x272 mobile, 56x320 sm, 64x360 md)
  - Chaser cards use 85vw on mobile for better visual impact
  - Compact spacing on mobile (smaller padding, smaller spot tracker slots)
- Frontend compiled with `build_prod.sh`

### Session - Apr 2026 (Chase Pack Auto-Sales Monitor + Buyer Messaging)
- **Background Sales Monitor**: Polls eBay every 60 seconds for new Chase Pack transactions
  - Uses `GetItemTransactions` Trading API to detect new sales
  - Auto-assigns buyer to next available spot + generates claim code
  - Handles multi-quantity purchases (buyer buys 3 spots = 3 separate codes)
  - Tracks processed transactions to avoid duplicates
- **eBay Buyer Messaging**: Uses `AddMemberMessageAAQToPartner` Trading API
  - Sends buyer their claim code(s) + reveal page link
  - Single message for multi-quantity purchases with all codes listed
- **"Check Sales" button** in pack detail view (active packs only) for manual trigger
- **"Auto-monitor active" indicator** in Chase Packs header with green pulsing dot
- **Manual endpoint**: `POST /api/ebay/chase/check-sales`
- Frontend compiled with `build_prod.sh`

### Session - Apr 2026 (Chase Pack Creation Wizard)
- **"New Pack" button** added to Chase Packs module header
- **3-Step Wizard**: Select Cards → Set Tiers → Details & Create
  - Step 1: Grid of unlisted inventory cards with search, click to select/deselect, minimum 10 cards
  - Step 2: Tap cards to cycle tier (Base → Mid → Chaser), shows tier summary counts
  - Step 3: Auto-generated title, price/spot, shipping options, summary box, "Create & List on eBay" button
- Auto-assigns first card as Chaser, rest as Base by default
- Calls existing `/sell/create-chase-pack` + `/update-tiers` endpoints
- Frontend compiled with `build_prod.sh`

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
- `chase_packs`: pack_id, user_id, ebay_item_id, title, price, total_spots, cards (array with claim_code, assigned_to, revealed, tier), status, created_at
- `card_analyses`: user_id, card_name, created_at (AI analysis records)
