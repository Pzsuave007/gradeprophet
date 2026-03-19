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

## Subscription Plans (Stripe)
- **ROOKIE** (Free): 30 cards/scans/listings, basic dashboard, Flip Finder & Market grayed out
- **ALL-STAR** ($9.99/mo): 200 cards/scans, 200 listings, full dashboard, Flip Finder partial, Market partial, no Photo Editor
- **HALL OF FAME** ($14.99/mo) Most Popular: 500 cards/scans/listings, full everything, Photo Editor + presets, priority support
- **LEGEND** ($24.99/mo): Unlimited everything, multi-marketplace, scanner software, team access, VIP support

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
- [x] Batch Scan Mode: "Scan New Card" button for rapid scanning (Mar 2026)
- [x] Code cleanup: Removed Scrapedo, PortfolioTracker (Mar 2026)
- [x] Image compression optimized for mobile (Mar 2026)
- [x] Flip Finder + Listing Detail mobile responsiveness (Mar 2026)
- [x] Stripe Subscription System: 4 plans, checkout, payment polling, webhook (Mar 2026)
- [x] Pricing UI in Account page with plan comparison (Mar 2026)
- [x] Feature Gating & Plan Limit Enforcement (Mar 2026)
  - FlipFinder: Full lock for Rookie, tab-level locks (Alerts, AI) for All-Star
  - Market: Full lock for Rookie, Seasonal Intelligence locked for All-Star
  - Dashboard: Sales Overview tab locked for Rookie
  - Photo Editor: Locked button for plans without photo_editor
  - Photo Editor: Crop tool with free rectangle selection, drag handles, rule-of-thirds grid
  - Backend: Inventory, scan, and listing limit checks with 403 responses
  - Frontend: 403 error handling with user-friendly upgrade prompts
  - eBay listing creation: Limit check before creating listings
- [x] Plan Usage Banner on Dashboard (Mar 2026)
  - Shows Inventory, AI Scans, Listings usage with animated progress bars
  - Color-coded: yellow at 80%, red at 100% limit
  - "Unlimited" display for Legend plan
  - Upgrade button for non-Legend users
- [x] Admin Panel at /admin (Mar 2026)
  - Platform stats: total users, revenue, signups, cards, scans
  - User management: list, search, pagination
  - Change user plans (Rookie/All-Star/Hall of Fame/Legend)
  - View any user's inventory
  - Ban/unban and delete users (cascade delete all data)
  - Payment transactions list
  - Protected: only pzsuave007@gmail.com has access
- [x] Public Card Shop at /shop/:slug (Mar 2026)
  - Public storefront for each user (no login required to view)
  - Custom shop URL chosen by user (e.g. flipslabengine.com/shop/kobecollector)
  - Shows all listed cards with images, sport, condition, price
  - Card detail modal with front/back flip, "Buy on eBay" button
  - Search, sport filter, sort by price
  - Header: Logo + shop name + location (left), Cards | Sales | Sports (right)
  - Real eBay sales count via Trading API (GetMyeBaySelling SoldList, cached 1hr)
  - "Powered by FlipSlab Engine" footer
  - Copy link + View Shop buttons in Account settings
  - Available to all plans
- [x] Update eBay Photos feature (Mar 2026)
  - Sync cropped/edited photos to existing eBay listings
  - Button in Photo Editor toolbar + Card Detail view
  - Uploads front + back images to eBay hosting, updates listing via ReviseFixedPriceItem

## Pending Tasks
- **P0:** Stripe Production Integration (switch from test keys to live keys)
- **P1:** Whatnot & Shopify Integration (Legend tier feature)
- **P2:** New User Onboarding improvements
- **P3:** Flip Finder core logic enhancements
- **P4:** Windows Scanner App
- **P5:** Team Access (multiple users per Legend account)
- **Refactor:** Extract CardDetailModal from InventoryModule.jsx (1300+ lines)

## Verification Log
- [Feb 2026] Card Shop verified: Backend 10/10, Frontend 26/26 tests passed (iteration_38)

## User Preferences
- Language: Spanish
- Mobile-first user base
- Production domain: flipslabengine.com

## Key Architecture
- Frontend: React + Tailwind + shadcn/ui + framer-motion
- Backend: FastAPI + MongoDB
- Auth: Session cookies (not JWT)
- 3rd Party: eBay API, OpenAI GPT-4o, Emergent Google Auth, Stripe
- DB Collections: users, inventory, subscriptions, payment_transactions, usage_stats
