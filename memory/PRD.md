# FlipSlab Engine - Product Requirements Document

## Product Overview
FlipSlab Engine is a card management and selling platform for sports card collectors/sellers. AI-powered card scanning, inventory management, eBay listing creation, scheduled posting, auctions, and promotional tools.

## Core Architecture
```
/app/
├── backend/
│   ├── routers/
│   │   ├── ebay.py            # eBay listings, sync, promoted listings, Chase Packs, Best Offer rules
│   │   ├── schedule.py        # Schedule Posting + Strategy Launcher + background worker
│   │   ├── inventory.py       
│   │   ├── settings.py        # User settings incl. best_offer_auto_decline/accept_pct
│   │   ├── shop.py, marketplace.py, admin.py, subscription.py, flipfinder.py
│   ├── utils/ (image.py, ai.py, ebay.py, market.py)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ScheduleModule.jsx       # Schedule Posting with Strategy Launcher integration
│   │   │   ├── StrategyLauncher.jsx     # NEW: eBay Strategy Launcher (3-step wizard)
│   │   │   ├── ChasePacksModule.jsx
│   │   │   ├── InventoryModule.jsx
│   │   │   ├── ListingsModule.jsx       # Bulk Best Offer with editable % rules
│   │   │   ├── AccountModule.jsx        # Best Offer Rules section
│   │   ├── pages/
│   │   │   ├── ChaseRevealPage.jsx
│   │   │   ├── ShopPage.jsx, MarketplacePage.jsx, Dashboard.jsx
├── build_prod.sh, fix.sh, AGENT_RULES.md
```

## Best Offer Auto-Accept/Auto-Decline Rules
- User sets percentages in Account → "Best Offer Rules" section
- `auto_decline_pct` (e.g. 70): reject offers below 70% of price
- `auto_accept_pct` (e.g. 10): accept offers within 10% of price
- Automatically applied to new listings with Best Offer enabled
- Bulk apply to selected listings in Listings module (with editable percentages)
- Bulk apply to ALL active listings from Account
- Uses eBay `<MinimumBestOfferPrice>` and `<BestOfferAutoAcceptPrice>` with `currencyID="USD"`

## eBay Strategy Launcher
- 3-step wizard in Schedule tab:
  1. Select cards from unlisted inventory
  2. Pick which cards are auctions (tap to toggle) + set prices (auto-lookup or manual)
  3. Configure settings (auction start %, decline %, accept %, batch size) + launch
- Auctions: 1/day, 7-day duration, starting bid = X% of comp
- Fixed Price: batches of N/day, Best Offer enabled with auto-decline/accept rules
- All scheduled at 7pm Central (midnight UTC)
- Endpoint: `POST /api/schedule/launch-strategy`

## Listing Title Format
- Player name FIRST, then card details: "Stephen Curry 2024 Topps Chrome #45"
- Applied in `generate_listing_title()` in ebay.py and used by schedule worker

## Key API Endpoints
- `POST /api/schedule/launch-strategy` — Launch eBay strategy
- `POST /api/schedule/add-bulk` — Schedule multiple cards
- `POST /api/ebay/sell/bulk-apply-offer-rules` — Apply Best Offer rules to selected listings
- `POST /api/ebay/sell/bulk-update-best-offer-rules` — Apply rules to ALL active listings
- `PUT /api/settings` — Save best_offer_auto_decline_pct, best_offer_auto_accept_pct
- `POST /api/ebay/sell/create` — Create listing (auto-applies Best Offer rules)

## Completed Features (Apr 2026)
- Best Offer Auto-Decline/Auto-Accept Rules (settings + apply to new + bulk update)
- eBay Strategy Launcher (3-step wizard, auctions + fixed price scheduling)
- Player name first in listing titles
- Schedule Posting with dual queues (Fixed Price + Auctions)
- Pick Your Card flow for Chase Packs
- Chase Packs in Store + Marketplace
- eBay listing auto-end on pack End/Delete
- Collection option removed from inventory
- Rich HTML description for eBay listings
- **Apr 19 2026**: Fixed Schedule Queue disappearing bug — cards persist across tab navigation.
- **Apr 20 2026**: Fixed auction/fixed-price stacking bug in `/api/schedule/add-bulk` — separate calls now correctly compute next free slot based on existing pending/processing posts (auctions: +1 day each; fixed price: fills day up to batch_size then rolls over).
- **Apr 20 2026**: Fixed card "returning to inventory" bug — `/api/inventory/stats` and `/api/schedule/sync-scheduled-flags` auto-sync was wiping `scheduled=True` flag on cards whose posts moved from `pending` → `failed`. Now treats `failed` posts as still-scheduled so the card stays in the Schedule tab until the user retries or deletes manually.
- **Apr 20 2026**: Added **Retry** button on failed posts (`POST /api/schedule/{post_id}/retry`) → reschedules ~2 min from now and resets status to `pending`. Added **Clear Failed** bulk action (`DELETE /api/schedule/bulk/clear-failed?queue_type=…`) to clean up history. Individual delete icon also available per failed post.
- **Apr 20 2026**: Prevented past-dating of schedules — `/api/schedule/add-bulk` now rolls `start_day` forward by full days whenever the chosen start/hour is already in the past, so the worker never processes an auction/listing instantly on refresh. Worker now also clears `scheduled=False` on successful post, giving a clean Schedule → Listings transition.
- **Apr 20 2026**: Fixed CT→UTC date conversion for late-evening hours. Previously, picking `start_date = today` + `post_hour = 9pm CT` computed a UTC timestamp **on the wrong UTC calendar day** (the 5-hour offset rolls into next UTC day). This made the "past-date protection" incorrectly push valid future schedules to tomorrow. Now `add-bulk`, `launch-strategy` both apply a `day_shift = (hour + 5) // 24` so same-day evening schedules land correctly.
- **Apr 20 2026**: Fixed frontend default `start_date` in `AddToScheduleView` — previously used `new Date().toISOString()` which returns UTC date. When user is in CT at 7pm+, UTC is already "tomorrow", so the picker showed tomorrow's CT date as default. Now defaults to today's **CT date** (shift `-5h` before split).
- **Apr 20 2026**: Made `/api/schedule/add-bulk` backend robust to old frontend caches. Uses real Python `timezone(-5h)` and detects when the sent `start_date` matches UTC-today while CT is still yesterday (= browser cache sending UTC date instead of CT) and auto-corrects to CT-today. Same-day evening scheduling now works regardless of which frontend version the browser has cached.
- **Apr 20 2026**: Fixed edge case where 2 auctions added in separate bulk calls with different `post_minute` ended up on the same day (violating the 1/day auction rule). The existing-post check was comparing by full datetime instead of just by date → minutes were skipping the check. Now compares `ed.date() >= start_day.date()` so the second auction correctly rolls to the next day.

## Next Priority
- **P0:** Stripe Production Integration (Rookie, MVP $14.99, Hall of Famer $19.99)
- **P1:** Whatnot & Shopify Integration

## Future/Backlog
- P2: Chase Pack Phase 2 - Direct Purchase via Stripe
- P3: Seller Hub Features (Sales Dashboard, Order Management)
- P4: New User Onboarding
- P5-P8: Flip Finder, Windows Scanner, Team Access, Refactoring

## 3rd Party Integrations
- OpenAI GPT-4o, eBay Trading API + Marketing API, Stripe (upcoming)
