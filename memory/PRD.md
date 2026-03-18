# FlipSlab Engine - PRD

## Product Vision
"Operating System for Sports Card Traders" - A full-featured platform for managing sports card inventory, eBay listings, market intelligence, and trading operations.

## CRITICAL DEPLOYMENT NOTES
- **PRODUCTION BUILD MUST USE:** `REACT_APP_BACKEND_URL=https://flipslabengine.com CI=false yarn build`
- **NEVER** use the preview URL (`trader-photo-lab.preview.emergentagent.com`) in production builds
- The preview .env is for local dev only — production builds override it via env var at build time
- After build: Save to GitHub → git pull on server → bash fix.sh → Ctrl+Shift+R

## Core Modules
1. **Dashboard** - Trading command center with KPI cards, auction alerts, sales overview
2. **Inventory** - Card management with AI identification, batch upload, photo editor
3. **Market** - Seasonal Intelligence with market pulse, calendar, recommendations
4. **Flip Finder** - Card flipping opportunity analysis (P3)
5. **Listings** - eBay listing creation/management
6. **Account** - User settings, eBay connection, scanner token management
7. **Quick Scan** - Mobile camera-based card capture with AI auto-identification

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
- [x] **Photo Editor (Feb 2026)**: Preset-based (Original, Bright, Clean, Sharp, eBay Ready, Pop) + intensity slider. Fullscreen editor mode with before/after comparison.
- [x] **Removed auto-enhance from upload pipeline (Feb 2026)**: Images saved natural (crop + resize only). "Pop" preset = old auto-enhance values available manually.

## Pending Tasks
- **P1:** Whatnot Integration & Inventory Sync (awaiting API access)
- **P2:** Auto-refresh portfolio value
- **P3:** Flip Finder core logic
- **P4:** Stripe subscription integration

## Technical Notes
- Photo Editor: CSS filters for live preview, SVG feConvolveMatrix for sharpness, canvas-based save at JPEG 0.92
- Upload pipeline: auto_crop → resize to 800px (NO color enhancement)
- "Pop" preset = Sat+25%, Con+15%, Sharp+30%, Bright+5%

## User Preferences
- Language: Spanish
- Mobile-first user base
- Prefers subtle, clean photo adjustments over saturated looks
- Production domain: flipslabengine.com
