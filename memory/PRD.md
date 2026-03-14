# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
Build "FlipSlab Engine" - an Operating System for Sports Card Traders. Features include AI-powered card identification, inventory management, eBay integration, market intelligence, portfolio tracking, and listing creation.

## Core Requirements
1. **New Platform Structure:** Sidebar: Dashboard, Inventory, Market, Flip Finder, Listings, Account
2. **AI-Powered Inventory:** AI identifies cards from photos, auto-fills details
3. **User Profile:** Account settings (default location, shipping preferences)
4. **AI-Powered Listing Creation:** Auto-populate eBay fields, AI titles/descriptions, price suggestions
5. **Advanced Image Processing:** Auto-crop backgrounds, enhance colors/sharpness
6. **Batch Upload:** Upload 20+ scanned cards with AI identification
7. **Card Ladder Features:** Portfolio value tracker, price alerts, historical charts
8. **Authentication & Landing Page:** Email/Password & Google auth, landing page
9. **eBay Listing Management:** Create and end listings from platform

## Tech Stack
- **Frontend:** React, Tailwind CSS, shadcn/ui, Recharts, Axios
- **Backend:** FastAPI (modular routers), MongoDB, OpenAI SDK (GPT-4o)
- **Auth:** JWT with httpOnly cookies (local), Emergent Google OAuth
- **Deployment:** Custom `fix.sh` script for user's production server

## Architecture (Post-Refactor v2.0)
```
/app/backend/
├── server.py              # 81 lines - Slim entry point
├── database.py            # MongoDB connection
├── config.py              # Environment variables + OpenAI client
├── utils/
│   ├── auth.py            # get_current_user, session token
│   ├── ai.py              # AI prompts, analyze_card_with_ai, read_psa_label
│   ├── ebay.py            # eBay token mgmt, browse/sold search, scraping
│   ├── image.py           # auto_crop, enhance, thumbnail, process
│   └── market.py          # get_card_market_value, detect_sport
├── routers/
│   ├── auth.py            # /api/auth/* (register, login, session, me, logout)
│   ├── cards.py           # /api/cards/*, /api/learning/*, /api/references/*, /api/ebay/import, /api/corners/crop
│   ├── inventory.py       # /api/inventory/* (CRUD, batch, stats, import from scan)
│   ├── market.py          # /api/market/* (search, watchlist, hot-cards, card-value, flip-calc)
│   ├── portfolio.py       # /api/portfolio/* (summary, refresh-value, snapshot)
│   ├── alerts.py          # /api/alerts (CRUD, check)
│   ├── dashboard.py       # /api/dashboard/* (analytics, stats, recent, movers)
│   ├── ebay.py            # /api/ebay/* (OAuth, seller, sell)
│   ├── flipfinder.py      # /api/watchlist/*, /api/listings/*, /api/test-ebay
│   └── settings.py        # /api/settings (get, update)
└── tests/
```

## What's Been Implemented
- [x] Landing page with auth (Email/Password + Google OAuth)
- [x] Multi-tenant data isolation (~30 endpoints)
- [x] AI card analysis and identification (GPT-4o)
- [x] AI listing generation
- [x] Inventory CRUD with grid/list toggle (grid default)
- [x] Batch upload
- [x] eBay OAuth integration (connect, list, end listings)
- [x] Market search and watchlist
- [x] Portfolio value tracking with snapshots
- [x] Price alerts
- [x] Dashboard analytics
- [x] Flip Finder (watchlist + eBay monitor)
- [x] Image processing pipeline (crop, enhance, resize)
- [x] **Backend refactored to modular routers** (from 5367-line monolith)
- [x] Full English translation

## Known Issues
- **Google OAuth on production server** - Works in dev, fails on user's flipslabengine.com
- **Recharts dimension warnings** - Minor library issue on initial chart render

## DB Collections
- users, user_sessions, card_analyses, inventory, price_alerts
- watchlist_cards, ebay_listings, created_listings, ebay_tokens
- market_watchlist, psa10_references, user_settings, portfolio_snapshots

## 3rd Party Integrations
- **eBay API** (Trading & Browse) - User-provided keys
- **OpenAI GPT-4o** - User-provided API key
- **Jina Reader API** - Market data scraping fallback
- **Emergent Google Auth** - Social login
