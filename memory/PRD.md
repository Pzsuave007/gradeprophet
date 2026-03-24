# FlipSlab Engine - Product Requirements Document

## CRITICAL DEPLOYMENT INFO (DO NOT SKIP)
- **Production URL:** `https://flipslabengine.com`
- **Production REACT_APP_BACKEND_URL:** `https://flipslabengine.com`
- **User's deploy process:** Push to GitHub → `git pull` on server → `bash fix.sh`
- **fix.sh copies `frontend/build/*`** to the web root
- **EVERY TIME frontend changes are made:** Build with production URL, then restore preview URL
- **User language:** Spanish (comfortable in English too)
- **Admin email:** pzsuave007@gmail.com (Google Auth)
- **Scanner token:** `scan_74b1544bdc4a4aa2b3fa9839c4e42f64`

## Original Problem Statement
Build a multi-tiered subscription model for the "FlipSlab Engine" sports card trading platform with admin panel, public Card Shop, eBay syncing, Social Post generator, and public Marketplace.

## Core Features Implemented
- **Public Marketplace** (`/marketplace`): Aggregates all cards from all sellers, search, filters (sport, condition, seller, price sort), card modal with 3D flip/swipe, seller info, eBay buy links. Accessible from Landing Page nav and Dashboard sidebar.
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

## Architecture
```
/app/
├── backend/routers/
│   ├── marketplace.py     # Public marketplace API (ebay_tokens collection)
│   ├── ebay.py            # Bulk revise shipping
│   ├── shop.py, inventory.py, auth.py, settings.py, admin.py, etc.
├── frontend/src/
│   ├── pages/
│   │   ├── MarketplacePage.jsx  # Public marketplace
│   │   ├── ShopPage.jsx, Dashboard.jsx
│   ├── components/
│   │   ├── LandingPage.jsx      # Added Marketplace nav link
│   │   ├── InventoryModule.jsx, ListingsModule.jsx, CreateListingView.jsx
│   └── App.js                   # /marketplace route in all Routes blocks
```

## Key API Endpoints
- `GET /api/marketplace` — Public: all listed cards, filters: sport, condition, seller, search, sort
- `POST /api/ebay/sell/bulk-revise-shipping` — Bulk update shipping
- `GET /api/shop/:slug` — Individual seller shop
- `GET /api/inventory`, `GET /api/ebay/my-listings`

## Important Technical Notes
- eBay tokens stored in `ebay_tokens` collection (NOT `user_settings`)
- Marketplace excludes items with `category: "sold"`
- Seller filter maps name → user_id via settings_map/users_map

## Next Priority: P0 Stripe Production Integration
## Upcoming: P1 Whatnot & Shopify (Legend tier)
## Backlog: Direct purchase, Onboarding, Flip Finder, Windows Scanner, Team Access, Refactor InventoryModule.jsx
