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
│   │   ├── ebay.py            # eBay listings, sync, promoted listings, Chase Packs (pick-your-card flow)
│   │   ├── admin.py           # Admin panel APIs
│   │   ├── subscription.py    # Plans & billing
│   │   ├── settings.py        # User settings
│   │   ├── shop.py            # Shop/storefront + public chase packs endpoint
│   │   ├── marketplace.py     # Marketplace + public chase packs endpoint
│   │   └── flipfinder.py      # Flip finder/sniper
│   ├── utils/
│   │   ├── image.py           # scanner_auto_process, collage generators (2 cards per row)
│   │   ├── ai.py              # AI card identification
│   │   └── ebay.py            # eBay OAuth & token management
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChasePacksModule.jsx  # Chase Pack management (wizard, inline editing, card value editing)
│   │   ├── pages/
│   │   │   ├── ChaseRevealPage.jsx   # Public reveal page with "Pick Your Card" graded slab UI
│   │   │   ├── ShopPage.jsx          # Public store with Chase Pack banner
│   │   │   ├── MarketplacePage.jsx   # Marketplace with Chase Packs section
├── build_prod.sh              # Frontend build script (ALWAYS use this)
├── fix.sh                     # User's deploy script
├── AGENT_RULES.md             # Critical rules for agents
```

## CRITICAL BUILD RULES
- **NEVER run `craco build` or `yarn build` directly**. ALWAYS use `bash /app/build_prod.sh`
- **DO NOT change auth.py or auth endpoints**
- Use `dev_flipslab_access` token for testing

## Chase Pack Flow (Pick Your Card)
1. Seller creates pack via 3-step wizard (Select Cards → Set Tiers → Details)
2. Pack listed on eBay with tier collages + individual card photos + HTML description
3. Buyer purchases spot on eBay → Auto-monitor detects sale
4. System creates `pending_claim` (buyer + claim_code) — card NOT pre-assigned
5. eBay message sent to buyer with claim code + reveal page URL
6. Buyer enters code on reveal page → sees grid of face-down "graded card slabs"
7. Buyer picks a card → card assigned + reveal animation + tier celebration
8. Cards already picked show as "Taken" (grayed out)

## Key API Endpoints
- `POST /api/ebay/sell/create-chase-pack` — Create and list chase pack on eBay
- `POST /api/ebay/sell/chase-preview` — Generate 3 tier collage previews
- `GET /api/ebay/chase/{pack_id}` — Public: get pack info (includes seller logo, tier values)
- `POST /api/ebay/chase/{pack_id}/reveal` — Public: validate code, returns needs_pick or card
- `POST /api/ebay/chase/{pack_id}/pick-card` — Public: buyer picks card by index
- `POST /api/ebay/chase/{pack_id}/assign` — Seller: assign buyer to pending spot
- `POST /api/ebay/chase/{pack_id}/update-card-value` — Seller: edit card value
- `GET /api/shop/{slug}/chase-packs` — Public: active chase packs for a store
- `GET /api/marketplace/chase-packs` — Public: all active chase packs

## Completed Features (Latest Session - Apr 2026)
- Fixed eBay image upload (multipart helper), ConditionDescriptors, missing XML fields
- 3 tier collages + individual card photos uploaded (up to 12 eBay photos)
- Rich HTML description explaining Chase Pack rules
- Collage grid: 2 cards per row in all collage functions
- Store Chase Pack Banner (hero in ShopPage)
- Marketplace Chase Packs Section (horizontal scroll)
- "Pick Your Card" flow: buyer picks face-down graded slab cards
- `pending_claims` system: cards NOT pre-assigned until buyer picks
- Card value editing in pack detail dashboard
- Tier value ranges ($min-$max) on public reveal page
- Seller logo/name on face-down cards
- eBay buyer message updated for "pick your card" flow

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
- P8: Refactor InventoryModule.jsx & ListingsModule.jsx

## DB Schema
- `chase_packs`: pack_id, user_id, ebay_item_id, title, price, total_spots, spots_claimed, status, cards[], pending_claims[], all_revealed, created_at
- `cards[]`: card_id, player, year, set_name, variation, image, is_chase, claim_code, assigned_to, revealed, tier, card_value
- `pending_claims[]`: claim_code, buyer_username, claimed_at

## 3rd Party Integrations
- OpenAI GPT-4o — User API Key
- eBay Trading API (XML) + Marketing API (REST) — User API Key
- Stripe (Payments) — User API Key (upcoming)
