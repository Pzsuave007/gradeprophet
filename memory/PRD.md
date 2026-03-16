# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
Build "FlipSlab Engine" - an Operating System for Sports Card Traders. Features include AI-powered card identification, inventory management, eBay integration, market intelligence, portfolio tracking, listing creation, auction alerts, and cross-platform trading actions.

## Tech Stack
- **Frontend:** React, Tailwind CSS, shadcn/ui, Recharts, Axios, Framer Motion
- **Backend:** FastAPI (modular routers), MongoDB, OpenAI SDK (GPT-4o), feedparser
- **Auth:** JWT with httpOnly cookies (local), Emergent Google OAuth
- **Deployment:** git pull -> bash deploy.sh

## Production Server Setup
- **Apache** with cPanel on `flipslabengine.com` (132.148.78.187)
- **DocumentRoot:** `/home/flipcardsuni2/public_html/`
- **Git repo:** `/home/gradeprophet/`
- **Backend:** `/opt/gradeprophet/backend/` (uvicorn port 8001)
- **.htaccess:** Proxies `/api` -> port 8001, serves static files from public_html

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
- [x] Auction Alert System - Notifies user 1 min before auction ends
- [x] Monitor Filters - Filter by All Types / Auctions / Buy Now / Best Offer
- [x] Buy Now Action, Make Offer Action, Contextual Action Buttons
- [x] Global Terminology Refactor - "Snipe/Sniper" -> "Auction Alert/Alerts" (Mar 15, 2026)
- [x] **Onboarding Wizard** - 4-step setup for new users (Mar 15, 2026):
  - Step 1: Welcome with branding
  - Step 2: Select sports/categories (8 options)
  - Step 3: Raw/Graded/Both preference
  - Step 4: Add card searches (with smart suggestions per sport)
  - Auto-creates watchlist searches so dashboard is populated from day one
  - Skip option available

## Key API Endpoints
### Auth
- `POST /api/auth/register` - Returns `onboarding_completed: false`
- `POST /api/auth/login` - Returns `onboarding_completed` status
- `GET /api/auth/me` - Returns user + `onboarding_completed`

### Onboarding
- `GET /api/onboarding/status` - Check onboarding status
- `POST /api/onboarding/complete` - Save preferences + create watchlist searches
- `POST /api/onboarding/skip` - Skip onboarding

### Dashboard
- `GET /api/dashboard/command-center` - Aggregated command center data
- `GET /api/dashboard/analytics` - Full sales/inventory/listings analytics
- `GET /api/dashboard/hobby-news` - Hobby news RSS feed

### Auction Alerts
- `POST /api/snipes` - Create auction alert
- `GET /api/snipes` - List all alerts
- `DELETE /api/snipes/{id}` - Cancel alert
- `GET /api/snipes/firing` - Get triggered alerts
- `POST /api/snipes/{id}/ack` - Acknowledge alert

## Known Limitations
- **eBay automated bidding is prohibited** by eBay API policy
- **eBay Buy Now/Make Offer APIs** require special app approval

## Scanner App (Standalone Windows Desktop)
- [x] WIA scanner integration with native driver UI
- [x] Smart crop algorithm (background-subtraction based card detection)
- [x] 180 degree rotation for feeder scans
- [x] Uniform gray margin proportional to card size (v1.4 - Mar 16, 2026)
- [x] Auto color/contrast enhancement (autocontrast + saturation + sharpness)
- [x] **v2.0 - Programmatic WIA scanning (NAPS2-style)** (Mar 16, 2026):
  - No more Windows scan dialog - all settings controlled from within the app
  - Source dropdown: Feeder (Both sides) / Feeder (Single) / Flatbed
  - Paper Size presets: Sport Card, Sport Card Tight, Custom, Letter, Legal
  - Color/Grayscale and DPI selection
  - Fallback to native WIA dialog if programmatic scan fails
- [x] Upload to FlipSlab web app
- [x] One-click Windows installer (setup.bat)

## Next Tasks
- P1: Whatnot API Integration (waiting for API access approval)
- P1: Inventory Sync Engine (cross-listing eBay + Whatnot)
- P2: Auto-Refresh Portfolio Value
- P2: Build Flip Finder Core Logic (profitable flip detection)
- P3: Commercialize with Stripe (Pro plan)

## 3rd Party Integrations
- **eBay API** (Trading + Browse API)
- **OpenAI GPT-4o** - User-provided API key
- **Jina Reader API** - Fallback for market data
- **Emergent Google Auth** - Google OAuth
- **RSS Feeds (feedparser)** - Hobby Pulse news
- **Whatnot Seller API** - PENDING

## Code Architecture
```
backend/routers/
  auth.py          - Auth (register/login/session/me) + onboarding_completed field
  onboarding.py    - NEW: Onboarding status/complete/skip endpoints
  flipfinder.py    - Monitor, watchlist, alerts
  dashboard.py     - Command center, analytics, hobby news
  ...

frontend/src/components/
  OnboardingWizard.jsx  - NEW: 4-step onboarding wizard
  LandingPage.jsx       - Updated marketing (alert terminology)
  DashboardHome.jsx     - Command Center
  AuctionSniper.jsx     - Auction Alert system
  ...

frontend/src/App.js    - Routes: landing -> auth -> onboarding -> dashboard
```
