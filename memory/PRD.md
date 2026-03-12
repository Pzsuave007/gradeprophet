# FlipSlab Engine - Operating System for Sports Card Traders

## Original Problem Statement
El usuario quiere expandir su webapp "GradeProphet" a una plataforma completa de trading llamada "FlipSlab Engine". El objetivo es crear un sistema operativo centralizado para traders de tarjetas deportivas.

## Platform Structure
1. **Dashboard** - Vista general del negocio (KPIs, cards escaneadas, movers) - COMPLETO
2. **Inventory** - Administrar coleccion de tarjetas (COMPLETO)
3. **Market** - Precios en tiempo real, tendencias (COMPLETO)
4. **Flip Finder** - Scanner AI + Monitor eBay (COMPLETO)
5. **Listings** - Publicar y administrar eBay listings (COMPLETO)
6. **Account** - Configuracion de cuenta (BASICO)

## What's Been Implemented

### Febrero 2026 - Module 5: eBay Listings System
- **Create Listings**: Publish cards from inventory to eBay with auto-generated title/description
- **Listing Detail View**: Inline detail (no popup, mobile-friendly) with card image, listing info
- **Edit Listings**: Edit title, price, quantity, description and apply changes to eBay via Trading API
- **Market Comparison**: Shows Raw/Ungraded and PSA 10 market data alongside your listing for price comparison
- **Recent Sales**: Displays recent eBay sales for the card within the listing detail
- **Price vs Market Indicator**: Shows if your price is above/below/in range with market median
- **Grid View Enhancement**: Large gradient price overlay, BIN/Auction badges, hover edit overlay
- **Backend**: POST /api/ebay/sell/create (AddItem/AddFixedPriceItem), POST /api/ebay/sell/revise (ReviseItem/ReviseFixedPriceItem), POST /api/ebay/sell/preview, GET /api/ebay/sell/created-listings

### Febrero 2026 - List/Grid View Toggle
- Reusable ViewToggle component across all modules
- Grid is the DEFAULT view in all modules
- Inventory, Market, Flip Finder (EbayMonitor) all support grid/list toggle
- Improved "No data" messages in Spanish

### Anteriores - Dashboard, Inventory, Market, Flip Finder, eBay OAuth
- Full OAuth 2.0 eBay integration (user: pazacap0)
- Dashboard with live KPIs from eBay
- Inventory CRUD with categories (Collection/For Sale)
- Market search with real-time eBay Browse API
- AI Card Scanner with GPT-4o Vision
- eBay Monitor with watchlist

## Technical Architecture
- **Frontend**: React + TailwindCSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **AI**: OpenAI GPT-4o Vision (Emergent LLM Key)
- **Market Data**: eBay Browse API + Trading API
- **Database**: MongoDB

## API Endpoints
### Listings (NEW)
- `POST /api/ebay/sell/preview` - Generate listing title/description from inventory item
- `POST /api/ebay/sell/create` - Create and publish eBay listing
- `POST /api/ebay/sell/revise` - Edit active eBay listing (title, price, quantity, description)
- `GET /api/ebay/sell/created-listings` - Get app-created listings

### eBay Seller
- `GET /api/ebay/seller/my-listings` - Active listings with images, prices, time left
- `GET /api/ebay/seller/sales` - Recent sales

### Market
- `GET /api/market/card-value` - Market value with raw + PSA 10 stats and recent sales

### Other existing endpoints
- Dashboard, Inventory CRUD, Flip Finder, eBay OAuth - all functional

## Database Collections
- `created_listings` (NEW) - Listings created through the app
- `inventory`, `card_analyses`, `psa10_references`, `watchlist_cards`, `ebay_listings`, `ebay_tokens`

## Prioritized Backlog

### P0 (Critical) - All Completed
- AI Card Scanner, Dashboard, Inventory, Market, Flip Finder, eBay OAuth, List/Grid Toggle, Listings Module

### P1 (High Priority) - Next
- **Account Module Expansion**: Profile, settings, preferences
- **Full Flip Calculator**: Complete profit analysis in Flip Finder

### P2 (Medium Priority)
- Import eBay listings to inventory automatically
- Batch listing operations (bulk price change, bulk relist)
- End/relist listings from the app

### P3 (Nice to Have)
- Refactorizar server.py en routers modulares
- Scheduled daily searches
- PDF reports export
- Price change notifications
- Mobile native app

## Deployment Notes
- `fix.sh` handles deployment (git pull -> copy -> build -> restart)
- User's server needs `git reset --hard origin/main` before first pull due to history rewrite
