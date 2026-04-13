# FlipSlab Engine - Product Requirements Document

## Product Overview
FlipSlab Engine is a card management and selling platform for sports card collectors/sellers. AI-powered card scanning, inventory management, eBay listing creation, scheduled posting, auctions, and promotional tools.

## Core Architecture
```
/app/
├── backend/
│   ├── routers/
│   │   ├── ebay.py            # eBay listings, sync, promoted listings, Chase Packs
│   │   ├── schedule.py        # Schedule Posting (fixed price + auction queues + background worker)
│   │   ├── inventory.py       # Batch uploads, saves, queues
│   │   ├── shop.py            # Shop/storefront + public chase packs
│   │   ├── marketplace.py     # Marketplace + public chase packs
│   │   ├── admin.py, subscription.py, settings.py, flipfinder.py
│   ├── utils/ (image.py, ai.py, ebay.py)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ScheduleModule.jsx    # Schedule Posting (2 queues, add-to-schedule, timeline)
│   │   │   ├── ChasePacksModule.jsx  # Chase Pack management
│   │   │   ├── InventoryModule.jsx   # Card inventory (Collection option removed)
│   │   ├── pages/
│   │   │   ├── ChaseRevealPage.jsx   # Pick Your Card flow
│   │   │   ├── ShopPage.jsx, MarketplacePage.jsx, Dashboard.jsx
├── build_prod.sh, fix.sh, AGENT_RULES.md
```

## Schedule Posting Feature
- Two separate queues: Fixed Price and Auctions
- Background worker runs every 60 seconds, posts pending items to eBay
- Auctions: Starting Bid, Reserve Price, Buy It Now, Duration (1-10 days)
- Bulk scheduling with configurable interval (e.g., 1 card every 24 hours)
- Default posting time: 7pm EST (midnight UTC)
- Cards auto-marked as "listed" after successful posting

## Chase Pack Flow (Pick Your Card)
- Buyer purchases spot → receives claim code via eBay message
- Enters code → sees grid of face-down "graded card slabs" with seller logo
- Picks a card → reveal animation + tier celebration
- End/Delete pack auto-ends eBay listing

## Key API Endpoints
- `POST /api/schedule/add` — Schedule single card
- `POST /api/schedule/add-bulk` — Schedule multiple cards with interval
- `GET /api/schedule/queue` — Get schedule queue
- `DELETE /api/schedule/{id}` — Remove from schedule
- `POST /api/ebay/sell/create-chase-pack` — Create chase pack on eBay
- `POST /api/ebay/chase/{pack_id}/pick-card` — Buyer picks card
- `GET /api/shop/{slug}/chase-packs` — Public chase packs for store
- `GET /api/marketplace/chase-packs` — All active chase packs

## Completed Features (Latest - Apr 2026)
- Schedule Posting with dual queues (Fixed Price + Auctions)
- Background scheduler worker
- Auction support (Starting Bid, Reserve, BIN, Duration)
- Pick Your Card flow for Chase Packs
- Chase Packs in Store banner + Marketplace section
- eBay listing auto-end on pack End/Delete
- Card value editing + tier value ranges
- Collection option removed from inventory
- Collage grid 2 cards per row
- Rich HTML description for eBay Chase Pack listings

## Next Priority
- **P0:** Stripe Production Integration (Rookie, MVP $14.99, Hall of Famer $19.99)
- **P1:** Whatnot & Shopify Integration

## Future/Backlog
- P2: Chase Pack Phase 2 - Direct Purchase via Stripe
- P3: Seller Hub Features
- P4: New User Onboarding
- P5-P8: Flip Finder, Windows Scanner, Team Access, Refactoring

## 3rd Party Integrations
- OpenAI GPT-4o, eBay Trading API + Marketing API, Stripe (upcoming)
