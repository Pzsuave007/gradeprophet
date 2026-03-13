# FlipSlab Engine - Operating System for Sports Card Traders

## Original Problem Statement
Plataforma completa de trading para tarjetas deportivas. Sistema operativo centralizado para traders.

## Platform Structure
1. **Dashboard** - KPIs, cards escaneadas, movers - COMPLETO
2. **Inventory** - Colección de tarjetas CRUD - COMPLETO
3. **Market** - Precios en tiempo real - COMPLETO
4. **Flip Finder** - Scanner AI + Monitor eBay - COMPLETO
5. **Listings** - Publicar y administrar eBay listings - COMPLETO
6. **Account** - Configuración de cuenta - BASICO

## What's Been Implemented

### Marzo 2026 - Sold Data Fix (P0 Critical Bug)
- **Fixed market valuation**: Now uses REAL eBay sold/completed item prices instead of active listing prices
- Implemented Jina Reader API (free, no key) to scrape eBay sold listings page
- Each item now includes `date_sold` (e.g., "Mar 11, 2026") and `source: "sold"`
- Frontend shows "SOLD DATA" green badge when data comes from actual sales
- Frontend displays sold dates next to each comparable sale
- Graceful fallback to Browse API (active listings) with "Active Listings" badge when no sold data available
- `data_source` field correctly reflects actual data origin (not tied to SCRAPEDO key)

### Marzo 2026 - Market Intelligence Redesign
- **Complete overhaul**: Market section transformed from simple search into "Market Intelligence" hub
- **KPI Strip**: Collection (3 cards, $1.9k invested), Revenue ($587.53), Profit ($498.37), Avg Sale ($36.72)
- **Sales Performance**: Stock-market style area chart showing cumulative Revenue + Profit
- **Your Collection**: Sidebar showing inventory items with costs, clickable for instant price lookup
- **Hot on the Market**: Trending cards auto-curated by user's sports interests (detected from inventory)
- **My Watchlist**: CRUD system to track players/cards — add, lookup, remove. Stored in MongoDB
- **Price Lookup**: Big search bar with large median prices, stats (count, avg, range), recent comparable sales with eBay links
- **Monthly Performance**: Bar chart showing monthly revenue vs profit
- New endpoints: `/api/market/watchlist` (GET/POST/DELETE), `/api/market/hot-cards`, `/api/market/portfolio-health`
- Auto sport detection from card names (Basketball, Baseball, Football, Soccer, Hockey)

### Marzo 2026 - Dashboard Redesign (Epic Analytics Center)
- **New Dashboard**: Complete redesign as "FlipSlab HQ" trading command center
- 5 KPI cards: Revenue, Profit, Active Listings, Inventory, Avg Sale
- **Sales Performance** area chart (stock-market style) with Revenue + Profit lines
- **Monthly Revenue** bar chart showing growth trend
- **By Sport** donut chart grouping inventory by sport (auto-detection from card names)
- **Top Players** horizontal bar chart showing value by player
- **Recent Sales** table (16 orders) with buyer, date, price, profit per sale
- **Best Sale** highlight card
- **Ending Soon** widget showing listings about to expire with countdown
- **Date Range Filter** (30D / 90D / 180D / ALL) filters all charts and KPIs
- Quick navigation buttons to Inventory and Listings
- New backend endpoint: `/api/dashboard/analytics` aggregates eBay orders, inventory, active listings
- Auto-detect sport from card names (Basketball, Baseball, Football, Soccer, Hockey)

### Marzo 2026 - Listing Market Comparison Fix
- **Fixed**: Market data no longer disappears after loading in listing detail view
- Split `useEffect` into separate form init and market fetch effects, using stable `listingId` dependency
- Added cancellation token to prevent stale state updates
- Redesigned into prominent **3-column Price & Market Comparison** panel:
  - Your Price | Market Median | Status (% above/below/fair)
- Shows "Sold Data" or "Active Listings" badge to indicate data source
- Recent sales with sold dates always visible below stats

### Febrero 2026 - Smart Market Comparison
- **Grade-aware search**: Detects PSA/BGS/SGC grades in listing titles automatically
- Graded cards (e.g. PSA 8) → compares with same grade sales + raw reference
- Raw cards → compares with raw sales + PSA 10 potential value
- "Your Price vs Market" indicator using correct grade median
- Updated across: Listings detail, Market module, MarketValueCard popup

### Febrero 2026 - eBay Listings Module (Module 5)
- Create listings from inventory with auto-generated title/description
- Inline detail view (no popup, mobile-friendly) with card image, info, edit
- Edit title, price, quantity, description → apply changes to eBay via Trading API
- Market comparison panel with recent sales and price position indicator
- Grid view: large gradient price overlay, BIN/Auction badges, hover edit
- Predefined shipping: Free Shipping, USPS First Class, USPS Priority

