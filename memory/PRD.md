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
- [x] **Best Offer Toggle (Feb 2026)** - Enable/disable Best Offers on BIN listings (create + edit)
- [x] **PWE Envelope Shipping (Feb 2026)** - $2.50 flat rate for raw cards, US domestic only (create + edit)

## eBay Listing Features
- **Shipping profiles:** Free Shipping, PWE Envelope ($2.50 US), USPS First Class ($4.50), USPS Priority ($8.50)
- **Best Offer:** Toggle available for Buy It Now format only (hidden for Auctions)
- **Both features available in:** Create Listing modal AND Edit Listing view for existing listings
- **Backend mapping:** PWEEnvelope → USPSFirstClass in eBay API XML

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
