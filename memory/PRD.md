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
- **Social Post Editor** (fully functional):
  - Drag/resize all elements via native pointer events (no react-rnd)
  - 8 glow presets (Legend, Gold, Ice, Fire, Emerald, Clean, Flamingo, Aqua)
  - Glow intensity & corner roundness sliders
  - **Frame element** — empty rectangle with rounded corners, sits below card (z-index 0)
  - **Shield element** — decorative shield icon with glow
  - **3 Custom Text fields** — editable text with alignment control (left/center/right)
  - **2 Icon slots** — 10 icons to choose from (Star, Heart, Trophy, Flame, Zap, Crown, Diamond, Shield, Target, Award)
  - **8 Background colors** (Black, Charcoal, Navy, Midnight, Forest, Wine, Slate, White)
  - **Global Presets** — admin creates presets, all users can apply them (stored in `global_settings` collection)
  - Toggle visibility of all 14 elements
  - Export to PNG (1080x1350 @ 4:5 ratio)
  - Self-fetches shop data (name, logo, plan) — no dependency on InventoryModule props
- **Subscription System**: Rookie (free), All-Star, Hall of Fame, Legend tiers with Stripe (test keys)
- **eBay Integration**: Trading & Fulfillment APIs for inventory sync and listing management
- **AI Card Identification**: OpenAI GPT-4o
- **Google Auth**: Emergent-managed Google OAuth
- **Scanner Token**: Long-lived tokens for desktop FlipSlab Scanner app
- **Dev Login Endpoint**: `GET /api/auth/dev-login?token=xxx` sets session cookie for testing

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
│   │   ├── SocialPostEditor.jsx   # Full editor with frame, icons, custom text, bg colors, global presets
│   │   ├── InventoryModule.jsx    # Card detail + Social Post integration
│   │   └── LandingPage.jsx
│   └── src/pages/
│       ├── Dashboard.jsx
│       └── ShopPage.jsx
```

## Bug Fixes Applied (March 19, 2026)
- **Social Post Editor blank canvas**: Removed react-rnd, replaced with native pointer events
- **Subscription endpoint**: Fixed `/api/subscription` → `/api/subscription/my-plan`
- **Settings/Subscription fetch**: Removed token guard, editor self-fetches data
- **Frame z-index**: Moved frame below card (z-index 0) so card is always clickable

## DB Collections
- **global_settings**: Stores global editor presets (`key: "editor_presets"`)
- **user_settings**: Per-user settings (shop_name, shop_logo, ebay data, etc.)
- **users**: User accounts
- **user_sessions**: Session tokens (including scanner tokens)
- **subscriptions**: User subscription data

## Next Priority Task
- **P0: Stripe Production Integration** — Configure production keys for subscription payments

## Upcoming Tasks
- P1: Whatnot & Shopify Integration (Legend tier feature)

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
- Integrations: eBay Trading/Fulfillment API, OpenAI GPT-4o, Stripe (test keys active)

## 3rd Party Integrations
- **eBay API**: Trading and Fulfillment APIs
- **OpenAI GPT-4o**: Card identification
- **Emergent Google Auth**: User login
- **Stripe**: Integrated with test keys, production setup PENDING (next task)
