# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
Build "FlipSlab Engine" - an Operating System for Sports Card Traders. Features include AI-powered card identification, inventory management, eBay integration, market intelligence, portfolio tracking, and listing creation.

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

## Bugs Fixed (March 14, 2026)
- [x] Listings page blank (API response format mismatch: `listings` → `active`)
- [x] Flip Finder blank (object vs array response)
- [x] Low-res images (s-l140 → s-l800)
- [x] Sold listings empty (added SoldList to API + Browse API image fallback)
- [x] **Production deployment** — .htaccess was proxying to port 3000 instead of serving static files

## Next Tasks
- P1: Auto-Refresh Portfolio Value
- P2: Build Flip Finder Core Logic
- P3: Commercialize with Stripe
