# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
Build "FlipSlab Engine" - an Operating System for Sports Card Traders. Features include AI-powered card identification, inventory management, eBay integration, market intelligence, portfolio tracking, listing creation, auction sniping, and cross-platform trading actions.

## Tech Stack
- **Frontend:** React, Tailwind CSS, shadcn/ui, Recharts, Axios
- **Backend:** FastAPI (modular routers), MongoDB, OpenAI SDK (GPT-4o)
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
- [x] **Dashboard Command Center v2** - Visual grid-based hub showing active listings with hi-res images, ending soon cards with countdown badges, recent sales gallery, monitor feed grid, snipe panel, best sale, snipe record, and quick navigation
- [x] Flip Finder (watchlist + eBay monitor)
- [x] Image processing pipeline
- [x] Backend refactored to modular routers
- [x] Sold Listings tab with hi-res images, buyer info, sold dates
- [x] Hi-res listing images (s-l800/s-l1600)
- [x] Sorting: Newest/Oldest Listed, Price H/L, Watchers, Time Left, Title
- [x] Date Range for Sold: 7/30/60 days
- [x] Page Size selector: 20/50/100/200
- [x] Production deployment pipeline fixed (.htaccess corrected)
- [x] **Auction Sniper** - Automated bid system in Flip Finder
- [x] **Monitor Filters** - Filter by All Types / Auctions / Buy Now / Best Offer
- [x] **Buy Now Action** - Buy BIN listings directly with modal + eBay redirect fallback
- [x] **Make Offer Action** - Send offers on Best Offer listings with modal + message field
- [x] **Contextual Action Buttons** - Snipe on auctions, Buy on BIN, Offer on Best Offer
- [x] Repo cleanup: removed 8 temporary debug scripts

## Key API Endpoints
### Dashboard
- `GET /api/dashboard/command-center` - Aggregated command center data (snipes, monitor, actions, inventory)
- `GET /api/dashboard/analytics` - Full sales/inventory/listings analytics
- `GET /api/dashboard/stats` - KPI statistics
- `GET /api/dashboard/recent` - Recently analyzed cards
- `GET /api/dashboard/opportunities` - Flip opportunities
- `GET /api/dashboard/movers` - Market movers

### Trading Actions
- `POST /api/snipes` - Create snipe task
- `GET /api/snipes` - List all snipe tasks
- `DELETE /api/snipes/{id}` - Cancel active snipe
- `POST /api/snipes/{id}/refresh` - Refresh item details
- `POST /api/snipes/check-item` - Validate eBay item before sniping
- `GET /api/snipes-stats` - Get snipe statistics
- `POST /api/buy-now` - Buy It Now (requires eBay app approval for direct purchase)
- `POST /api/make-offer` - Make Best Offer (requires eBay app approval)
- `GET /api/listings?listing_type=auction|buy_now|offers` - Filter listings by type

## Known Limitations
- **eBay Buy Now API** requires special eBay app approval for production use. Currently falls back to "Complete on eBay" redirect.
- **eBay Make Offer API** (MakeBestOffer) also needs approval. Falls back to eBay redirect.
- These will work automatically once the eBay app gets approved for these actions.

## Next Tasks
- P1: Whatnot API Integration (waiting for API access approval email)
- P1: Inventory Sync Engine (cross-listing eBay + Whatnot with auto-delist)
- P2: Auto-Refresh Portfolio Value
- P2: Build Flip Finder Core Logic (profitable flip detection)
- P3: Commercialize with Stripe (Pro plan)

## 3rd Party Integrations
- **eBay API** (Trading + Browse API) - Listings, OAuth, market data, PlaceOffer (sniping), MakeBestOffer
- **OpenAI GPT-4o** - User-provided API key for AI features
- **Jina Reader API** - Fallback for market data scraping
- **Emergent Google Auth** - "Continue with Google" functionality
- **Whatnot Seller API** - PENDING (applied for access via sellerapi@whatnot.com)
