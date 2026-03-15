# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
Build "FlipSlab Engine" - an Operating System for Sports Card Traders. Features include AI-powered card identification, inventory management, eBay integration, market intelligence, portfolio tracking, listing creation, and auction sniping.

## Tech Stack
- **Frontend:** React, Tailwind CSS, shadcn/ui, Recharts, Axios
- **Backend:** FastAPI (modular routers), MongoDB, OpenAI SDK (GPT-4o)
- **Auth:** JWT with httpOnly cookies (local), Emergent Google OAuth
- **Deployment:** git pull → bash fix.sh (copies to /home/flipcardsuni2/public_html/)

## Production Server Setup
- **Apache** with cPanel on `flipslabengine.com` (132.148.78.187)
- **DocumentRoot:** `/home/flipcardsuni2/public_html/`
- **Git repo:** `/home/gradeprophet/`
- **Backend:** `/opt/gradeprophet/backend/` (uvicorn port 8001)
- **.htaccess:** Proxies `/api` → port 8001, serves static files from public_html
- **IMPORTANT:** `.htaccess` must NOT proxy to port 3000. It serves static files directly.

## Deployment Workflow
1. Changes made on Emergent preview
2. Frontend built with `REACT_APP_BACKEND_URL=https://flipslabengine.com`
3. Build committed to git (frontend/.gitignore allows /build)
4. User: Save to Github → git pull → bash fix.sh
5. fix.sh copies backend to /opt/gradeprophet/backend/ and frontend build to /home/flipcardsuni2/public_html/

## What's Been Implemented
- [x] Landing page with auth (Email/Password + Google OAuth)
- [x] Multi-tenant data isolation (~30 endpoints)
- [x] AI card analysis and identification (GPT-4o)
- [x] Inventory CRUD with grid/list toggle
- [x] Portfolio Value page with grid/list toggle
- [x] Batch upload
- [x] eBay OAuth integration (connect, list, end listings)
- [x] Market search and watchlist
- [x] Portfolio value tracking with snapshots
- [x] Price alerts
- [x] Dashboard analytics
- [x] Flip Finder (watchlist + eBay monitor)
- [x] Image processing pipeline
- [x] Backend refactored to modular routers
- [x] Sold Listings tab with hi-res images, buyer info, sold dates
- [x] Hi-res listing images (s-l800/s-l1600)
- [x] Sorting: Newest/Oldest Listed, Price H/L, Watchers, Time Left, Title
- [x] Date Range for Sold: 7/30/60 days
- [x] Page Size selector: 20/50/100/200
- [x] Production deployment pipeline fixed (.htaccess corrected)
- [x] **Auction Sniper** — Automated bid system integrated in Flip Finder

## Auction Sniper (March 15, 2026)
- [x] Backend: eBay item details via Browse API (get_ebay_item_details)
- [x] Backend: PlaceOffer via Trading API (place_ebay_bid)
- [x] Backend: CRUD endpoints for snipe tasks (create, list, cancel, refresh, check-item, stats)
- [x] Backend: Background sniper engine (auto-monitors and fires bids at precise time)
- [x] Frontend: Sniper tab in Flip Finder with full UI (stats, form, list, countdown timers)
- [x] Frontend: "Snipe" button on auction listings in Monitor tab
- [x] Frontend: Pre-fill snipe form from Monitor listings
- [x] Validation: only auctions, max_bid > 0, 2-30 seconds timing
- [x] Repo cleanup: removed temporary debug scripts

## Key API Endpoints - Sniper
- `POST /api/snipes` - Create snipe task
- `GET /api/snipes` - List all snipe tasks
- `DELETE /api/snipes/{id}` - Cancel active snipe
- `POST /api/snipes/{id}/refresh` - Refresh item details
- `POST /api/snipes/check-item` - Validate eBay item before sniping
- `GET /api/snipes-stats` - Get snipe statistics

## Next Tasks
- P1: Whatnot API Integration (waiting for API access approval)
- P1: Inventory Sync Engine (cross-listing eBay + Whatnot with auto-delist)
- P2: Auto-Refresh Portfolio Value
- P2: Build Flip Finder Core Logic (profitable flip detection)
- P3: Commercialize with Stripe (Pro plan)

## 3rd Party Integrations
- **eBay API** (Trading + Browse API) — Listings, OAuth, market data, PlaceOffer (sniping)
- **OpenAI GPT-4o** — User-provided API key for AI features
- **Jina Reader API** — Fallback for market data scraping
- **Emergent Google Auth** — "Continue with Google" functionality
- **Whatnot Seller API** — PENDING (applied for access via sellerapi@whatnot.com)
