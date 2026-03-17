# FlipSlab Engine - PRD

## Product Vision
"Operating System for Sports Card Traders" - A full-featured platform for managing sports card inventory, eBay listings, market intelligence, and trading operations.

## Core Modules
1. **Dashboard** - Trading command center with KPI cards, auction alerts, sales overview, portfolio value tracking
2. **Inventory** - Card management with AI identification, batch upload, front/back pairing, labeled action buttons
3. **Market** - Seasonal Intelligence with market pulse, calendar, recommendations, Buy Season Deals
4. **Flip Finder** - Card flipping opportunity analysis (core logic P3)
5. **Listings** - eBay listing creation/management with Best Offer, 4 shipping profiles, quantity, variation
6. **Account** - User settings, eBay connection, scanner token management
7. **Quick Scan** - Mobile camera-based card capture with AI auto-identification

## Completed Features
- [x] Full authentication (Google Auth + JWT)
- [x] Scanner desktop app with duplex scanning + natural sort fix
- [x] AI card identification from photos
- [x] eBay integration with per-user token isolation
- [x] Landing page ("Track. Flip. Sell.")
- [x] Market Seasonal Intelligence
- [x] Onboarding wizard
- [x] Mobile/Tablet Responsiveness (375px + 768px)
- [x] Quick Scan Mobile Feature (camera -> AI -> inventory)
- [x] Best Offer Toggle (all listing forms)
- [x] PWE Envelope Shipping $2.50 US domestic (all listing forms)
- [x] Image Compression (800px max, JPEG 0.7)
- [x] CreateListingView: Quantity, Variation, Best Offer, PWE Envelope
- [x] **Inventory Card Actions (Feb 2026)**: Buttons moved below cards with labels (List, Price, Edit, Delete)

## Pending Tasks
- **P1:** Whatnot Integration & Inventory Sync (awaiting API access)
- **P2:** Auto-refresh portfolio value
- **P3:** Flip Finder core logic
- **P4:** Stripe subscription integration

## User Preferences
- Language: Spanish
- Mobile-first user base
- Hands-on with UI/UX - always consult before visual changes
- Production domain: flipslabengine.com
