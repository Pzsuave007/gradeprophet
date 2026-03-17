# FlipSlab Engine - PRD

## Product Vision
"Operating System for Sports Card Traders" - A full-featured platform for managing sports card inventory, eBay listings, market intelligence, and trading operations.

## Core Modules
1. **Dashboard** - Trading command center with KPI cards, auction alerts, sales overview, portfolio value tracking
2. **Inventory** - Card management with AI identification from photos, batch upload, front/back image pairing
3. **Market** - Seasonal Intelligence with market pulse, season calendar, recommendations, and Buy Season Deals from eBay
4. **Flip Finder** - Card flipping opportunity analysis (core logic P3)
5. **Listings** - eBay listing creation and management with AI-powered titles/descriptions
6. **Account** - User settings, eBay connection, scanner token management

## Tech Stack
- Frontend: React + Tailwind CSS + Framer Motion + Shadcn UI
- Backend: FastAPI + MongoDB
- Auth: Emergent Google Auth + custom JWT
- AI: OpenAI GPT-4o (card identification)
- External: eBay API (per-user isolated tokens)
- Scanner: Windows desktop app (NAPS2 via CLI)

## Completed Features
- [x] Full authentication (Google Auth + JWT)
- [x] Scanner desktop app with duplex scanning + natural sort fix
- [x] AI card identification from photos
- [x] eBay integration with per-user token isolation (CRITICAL FIX)
- [x] Landing page ("Track. Flip. Sell.")
- [x] Market Seasonal Intelligence (pulse, calendar, recommendations, deals)
- [x] Onboarding wizard
- [x] **Mobile/Tablet Responsiveness (Feb 2026)** - All pages verified at 375px and 768px

## Key Architecture Decisions
- eBay tokens stored per user_id in `ebay_tokens` collection
- Frontend pre-compiled with production URL for deployment
- Season-based market intelligence using current month
- Sidebar navigation with mobile hamburger menu + slide-in overlay

## Pending Tasks
- **P1:** Whatnot Integration & Inventory Sync (awaiting API access)
- **P2:** Auto-refresh portfolio value
- **P3:** Flip Finder core logic
- **P4:** Stripe subscription integration

## User Preferences
- Language: Spanish
- Majority of users access via mobile/tablet
- User is very hands-on with UI/UX - always consult before visual changes
- Production domain: flipslabengine.com
