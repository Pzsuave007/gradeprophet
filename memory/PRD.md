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

## Prioritized Backlog

### P0 (Critical) - RESOLVED
- ~~Market value lookup uses active listings instead of sold items~~ → FIXED (Marzo 2026)

### P1 (High Priority) - Next
- **Account Module**: Profile, settings, preferences
- **Full Flip Calculator**: Complete profit analysis in Flip Finder

### P2 (Medium Priority)
- Import eBay listings to inventory automatically
- Batch listing operations (bulk price change)
- End/relist listings from the app

### P3 (Nice to Have)
- Refactorizar server.py en routers modulares
- Scheduled daily searches, PDF reports, price notifications
