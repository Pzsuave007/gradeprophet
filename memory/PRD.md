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
7. **Quick Scan** - Mobile camera-based card capture with AI auto-identification (NEW Feb 2026)

## Tech Stack
- Frontend: React + Tailwind CSS + Framer Motion + Shadcn UI
- Backend: FastAPI + MongoDB
- Auth: Emergent Google Auth + custom JWT
- AI: OpenAI GPT-4o (card identification + grading)
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
- [x] Mobile/Tablet Responsiveness - All pages verified at 375px and 768px
- [x] **Quick Scan Mobile Feature (Feb 2026)** - Camera-based card capture → AI identification → one-tap save

## Quick Scan Feature Details
- Accessible via: floating action button (FAB) on mobile + sidebar link
- 3-step flow: Front photo → Back photo (optional) → AI Review → Save
- Uses device camera via `capture="environment"` attribute
- AI identifies card using existing `/api/cards/identify` endpoint (GPT-4o)
- Saves directly to inventory via `/api/inventory` endpoint
- Full-screen overlay with z-[100] for mobile-first experience
- UI in Spanish (Tomar Foto, Cerrar, Guardar en Inventario)

## Key Architecture Decisions
- eBay tokens stored per user_id in `ebay_tokens` collection
- Frontend pre-compiled with production URL for deployment
- Season-based market intelligence using current month
- Sidebar navigation with mobile hamburger menu + slide-in overlay
- Quick Scan as fullscreen overlay, not a separate route

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
