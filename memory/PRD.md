# FlipSlab Engine - PRD

## Product Vision
"Operating System for Sports Card Traders" - A full-featured platform for managing sports card inventory, eBay listings, market intelligence, and trading operations.

## CRITICAL DEPLOYMENT NOTES
- **PRODUCTION BUILD MUST USE:** `REACT_APP_BACKEND_URL=https://flipslabengine.com CI=false yarn build`
- After build: Save to GitHub → git pull on server → bash fix.sh → Ctrl+Shift+R

## Completed Features
- [x] Full authentication (Google Auth + JWT + email/password)
- [x] Scanner desktop app with duplex scanning
- [x] AI card identification from photos
- [x] eBay integration with per-user token isolation
- [x] Landing page, Market Seasonal Intelligence, Onboarding wizard
- [x] Mobile/Tablet Responsiveness, Quick Scan, PWE Shipping
- [x] Photo Editor: Preset-based + intensity slider
- [x] My Collection with Card Ladder-inspired valuations
- [x] Market Value Engine v2: Scrapedo scraper, IQR + median cap, recency-weighted avg
- [x] Market Value Bug Fix: $469 → ~$45 for Kobe PSA 9
- [x] Variation field in search queries, Individual Refresh Value button
- [x] Front/Back Card Flip: 3D animation in My Collection
- [x] Collection Overview Panel: Donut chart replacing KPI bubbles
- [x] **Market Value in Inventory (Mar 2026):** All cards in Inventory now show market value with blue "MKT" indicator, P&L vs cost (green/red), and a visual market value bar with ROI% in the card detail modal.

## Pending Tasks
- **P0:** AI-Powered Sales Data Validation (use LLM to validate scraped listing titles)
- **P1:** Whatnot Integration & Inventory Sync
- **P2:** Auto-refresh portfolio value
- **P3:** Flip Finder core logic
- **P4:** Stripe subscription integration
- **Refactor:** Extract CardDetailModal from InventoryModule.jsx (>1000 lines)

## User Preferences
- Language: Spanish
- Mobile-first user base
- Production domain: flipslabengine.com
