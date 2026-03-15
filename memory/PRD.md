# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
Build "FlipSlab Engine" - an Operating System for Sports Card Traders. Features include AI-powered card identification, inventory management, eBay integration, market intelligence, portfolio tracking, listing creation, auction alerts, and cross-platform trading actions.

## Tech Stack
- **Frontend:** React, Tailwind CSS, shadcn/ui, Recharts, Axios, Framer Motion
- **Backend:** FastAPI (modular routers), MongoDB, OpenAI SDK (GPT-4o), feedparser
- **Auth:** JWT with httpOnly cookies (local), Emergent Google OAuth
- **Deployment:** git pull -> bash fix.sh (copies to /home/flipcardsuni2/public_html/)

## Production Server Setup
- **Apache** with cPanel on `flipslabengine.com` (132.148.78.187)
- **DocumentRoot:** `/home/flipcardsuni2/public_html/`
- **Git repo:** `/home/gradeprophet/`
- **Backend:** `/opt/gradeprophet/backend/` (uvicorn port 8001)
- **.htaccess:** Proxies `/api` -> port 8001, serves static files from public_html
- **IMPORTANT:** `.htaccess` must NOT proxy to port 3000.

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
- [x] Dashboard analytics (Sales Overview, Revenue/Profit charts)
- [x] Dashboard Command Center v2 - Visual grid-based hub
- [x] Dashboard Interactivity - All cards clickable
- [x] Hobby Pulse News Feed - Mini-feed with thumbnails from RSS
- [x] Flip Finder (watchlist + eBay monitor)
- [x] Image processing pipeline
- [x] Backend refactored to modular routers
- [x] Sold Listings tab with hi-res images, buyer info, sold dates
- [x] Hi-res listing images (s-l800/s-l1600)
- [x] Sorting: Newest/Oldest Listed, Price H/L, Watchers, Time Left, Title
- [x] Date Range for Sold: 7/30/60 days
- [x] Page Size selector: 20/50/100/200
- [x] Production deployment pipeline fixed (.htaccess corrected)
- [x] **Auction Alert System** - Notifies user 1 min before auction ends, opens eBay for manual bidding
- [x] Monitor Filters - Filter by All Types / Auctions / Buy Now / Best Offer
- [x] Buy Now Action - Buy BIN listings with modal + eBay redirect fallback
- [x] Make Offer Action - Send offers with modal + message field
- [x] Contextual Action Buttons - Alert on auctions, Buy on BIN, Offer on Best Offer
- [x] **Global Terminology Refactor** - All "Snipe/Sniper" renamed to "Auction Alert/Alerts" across entire app (Mar 15, 2026)
- [x] Landing page updated: "SCAN. ALERT. PROFIT." hero, updated features/pricing/how-it-works

## Key API Endpoints
### Dashboard
- `GET /api/dashboard/command-center` - Aggregated command center data
- `GET /api/dashboard/analytics` - Full sales/inventory/listings analytics
- `GET /api/dashboard/hobby-news` - Hobby news RSS feed

### Auction Alerts (API paths use /snipes for backward compat)
- `POST /api/snipes` - Create auction alert
- `GET /api/snipes` - List all alerts
- `DELETE /api/snipes/{id}` - Cancel active alert
- `POST /api/snipes/{id}/refresh` - Refresh item details
- `POST /api/snipes/check-item` - Validate eBay item
- `GET /api/snipes-stats` - Get alert statistics
- `GET /api/snipes/firing` - Get triggered alerts
- `POST /api/snipes/{id}/ack` - Acknowledge alert

## Known Limitations
- **eBay automated bidding is prohibited** by eBay API policy. The Auction Alert system notifies users and opens eBay for manual bidding.
- **eBay Buy Now/Make Offer APIs** require special app approval. Currently falls back to eBay redirect.

## Next Tasks
- P1: Whatnot API Integration (waiting for API access approval)
- P1: Inventory Sync Engine (cross-listing eBay + Whatnot)
- P2: Auto-Refresh Portfolio Value
- P2: Build Flip Finder Core Logic (profitable flip detection)
- P3: Commercialize with Stripe (Pro plan)

## 3rd Party Integrations
- **eBay API** (Trading + Browse API) - Listings, OAuth, market data
- **OpenAI GPT-4o** - User-provided API key for AI features
- **Jina Reader API** - Fallback for market data scraping
- **Emergent Google Auth** - "Continue with Google" functionality
- **RSS Feeds (feedparser)** - Hobby Pulse news feed
- **Whatnot Seller API** - PENDING (applied for access)
