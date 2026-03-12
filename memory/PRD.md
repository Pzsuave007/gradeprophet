# FlipSlab Engine - Operating System for Sports Card Traders

## Original Problem Statement
El usuario quiere expandir su webapp "GradeProphet" a una plataforma completa de trading llamada "FlipSlab Engine". El objetivo es crear un sistema operativo centralizado para traders de tarjetas deportivas que permite: rastrear colecciones, monitorear valores de mercado reales desde eBay, detectar flips rentables, automatizar listings en eBay, y monitorear cambios de precios.

## User Personas
- **Coleccionistas de tarjetas deportivas**: Quieren saber el valor potencial de sus tarjetas
- **Revendedores/Flippers**: Buscan maximizar ROI detectando oportunidades de compra/venta
- **Nuevos coleccionistas**: Necesitan aprender que buscar en tarjetas de calidad

## Platform Structure
1. **Dashboard** - Vista general del negocio (KPIs, cards escaneadas, movers, oportunidades) - COMPLETO
2. **Inventory** - Administrar coleccion de tarjetas (COMPLETO)
3. **Market** - Precios en tiempo real, tendencias (COMPLETO)
4. **Flip Finder** - Scanner AI + Monitor eBay (COMPLETO)
5. **Listings** - Publicar en eBay, administrar listings (PENDIENTE)
6. **Account** - Configuracion de cuenta (BASICO)

## What's Been Implemented

### Febrero 2026 - List/Grid View Toggle
- Reusable ViewToggle component across all modules
- Inventory: Toggle between list and grid card view
- Market: My Listings tab - grid/list toggle with card images, prices, metadata
- Market: My Collection tab - grid/list toggle with category badges
- Flip Finder (EbayMonitor): grid/list toggle for eBay listings
- Improved "No data" messages in Spanish ("Sin ventas raw/PSA 10 recientes")

### Marzo 2026 - Market Data & Flip Calculator
- Market search with real-time eBay Browse API data
- Shows Raw/Ungraded and PSA 10 prices separately with stats (median, avg, range)
- Flip Calculator: Raw Price vs PSA 10 Value - Grading Cost = Potential Profit + ROI%
- Individual listing details with images, prices, links to eBay
- Endpoints: /api/market/search, /api/market/card-value, /api/market/flip-calc

### Marzo 2026 - eBay Account Integration
- Full OAuth 2.0 user token flow for eBay seller account (pazacap0)
- Trading API integration for GetMyeBaySelling (active listings + sold items)
- Token storage in MongoDB with auto-refresh
- Account page with connection status
- Dashboard shows real active listings (73), sold items (9), prices, time remaining

### Marzo 2026 - Inventory Module
- Full CRUD for card collection management (add, edit, delete, search)
- Two categories: **Collection** (personal cards) and **For Sale** (cards to sell)
- "Add to Inventory" button on scan results to import analyzed cards with one click
- Duplicate import protection
- Fields: Card Name, Player, Year, Set, Card Number, Variation, Condition, Grade, Purchase Price, Quantity, Notes, Image Upload, Category
- Search by name, player, set, card number, variation
- Filters: Category tabs, Condition, Listed/Not Listed
- Stats cards: Total Cards, Total Invested, Graded count, Listed count

### Marzo 2026 - Dashboard Module
- Dashboard con 4 KPI cards (Estimated Value, Cards Scanned, eBay Listings, Flip Opportunities)
- Widget "Recently Scanned", "Price Movers", "Flip Opportunities"
- Integration with eBay Browse API for live market data

### Febrero 2026 - Core Features
- AI Card Scanner con GPT-4o Vision
- Monitor de eBay con watchlist
- Importador de imagenes desde eBay
- Auto-crop con OpenCV
- Calibracion de grados PSA
- Sistema de aprendizaje con feedback

## Technical Architecture
- **Frontend**: React + TailwindCSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **AI**: OpenAI GPT-4o Vision
- **Web Scraping**: Scrape.do API
- **Market Data**: eBay Browse API (OAuth 2.0 client credentials)
- **Database**: MongoDB

## 3rd Party Integrations
- OpenAI GPT-4o Vision (card analysis)
- Scrape.do (eBay scraping)
- eBay Browse API (market data) - Credentials: App ID, Client Secret, Dev ID configured

## API Endpoints
### Dashboard
- `GET /api/dashboard/stats` - KPIs principales
- `GET /api/dashboard/recent` - Tarjetas escaneadas recientemente
- `GET /api/dashboard/movers` - Movimientos de precios
- `GET /api/dashboard/opportunities` - Oportunidades de flip
- `GET /api/dashboard/ebay-market` - Datos de mercado eBay en vivo

### Inventory
- `GET /api/inventory` - List inventory items
- `POST /api/inventory` - Add card
- `PUT /api/inventory/{id}` - Update card
- `DELETE /api/inventory/{id}` - Delete card
- `GET /api/inventory/stats` - Inventory stats
- `POST /api/inventory/from-scan` - Add from scan

### Market
- `GET /api/market/card-value` - Get market value
- `GET /api/market/flip-calc` - Flip calculator
- `POST /api/market/solds` - Get sold listings

### eBay
- `GET /api/ebay/oauth/authorize` - Initiate OAuth
- `GET /api/ebay/seller/listings` - Active listings
- `GET /api/ebay/seller/sales` - Recent sales
- `GET /api/ebay/seller/my-listings` - My listings

### Flip Finder
- `POST /api/cards/analyze` - Analyze card
- `GET /api/cards/history` - History
- `POST /api/watchlist` - Add to watchlist
- `POST /api/watchlist/search` - Search eBay
- `GET /api/listings` - Get listings

## Database Collections
- `card_analyses` - Historial de analisis
- `psa10_references` - Referencias PSA 10
- `watchlist_cards` - Watchlist del monitor
- `ebay_listings` - Listings encontrados
- `inventory` - User card inventory
- `ebay_tokens` - OAuth tokens

## Key Files
- `/app/frontend/src/components/ViewToggle.jsx` - Reusable view toggle
- `/app/frontend/src/components/DashboardHome.jsx` - Dashboard UI
- `/app/frontend/src/components/MarketModule.jsx` - Market module with grid/list
- `/app/frontend/src/components/InventoryModule.jsx` - Inventory with grid/list
- `/app/frontend/src/components/EbayMonitor.jsx` - eBay monitor with grid/list
- `/app/frontend/src/components/FlipFinder.jsx` - Flip Finder module
- `/app/frontend/src/pages/Dashboard.jsx` - Layout principal con sidebar
- `/app/backend/server.py` - All API endpoints
- `/app/fix.sh` - Deployment script

## Prioritized Backlog

### P0 (Critical) - Completed
- AI Card Scanner, Historial, Monitor eBay, Dashboard, Inventory, Market Data, Flip Calculator, eBay OAuth, List/Grid View Toggle

### P1 (High Priority) - Next
- **Listings Module**: Administrar eBay listings activos desde la app, editar precios
- Import eBay listings to inventory automatically

### P2 (Medium Priority)
- **Account Module**: Configuracion, integraciones, preferencias
- **Full Flip Finder Logic**: Complete flip analysis with profit calculations

### P3 (Nice to Have)
- Refactorizar server.py en routers modulares
- Busqueda automatica diaria (scheduled job)
- Export de reportes (PDF)
- Notificaciones de cambios de precio
- App movil nativa

## Deployment
- Changes deployed via `fix.sh` script (git pull -> copy files -> build -> restart)
- eBay API credentials auto-added to server .env by fix.sh
- NOTE: User's server git needs `git reset --hard origin/main` due to history rewrite
