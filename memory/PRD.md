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

## Database Collections
- `created_listings`, `inventory`, `card_analyses`, `psa10_references`, `watchlist_cards`, `ebay_listings`, `ebay_tokens`

## Prioritized Backlog

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