### Febrero 2026 - List/Grid View Toggle
- Grid default view in all modules
- ViewToggle component across Inventory, Market, Flip Finder, Listings

### Earlier - Dashboard, Inventory, Market, Flip Finder, eBay OAuth
- Full eBay OAuth 2.0 integration (user: pazacap0)
- AI Card Scanner with GPT-4o Vision
- Full CRUD inventory with categories
- Market search + Flip Calculator

## API Endpoints
### Key endpoints
- `GET /api/market/card-value` - Smart grade-aware market value (primary + secondary)
- `POST /api/ebay/sell/create` - Create eBay listing
- `POST /api/ebay/sell/revise` - Edit eBay listing (ReviseFixedPriceItem/ReviseItem)
- `POST /api/ebay/sell/preview` - Generate listing title/description
- `GET /api/ebay/seller/my-listings` - Active listings
- Full CRUD: /api/inventory, /api/dashboard/*, /api/cards/analyze

## Tech Stack
- Backend: FastAPI, MongoDB (motor), Pydantic, httpx
- Frontend: React, Tailwind CSS, shadcn/ui, lucide-react, framer-motion
- Integrations: eBay OAuth/API, OpenAI Vision (Emergent LLM Key), Jina Reader API (free scraping)
- Key dependency: Jina Reader API (`https://r.jina.ai/`) for eBay sold items scraping (no API key needed)
- `created_listings`, `inventory`, `card_analyses`, `psa10_references`, `watchlist_cards`, `ebay_listings`, `ebay_tokens`

### Marzo 2026 - User Profile + AI Listing Optimization
- **User Profile/Settings**: Account module now has Seller Profile with display name, ZIP code, location, default shipping, default sport
- **AI-Generated Listings**: New `POST /api/ebay/sell/ai-listing` endpoint generates SEO-optimized 80-char titles and compelling descriptions using gpt-4o
- **Auto-fill from Profile**: Create Listing form auto-loads user's ZIP/location/shipping defaults from profile
- New endpoints: `GET/PUT /api/settings` for user preferences
- DB: `user_settings` collection stores seller profile data

### Marzo 2026 - eBay Listing Creation Bug Fix
- **Fixed 5 eBay API errors** that prevented listing creation:
  1. Removed deprecated PayPal payment method (managed payments)
  2. Added PostalCode + Location fields
  3. Added required ItemSpecifics: Sport, Grade, Professional Grader, Player, Season, Set, Card Number
  4. Added ConditionDescriptors (40001) for Card Condition (required by eBay for trading cards)
  5. Fixed image upload: upscale to 500px+ for eBay, uses UploadSiteHostedPictures API
- Added `sport` field to inventory data model (auto-detected by AI)
- Frontend: Added ZIP Code and Location fields to CreateListingView form
- Thumbnails now stored at 600px (was 400px) to meet eBay minimum
- Verified: Listing created successfully on eBay (Item ID: 397706895078)

### Marzo 2026 - AI Card Auto-Identification + Inline Form + Back Image
- **AI Auto-Fill**: Upload a card photo → AI (gpt-4o via Emergent LLM Key) identifies card_name, player, year, set, card#, variation, condition, grade → all form fields auto-fill
- **No More Popup**: Replaced modal/popup Add/Edit form with inline view (mobile-friendly)
- **Front + Back Image**: Add Card form now supports both front and back card images side by side
- **Emergent LLM Migration**: All OpenAI SDK usage replaced with emergentintegrations library
- New endpoint: `POST /api/cards/identify` returns structured JSON card identification
- DB schema: `inventory` collection now has `back_image` field (base64 thumbnail)

### Marzo 2026 - Create Listing from Inventory (Complete Flow)
- **Bug Fix**: Fixed response check in CreateListingView.jsx (`res.data.success` instead of `res.data.status === 'success'`)
- **Bug Fix**: Fixed "Total Cards" stat displaying `total_quantity` instead of `total_cards`
- Full end-to-end flow: Select cards in Inventory → Create Listing form → Publish to eBay
- Multi-select support: Select individual cards or "Select All"
- Single card quick-list via hover shopping bag icon
- Batch actions: Apply format/shipping to all listings at once
- Preview API auto-generates title, description, condition, and suggested price
- Tested: 100% pass rate (9 backend + 12 frontend tests)

## Prioritized Backlog

### Marzo 2026 - Image Processing Pipeline (Auto-Crop, Enhance, Back ID)
- **Auto-Crop + Black Background**: OpenCV contour detection finds card edges in phone photos, crops and centers on clean black background with 8% padding margin
- **Color Enhancement**: Pillow-based processing: saturation +25%, contrast +15%, sharpness +30%, brightness +5% — makes cards look vibrant and professional
- **Back Image AI Identification**: Upload back photo triggers re-identification with both front + back images using GPT-4o. Back of card reveals year, set, card number, variation — critical for raw cards
- Pipeline: `process_card_image()` = crop → enhance → resize (800px max)
- Applied to both create and update inventory endpoints
- 100% test pass rate (iteration_17: 10 backend + frontend UI tests)

### Marzo 2026 - Smart Market Comparison for Listings (Structured Search)
- **Improved**: Market comparison in Listings detail now uses structured card data (year, set, player, card#, sport, grade) instead of AI-generated title
- Backend `/api/market/card-value` accepts optional `ebay_item_id` param to look up inventory item
- Builds targeted eBay search query: e.g. "1997 Topps Kobe Bryant #171 Basketball Card PSA 9.0"
- Much more accurate results than searching with SEO-optimized title keywords

### Marzo 2026 - Listed Tab in Inventory (Inventory Lifecycle Complete)
- **3 new tabs**: Collection, For Sale, Listed (plus All)
- Cards automatically move to "Listed" tab when published to eBay
- Cards return to original tab when eBay listing is ended
- Listed tab hides Select/Add buttons (can't re-list listed cards)
- Listed cards show eBay badge, listed price, and profit margin
- Backend stats exclude listed items from collection/for_sale counts
- "View on eBay" link on listed cards (opens eBay listing)
- 100% test pass rate (9 backend + 12 frontend tests)

### Marzo 2026 - Auto-Crop Aspect Ratio Fix (Back Image Cut Off)
- **Fixed**: Back images were getting cropped at the top when uploaded to eBay
- Root cause: OpenCV contour detection missed the top edge of cards (especially backs with light colors)
- Added aspect ratio enforcement (standard card = 2.5x3.5, ratio 1.4) to auto_crop_card()
- When detected box ratio doesn't match card ratio, extends upward (60% top bias) to recover missing area
- Increased padding from 10% to 15% for extra safety margin
- Also handles graded slabs (taller ratio ~1.6-1.8) correctly

### Marzo 2026 - Batch Upload (Card Dealer Pro Style)
- **New Feature**: Upload 20+ scanned card images at once with AI auto-identification
- **Workflow**: Upload files → Pair front/back → AI identifies each card → Review/edit table → Save all to inventory
- **Pairing Modes**: "Front + Back (Alternating)" for duplex scanners, "Front Only" for single-side scans
- **Category Selection**: Choose Collection or For Sale for the entire batch
- **AI Identification**: Uses GPT-4o via Emergent LLM Key for each card, with real-time progress bar
- **Editable Review**: Each card expandable with full form fields (name, player, year, set, condition, grade, price)
- **Backend**: `POST /api/inventory/batch-save` endpoint saves multiple cards at once with image processing
- **Frontend**: New "Batch Upload" tab in Inventory module alongside "My Cards" and "Scan Card"
- 100% test pass rate (8 backend + 12 frontend tests, iteration_18)

### Marzo 2026 - Card Ladder Features (Portfolio, Alerts, Price Charts)
- **Portfolio Value Tracker**: Dashboard tab showing total portfolio value, invested, P&L, ROI KPIs
  - "Refresh All Values" button auto-lookups market price for each card via eBay sold data
  - Stores daily snapshots for trend chart over time
  - Card Values table shows each card with market value, cost, and P&L
  - Endpoints: GET /api/portfolio/summary, POST /api/portfolio/refresh-value/{id}, POST /api/portfolio/snapshot
- **Price Alerts**: Create alerts for when card prices drop below or rise above target
  - Full CRUD: create, list, delete alerts
  - "Check Now" button checks all active alerts against live market prices
  - Triggered alerts highlighted with badge
  - Integrated in Market module between Watchlist and Monthly Performance
  - Endpoints: POST/GET/DELETE /api/alerts, POST /api/alerts/check
- **Price History Chart**: Visual price trend chart for individual cards
  - Accessible from inventory grid/list view via TrendingUp icon
  - Shows scatter plot of recent eBay sold prices over time
  - Stats strip: median, range, trend %, sales count
  - Recent sold list with links to eBay
- 100% test pass rate (16 backend + all frontend tests, iteration_19)

### P0 (Critical) - ALL RESOLVED

### P1 (High Priority) - Next
- **Refactor server.py**: Break monolithic file into modular routers (dashboard, market, ebay, inventory)
- **Account Module**: Profile, settings, preferences
- **Full Flip Calculator**: Complete profit analysis in Flip Finder

### P2 (Medium Priority)
- Import eBay listings to inventory automatically
- Batch listing operations (bulk price change)
- End/relist listings from the app

### P3 (Nice to Have)
- Scheduled daily searches, PDF reports, price notifications
