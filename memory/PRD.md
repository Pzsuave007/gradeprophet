# FlipSlab Engine - Product Requirements Document

## CRITICAL DEPLOYMENT INFO (DO NOT SKIP)
- **Production URL:** `https://flipslabengine.com`
- **Production REACT_APP_BACKEND_URL:** `https://flipslabengine.com`
- **User's deploy process:** Push to GitHub → `git pull` on server → `bash fix.sh`
- **fix.sh copies `frontend/build/*`** to the web root
- **EVERY TIME frontend changes are made:** Build with production URL, then restore preview URL
- **User language:** Spanish (comfortable in English too)
- **Admin email:** pzsuave007@gmail.com (Google Auth)
- **Scanner token for testing:** `scan_74b1544bdc4a4aa2b3fa9839c4e42f64`

## Original Problem Statement
Build a multi-tiered subscription model for the "FlipSlab Engine" sports card trading platform. Features include admin panel, public Card Shop, eBay syncing, Social Post generator, and now a public Marketplace.

## Core Features Implemented
- **Admin Panel** (`/admin`): Private route for admin
- **Public Card Shop** (`/shop/:slug`): Individual seller stores with tier-based theming
- **Public Marketplace** (`/marketplace`): Aggregates all cards from all sellers with search, filters (sport, condition, seller, price sort), card modal with 3D flip, swipe navigation, seller info, and eBay buy links
- **Social Post Editor**: Full editor with presets, frames, icons, text, background colors
- **Subscription System**: Rookie, All-Star, Hall of Fame, Legend tiers (Stripe test keys)
- **eBay Integration**: Trading & Fulfillment APIs for inventory sync and listing management
- **AI Card Identification**: OpenAI GPT-4o
- **Google Auth**: Emergent-managed Google OAuth
- **Scanner Token**: Long-lived tokens for desktop scanner
- **Inventory Sold Tab**: Automatic sync of sold items from eBay
- **Bulk Shipping Update**: Select multiple listings to update shipping in bulk (Inventory/Listed + Listings/Active)
- **Price Lookup Links**: eBay Sold + CardLadder buttons using structured card data
- **Listings Search + Sport Filter**: Search bar + sport detection filter in Listings section
- **Shipping Selection Fix**: Fixed React state race condition in CreateListingView

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── database.py
│   └── routers/
│       ├── marketplace.py     # NEW: Public marketplace API
│       ├── ebay.py            # Bulk revise shipping endpoint
│       ├── inventory.py
│       ├── shop.py
│       └── (auth, cards, settings, subscription, admin, flipfinder, etc.)
├── frontend/
│   ├── src/pages/
│   │   ├── MarketplacePage.jsx  # NEW: Public marketplace with full features
│   │   ├── ShopPage.jsx
│   │   └── Dashboard.jsx
│   ├── src/components/
│   │   ├── InventoryModule.jsx  # Bulk shipping + Price lookup
│   │   ├── ListingsModule.jsx   # Bulk shipping + Search + Sport filter + Price lookup
│   │   ├── CreateListingView.jsx # Fixed shipping race condition
│   │   └── SocialPostEditor.jsx
│   └── src/App.js               # Added /marketplace route
```

## Key API Endpoints
- `GET /api/marketplace` — Public: all listed cards with filters (sport, condition, seller, search, sort)
- `POST /api/ebay/sell/bulk-revise-shipping` — Bulk update shipping
- `GET /api/shop/:slug` — Individual seller shop
- `GET /api/inventory` — User inventory
- `GET /api/ebay/my-listings` — User's eBay listings

## Next Priority Task
- **P0: Stripe Production Integration**

## Upcoming Tasks
- P1: Add Marketplace link to Landing Page and Dashboard navigation
- P1: Whatnot & Shopify Integration (Legend tier)

## Future / Backlog
- P2: Direct purchase within FlipSlab (requires Stripe)
- P3: New User Onboarding wizard
- P4: "Flip Finder" core logic enhancements
- P5: Windows Scanner App
- P6: Team Access for "Legend" tier
- P7: Refactor `InventoryModule.jsx` (1400+ lines)

## 3rd Party Integrations
- **eBay API**: Trading and Fulfillment APIs
- **OpenAI GPT-4o**: Card identification
- **Emergent Google Auth**: User login
- **Stripe**: Test keys active, production setup PENDING
