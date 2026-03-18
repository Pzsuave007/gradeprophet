# FlipSlab Engine - PRD

## Product Vision
"Operating System for Sports Card Traders" - A full-featured platform for managing sports card inventory, eBay listings, market intelligence, and trading operations. Focus on being the best tool for managing the business of selling cards.

## CRITICAL DEPLOYMENT NOTES
- **PRODUCTION BUILD MUST USE:** `REACT_APP_BACKEND_URL=https://flipslabengine.com CI=false yarn build`
- After build: Save to GitHub -> git pull on server -> bash fix.sh -> Ctrl+Shift+R

## Navigation Order (confirmed by user)
1. Dashboard
2. Inventory
3. Listings
4. Flip Finder
5. Market
6. Account

## Mobile Bottom Nav
Home | Inventory | Scan | Listings | Flip

## Completed Features
- [x] Full authentication (Google Auth + session cookies + email/password)
- [x] Scanner desktop app with duplex scanning
- [x] AI card identification from photos (OpenAI GPT-4o)
- [x] eBay integration with per-user token isolation
- [x] Landing page, Onboarding wizard
- [x] Mobile/Tablet Responsiveness, Quick Scan, PWE Shipping
- [x] Photo Editor: Preset-based + intensity slider
- [x] Flip Finder: Monitor, Auction Alerts, Analyze, History, AI tabs
- [x] Market Intelligence: Seasonal Intelligence, Hot Cards, Upcoming Releases, Watchlist
- [x] Sales-focused Dashboard (Command Center + Sales Overview)
- [x] Navigation restored: Flip Finder + Market sections (Mar 2026)
- [x] Batch Scan Mode: "Scan New Card" button after saving for rapid consecutive scanning (Mar 2026)
- [x] Code cleanup: Removed PortfolioTracker.jsx, Scrapedo references from market.py/ebay.py/config.py (Mar 2026)
- [x] Image compression optimized: MAX 900px, quality 0.65 to prevent mobile "low memory" errors (Mar 2026)
- [x] Flip Finder mobile responsiveness: tabs, stats, filters, grid all optimized (Mar 2026)
- [x] Listing Detail/Edit page mobile responsiveness: image, market panel, edit fields all optimized (Mar 2026)

## Pending Tasks
- **P0:** Whatnot Integration & Inventory Sync Engine
- **P1:** Stripe subscription integration (Free, Pro, Dealer)
- **P2:** New User Onboarding improvements
- **P3:** Flip Finder core logic enhancements
- **P4:** Windows Scanner App
- **Refactor:** Extract CardDetailModal from InventoryModule.jsx (900+ lines)

## User Preferences
- Language: Spanish
- Mobile-first user base
- Production domain: flipslabengine.com

## Key Architecture
- Frontend: React + Tailwind + shadcn/ui + framer-motion
- Backend: FastAPI + MongoDB
- Auth: Session cookies (not JWT)
- 3rd Party: eBay API, OpenAI GPT-4o, Emergent Google Auth
- Scrapedo: REMOVED (no longer used)
