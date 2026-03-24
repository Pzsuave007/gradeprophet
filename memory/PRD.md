# FlipSlab Engine - Product Requirements Document

## CRITICAL DEPLOYMENT INFO (DO NOT SKIP)
- **Production URL:** `https://flipslabengine.com`
- **Production REACT_APP_BACKEND_URL:** `https://flipslabengine.com`
- **User's deploy process:** Push to GitHub → `git pull` on server → `bash fix.sh`
- **fix.sh copies `frontend/build/*`** to the web root — source `.jsx` files are NOT served directly
- **EVERY TIME frontend changes are made:** Build with `REACT_APP_BACKEND_URL=https://flipslabengine.com`, then restore preview URL
- **User language:** Spanish (but also comfortable in English)
- **Admin email:** pzsuave007@gmail.com (Google Auth)
- **Scanner token for testing:** `scan_74b1544bdc4a4aa2b3fa9839c4e42f64`

## Original Problem Statement
Build a multi-tiered subscription model for the "FlipSlab Engine" sports card trading platform. Features include admin panel, public Card Shop, image optimization, photo cropping, eBay photo syncing, and Social Post image generator.

## Core Features Implemented
- **Admin Panel** (`/admin`): Private route for admin to manage users
- **Public Card Shop** (`/shop/:slug`): Active eBay listings with 3D flip, glow effects
- **Social Post Editor**: Full editor with presets, frames, icons, text, background colors
- **Subscription System**: Rookie (free), All-Star, Hall of Fame, Legend tiers (Stripe test keys)
- **eBay Integration**: Trading & Fulfillment APIs for inventory sync and listing management
- **AI Card Identification**: OpenAI GPT-4o
- **Google Auth**: Emergent-managed Google OAuth
- **Scanner Token**: Long-lived tokens for desktop FlipSlab Scanner app
- **Inventory Sold Tab**: Automatic sync of sold items from eBay
- **Card Title Wrapping**: Full text visible across all sections (March 24, 2026)
- **Shipping Selection Fix**: Fixed React state race condition in CreateListingView (March 24, 2026)
- **Bulk Shipping Update**: Select multiple listings in Listings/Active AND Inventory/Listed to update shipping in bulk (March 24, 2026)
- **Price Lookup Links**: CardLadder, SportsCardInvestor, 130Point buttons in both Inventory card detail and Listings detail (March 24, 2026)

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── database.py
│   ├── utils/auth.py
│   └── routers/ (auth, inventory, ebay, shop, subscription, admin, flipfinder, settings)
├── frontend/
│   ├── src/components/
│   │   ├── SocialPostEditor.jsx
│   │   ├── InventoryModule.jsx    # Bulk shipping + Price lookup links
│   │   ├── ListingsModule.jsx     # Bulk shipping + Price lookup links
│   │   ├── CreateListingView.jsx  # Fixed shipping race condition
│   │   └── LandingPage.jsx
│   └── src/pages/
│       ├── Dashboard.jsx
│       └── ShopPage.jsx
```

## Key API Endpoints
- `POST /api/ebay/sell/bulk-revise-shipping` — Bulk update shipping on multiple eBay listings
- `POST /api/ebay/sell/revise` — Revise a single eBay listing
- `POST /api/ebay/sell/create` — Create a new eBay listing
- `GET /api/ebay/my-listings` — Fetch user's eBay listings (triggers sold sync)
- `GET /api/inventory` — Fetch inventory items (supports category=sold, limit=500)

## Next Priority Task
- **P0: Stripe Production Integration** — Configure production keys for subscription payments

## Upcoming Tasks
- P1: Whatnot & Shopify Integration (Legend tier feature)

## Future / Backlog
- P2: New User Onboarding wizard
- P3: "Flip Finder" core logic enhancements
- P4: Windows Scanner App
- P5: Team Access for "Legend" tier
- P6: Refactor `InventoryModule.jsx` (1400+ lines)

## 3rd Party Integrations
- **eBay API**: Trading and Fulfillment APIs
- **OpenAI GPT-4o**: Card identification
- **Emergent Google Auth**: User login
- **Stripe**: Integrated with test keys, production setup PENDING
