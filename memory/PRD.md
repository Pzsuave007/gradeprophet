# FlipSlab Engine - PRD

## Product Vision
"Operating System for Sports Card Traders" - A full-featured platform for managing sports card inventory, eBay listings, market intelligence, and trading operations.

## Core Modules
1. **Dashboard** - Trading command center with KPI cards, auction alerts, sales overview, portfolio value tracking
2. **Inventory** - Card management with AI identification from photos, batch upload, front/back image pairing
3. **Market** - Seasonal Intelligence with market pulse, season calendar, recommendations, and Buy Season Deals from eBay
4. **Flip Finder** - Card flipping opportunity analysis (core logic P3)
5. **Listings** - eBay listing creation/management with AI titles, Best Offer toggle, 4 shipping profiles
6. **Account** - User settings, eBay connection, scanner token management
7. **Quick Scan** - Mobile camera-based card capture with AI auto-identification

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
- [x] eBay integration with per-user token isolation
- [x] Landing page ("Track. Flip. Sell.")
- [x] Market Seasonal Intelligence
- [x] Onboarding wizard
- [x] Mobile/Tablet Responsiveness (375px + 768px verified)
- [x] Quick Scan Mobile Feature (camera → AI → inventory)
- [x] Best Offer Toggle (create + edit listings)
- [x] PWE Envelope Shipping $2.50 US domestic (create + edit listings)
- [x] **Image Compression Fix (Feb 2026)** - All image uploads now compressed to max 800px, JPEG 0.7 quality

## Image Compression Details
- **Problem:** Phone cameras produce 5-15MB photos, causing "low memory" errors on mobile browsers
- **Fix:** All 3 upload paths now compress images before processing:
  - QuickScan: 800px max, JPEG 0.7 (was 1200px, 0.85)
  - InventoryModule: 800px max, JPEG 0.7 (was NO compression)
  - BatchUploadView: 800px max, JPEG 0.7 (was NO compression)
- Canvas memory is freed after compression (canvas.width = 0)

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
