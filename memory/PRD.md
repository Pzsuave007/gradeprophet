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
