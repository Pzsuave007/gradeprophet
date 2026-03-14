# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
Build "FlipSlab Engine" - an Operating System for Sports Card Traders. Features include AI-powered card identification, inventory management, eBay integration, market intelligence, portfolio tracking, and listing creation.

## Tech Stack
- **Frontend:** React, Tailwind CSS, shadcn/ui, Recharts, Axios
- **Backend:** FastAPI (modular routers), MongoDB, OpenAI SDK (GPT-4o)
- **Auth:** JWT with httpOnly cookies (local), Emergent Google OAuth
- **Deployment:** `fix.sh` v8 + `flipslab_update.tar.gz` package

## Architecture (Post-Refactor v2.0)
```
/app/backend/
├── server.py              # Slim entry point + download endpoint
├── database.py            # MongoDB connection
├── config.py              # Environment variables + OpenAI client
├── utils/
│   ├── auth.py, ai.py, ebay.py, image.py, market.py
├── routers/
│   ├── auth.py, cards.py, inventory.py, market.py
│   ├── portfolio.py, alerts.py, dashboard.py
│   ├── ebay.py, flipfinder.py, settings.py
├── models/
│   └── __init__.py
└── tests/
```

## What's Been Implemented
- [x] Landing page with auth (Email/Password + Google OAuth)
- [x] Multi-tenant data isolation (~30 endpoints)
- [x] AI card analysis and identification (GPT-4o)
- [x] Inventory CRUD with grid/list toggle (grid default)
- [x] Portfolio Value page with grid/list toggle (grid default)
- [x] Batch upload
- [x] eBay OAuth integration (connect, list, end listings)
- [x] Market search and watchlist
- [x] Portfolio value tracking with snapshots
- [x] Price alerts
- [x] Dashboard analytics
- [x] Flip Finder (watchlist + eBay monitor)
- [x] Image processing pipeline (crop, enhance, resize)
- [x] Backend refactored to modular routers (from 5367-line monolith)
- [x] Full English translation
- [x] Deployment package (fix.sh v8 + tar.gz) for modular architecture
- [x] Download endpoint at /api/download-update

## Known Issues (Resolved)
- ~~Google OAuth on production server~~ - User confirmed WORKING
- ~~fix.sh needs regeneration~~ - DONE (v8 with modular support)

## Next Tasks
- P1: Auto-Refresh Portfolio Value
- P2: Build Flip Finder Core Logic
- P3: Commercialize with Stripe
