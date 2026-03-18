# FlipSlab Engine - PRD

## Product Vision
"Operating System for Sports Card Traders" - A full-featured platform for managing sports card inventory, eBay listings, market intelligence, and trading operations.

## CRITICAL DEPLOYMENT NOTES
- **PRODUCTION BUILD MUST USE:** `REACT_APP_BACKEND_URL=https://flipslabengine.com CI=false yarn build`
- **NEVER** use the preview URL in production builds
- After build: Save to GitHub → git pull on server → bash fix.sh → Ctrl+Shift+R

## Core Modules
1. **Dashboard** - Trading command center with KPI cards, auction alerts, sales overview
2. **Inventory** - Card management with AI identification, batch upload, photo editor
3. **My Collection** - Portfolio tracker with Card Ladder-inspired market valuations, individual refresh buttons, front/back card flip
4. **Market** - Seasonal Intelligence with market pulse, calendar, recommendations
5. **Flip Finder** - Card flipping opportunity analysis (P3)
6. **Listings** - eBay listing creation/management
7. **Account** - User settings, eBay connection, scanner token management
8. **Quick Scan** - Mobile camera-based card capture with AI auto-identification

## Completed Features
- [x] Full authentication (Google Auth + JWT + email/password)
- [x] Scanner desktop app with duplex scanning
- [x] AI card identification from photos
- [x] eBay integration with per-user token isolation
- [x] Landing page ("Track. Flip. Sell.")
- [x] Market Seasonal Intelligence
- [x] Onboarding wizard
- [x] Mobile/Tablet Responsiveness
- [x] Quick Scan Mobile Feature
- [x] Best Offer Toggle, PWE Shipping, Quantity, Variation (all listing forms)
- [x] Image Compression (1200px max, JPEG 0.8)
- [x] Mobile UI Overhaul: Bottom nav bar, full-screen card detail modal
- [x] Photo Editor (Feb 2026): Preset-based + intensity slider
- [x] Removed auto-enhance from upload pipeline (Feb 2026)
- [x] My Collection with Card Ladder-inspired valuations
- [x] Market Value Engine v2 (Mar 2026): Scrapedo scraper, IQR + median cap outlier filtering, recency-weighted averaging, confidence scores
- [x] Market Value Bug Fix (Mar 2026): Fixed $469 → ~$45 for Kobe Bryant PSA 9. Title-based filtering, weighted avg uses only filtered items
- [x] Variation field in search queries (Mar 2026): Card variation (e.g., "Silver Prizm") included in market value searches
- [x] Individual Refresh Value button (Mar 2026): Each card has its own "Refresh Value" button
- [x] **Front/Back Card Flip (Mar 2026):** Click-to-flip 3D animation in My Collection grid view. Shows front and back of cards with smooth CSS 3D transform. Blue rotate icon indicator on hover.

## Pending Tasks
- **P0:** AI-Powered Sales Data Validation (use LLM to validate scraped listing titles)
- **P1:** Whatnot Integration & Inventory Sync (awaiting API access)
- **P2:** Auto-refresh portfolio value
- **P3:** Flip Finder core logic
- **P4:** Stripe subscription integration
- **Refactor:** Extract CardDetailModal from InventoryModule.jsx (>1000 lines)

## Technical Notes
- Photo Editor: CSS filters for live preview, SVG feConvolveMatrix for sharpness, canvas-based save at JPEG 0.92
- Upload pipeline: auto_crop → resize to 800px (NO color enhancement)
- Market Value Engine: Scrapedo proxy → title filter → IQR outlier filter → median cap (3x) → recency-weighted avg (45-day decay)
- Title filter removes: lots, bulk, reprints, facsimiles, NFTs, wrong parallels, grade mismatches
- Search query builder includes: year, set_name, player, card_number, variation, grade/company
- Card flip: CSS perspective + rotateY transform, 500ms transition, backface-visibility hidden

## User Preferences
- Language: Spanish
- Mobile-first user base
- Prefers subtle, clean photo adjustments over saturated looks
- Production domain: flipslabengine.com
