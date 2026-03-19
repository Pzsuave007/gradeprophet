# FlipSlab Engine - Product Requirements Document

## CRITICAL DEPLOYMENT INFO (DO NOT SKIP)
- **Production URL:** `https://flipslabengine.com`
- **Production REACT_APP_BACKEND_URL:** `https://flipslabengine.com`
- **User's deploy process:** Push to GitHub → `git pull` on server → `bash fix.sh`
- **fix.sh copies `frontend/build/*`** to the web root — source `.jsx` files are NOT served directly
- **EVERY TIME you do `yarn build`:** FIRST set `REACT_APP_BACKEND_URL=https://flipslabengine.com` in `.env`, build, THEN restore the preview URL
- **User language:** Spanish
- **Admin email:** pzsuave007@gmail.com (Google Auth)

## Original Problem Statement
Build a multi-tiered subscription model for the "FlipSlab Engine" sports card trading platform. Features include admin panel, public Card Shop, image optimization, photo cropping, eBay photo syncing, and Social Post image generator.

## Core Features

### Implemented
- **Admin Panel** (`/admin`): Private route for admin to manage users and view platform stats
- **Public Card Shop** (`/shop/:slug`): Shows all active eBay listings with tier-based theming, 3D flip, glow effects
- **Social Post Editor**: Interactive editor inside inventory card detail view for creating branded social media images
  - Drag/resize elements (card image, title, price, logo, shop name, tier badge, tag)
  - Glow presets (Legend, Gold, Ice, Fire, Emerald, Clean, Flamingo, Aqua)
  - Glow intensity & corner roundness sliders
  - Toggle visibility of each element
  - Export to PNG (1080x1350 @ 4:5 ratio)
- **Subscription System**: Rookie (free), All-Star, Hall of Fame, Legend tiers with Stripe
- **eBay Integration**: Trading & Fulfillment APIs for inventory sync and listing management
- **AI Card Identification**: OpenAI GPT-4o for instant card recognition
- **Google Auth**: Emergent-managed Google OAuth
- **Scanner Token**: Long-lived tokens for desktop FlipSlab Scanner app
- **Landing Page**: Advertises Card Shop feature

### Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── database.py
│   ├── utils/auth.py
│   └── routers/ (auth, inventory, ebay, shop, subscription, admin, flipfinder, settings, etc.)
├── frontend/
│   ├── src/App.js
│   ├── src/components/
│   │   ├── SocialPostEditor.jsx   # Rewritten: native pointer events (no react-rnd)
│   │   ├── InventoryModule.jsx    # Card detail + Social Post integration
│   │   ├── LandingPage.jsx
│   │   └── ...
│   └── src/pages/
│       ├── Dashboard.jsx
│       └── ShopPage.jsx
```

## Bug Fixes Applied (March 19, 2026)
- **Social Post Editor blank canvas**: Rewrote `SocialPostEditor.jsx` removing `react-rnd` dependency, replaced with native pointer events (`DraggableEl` component). Root cause: react-rnd potentially incompatible with React 19
- **Subscription endpoint**: Fixed `InventoryModule.jsx` - was calling `/api/subscription` (404), corrected to `/api/subscription/my-plan`
- **Settings/Subscription fetch**: Removed `if (token)` guard in `CardDetailModal` that blocked API calls since `localStorage.getItem('token')` was always null. Now uses cookie-based auth via `withCredentials: true`

## Upcoming Tasks
- **P0: Stripe Production Integration**: Configure production keys
- **P1: Whatnot & Shopify Integration**: Premium "Legend" tier feature

## Future / Backlog
- P2: New User Onboarding wizard
- P3: "Flip Finder" core logic enhancements
- P4: Windows Scanner App
- P5: Team Access for "Legend" tier
- P6: Refactor `InventoryModule.jsx` (1300+ lines)

## Tech Stack
- Frontend: React 19, Tailwind CSS, Framer Motion, Shadcn/UI
- Backend: FastAPI, MongoDB
- Auth: Emergent Google OAuth + cookie-based sessions
- Integrations: eBay Trading/Fulfillment API, OpenAI GPT-4o, Stripe
