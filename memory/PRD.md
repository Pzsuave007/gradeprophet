# FlipSlab Engine - Product Requirements Document

## CRITICAL DEPLOYMENT INFO (DO NOT SKIP)
- **Production URL:** `https://flipslabengine.com`
- **Production REACT_APP_BACKEND_URL:** `https://flipslabengine.com`
- **User's deploy process:** Push to GitHub → `git pull` on server → `bash fix.sh`
- **fix.sh copies `frontend/build/*`** to the web root — source `.jsx` files are NOT served directly
- **EVERY TIME frontend changes are made:** Build with `REACT_APP_BACKEND_URL=https://flipslabengine.com`, then restore preview URL
- **User language:** Spanish (but also comfortable in English)
- **Admin email:** pzsuave007@gmail.com (Google Auth)
- **Scanner token for testing:** `scan_74b1544bdc4a4aa2b3fa9839c4e42f64` (use dev-login endpoint to set cookie)

## Original Problem Statement
Build a multi-tiered subscription model for the "FlipSlab Engine" sports card trading platform. Features include admin panel, public Card Shop, image optimization, photo cropping, eBay photo syncing, and Social Post image generator.

## Core Features

### Implemented
- **Admin Panel** (`/admin`): Private route for admin to manage users and view platform stats
- **Public Card Shop** (`/shop/:slug`): Shows all active eBay listings with tier-based theming, 3D flip, glow effects
- **Social Post Editor** (fully functional): Drag/resize elements, glow presets, frames, icons, custom text, background colors, global presets
- **Subscription System**: Rookie (free), All-Star, Hall of Fame, Legend tiers with Stripe (test keys)
- **eBay Integration**: Trading & Fulfillment APIs for inventory sync and listing management
- **AI Card Identification**: OpenAI GPT-4o
- **Google Auth**: Emergent-managed Google OAuth
- **Scanner Token**: Long-lived tokens for desktop FlipSlab Scanner app
- **Dev Login Endpoint**: `GET /api/auth/dev-login?token=xxx` sets session cookie for testing
- **Inventory Sold Tab**: Automatic sync of sold items from eBay
- **Card Title Wrapping**: Titles no longer truncated (March 24, 2026)
- **Bulk Shipping Update**: Select multiple listings in both Listings/Active and Inventory/Listed tabs to update shipping in bulk via eBay API (March 24, 2026)
- **Shipping Selection Fix**: Fixed React state race condition that prevented shipping option from being saved when creating eBay listings (March 24, 2026)

### Architecture
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
│   │   ├── InventoryModule.jsx    # Bulk shipping in Listed tab
│   │   ├── ListingsModule.jsx     # Bulk shipping in Active tab
│   │   ├── CreateListingView.jsx  # Fixed shipping race condition
│   │   └── LandingPage.jsx
│   └── src/pages/
│       ├── Dashboard.jsx
│       └── ShopPage.jsx
```

## DB Collections
- **global_settings**: Global editor presets
- **user_settings**: Per-user settings
- **users**: User accounts
- **user_sessions**: Session tokens
- **subscriptions**: User subscription data
- **inventory**: Card inventory (category can be "sold")

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

## Tech Stack
- Frontend: React 19, Tailwind CSS, Framer Motion, Shadcn/UI
- Backend: FastAPI, MongoDB
- Auth: Emergent Google OAuth + cookie-based sessions
- Integrations: eBay Trading/Fulfillment API, OpenAI GPT-4o, Stripe (test keys active)

## 3rd Party Integrations
- **eBay API**: Trading and Fulfillment APIs
- **OpenAI GPT-4o**: Card identification
- **Emergent Google Auth**: User login
- **Stripe**: Integrated with test keys, production setup PENDING (next task)
