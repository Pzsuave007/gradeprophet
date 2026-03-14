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
- [x] Deployment package (fix.sh v8 + tar.gz) for modular architecture
- [x] Download endpoint at /api/download-update
- [x] **Sold Listings tab** - Shows all sold eBay items with hi-res images, buyer info, sold dates, revenue total
- [x] **Hi-res listing images** - All eBay images upgraded from 140px to 800-1600px

## Bugs Fixed (This Session - March 14, 2026)
- [x] **Listings page blank** - API returns `{listings:[]}` but frontend expected `{active:[]}`. Fixed data transformation.
- [x] **Flip Finder blank** - `/api/listings` returns `{listings:[]}` but `EbayMonitor.jsx` expected raw array. Fixed to handle both formats.
- [x] **Low-res listing images** - eBay `GalleryURL` returns `s-l140` (140px thumbnails). Upgraded to `s-l800` in both backend endpoints + frontend safety net.
- [x] **Sold listings empty** - API only requested `<ActiveList>`, now also requests `<SoldList>`. Uses Browse API fallback to fetch sold item images.

## Known Issues (All Resolved)
- ~~Google OAuth on production server~~ - User confirmed WORKING
- ~~fix.sh needs regeneration~~ - DONE
- ~~Listings page blank~~ - FIXED
- ~~Flip Finder page blank~~ - FIXED
- ~~Low-res images~~ - FIXED
- ~~Sold tab empty~~ - FIXED

## Next Tasks
- P1: Auto-Refresh Portfolio Value
- P2: Build Flip Finder Core Logic
- P3: Commercialize with Stripe
