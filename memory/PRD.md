# FlipSlab Engine - Operating System for Sports Card Traders

## Original Problem Statement
El usuario quiere expandir su webapp "GradeProphet" a una plataforma completa de trading llamada "FlipSlab Engine". El objetivo es crear un sistema operativo centralizado para traders de tarjetas deportivas que permite: rastrear colecciones, monitorear valores de mercado reales desde eBay, detectar flips rentables, automatizar listings en eBay, y monitorear cambios de precios.

## User Personas
- **Coleccionistas de tarjetas deportivas**: Quieren saber el valor potencial de sus tarjetas
- **Revendedores/Flippers**: Buscan maximizar ROI detectando oportunidades de compra/venta
- **Nuevos coleccionistas**: Necesitan aprender qué buscar en tarjetas de calidad

## Platform Structure
1. **Dashboard** - Vista general del negocio (KPIs, cards escaneadas, movers, oportunidades)
2. **Inventory** - Administrar coleccion de tarjetas (PENDIENTE)
3. **Market** - Precios en tiempo real, tendencias (PENDIENTE)
4. **Flip Finder** - Scanner AI + Monitor eBay (COMPLETO)
5. **Listings** - Publicar en eBay, administrar listings (PENDIENTE)
6. **Account** - Configuracion de cuenta (PENDIENTE)

## What's Been Implemented

### Marzo 2026 - Dashboard Module
- Dashboard con 4 KPI cards (Estimated Value, Cards Scanned, eBay Listings, Flip Opportunities)
- Widget "Recently Scanned" - ultimas tarjetas analizadas con imagenes y grados PSA
- Widget "Price Movers" - mayores cambios de precio de tarjetas en watchlist
- Widget "Flip Opportunities" - listings interesantes con enlaces a eBay
- Integracion con eBay Browse API (OAuth client credentials) para datos de mercado en vivo
- Endpoint GET /api/dashboard/ebay-market para busquedas de mercado en tiempo real
- Navegacion por defecto al Dashboard al abrir la app
- Boton de refresh en Dashboard
- Links "View All" y "Monitor" para navegar entre modulos

### Marzo 2026 - Platform Restructure
- Reestructuracion de GradeProphet → FlipSlab Engine
- Sidebar navigation con todos los modulos
- Branding actualizado
- Paginas placeholder para modulos futuros

### Febrero 2026 - Core Features
- AI Card Scanner con GPT-4o Vision
- Monitor de eBay con watchlist
- Importador de imagenes desde eBay
- Auto-crop con OpenCV
- Calibracion de grados PSA
- Sistema de aprendizaje con feedback
- Mobile responsive design

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

### Flip Finder (existing)
- `POST /api/cards/analyze` - Analizar tarjeta
- `GET /api/cards/history` - Historial
- `POST /api/watchlist` - Agregar a watchlist
- `POST /api/watchlist/search` - Buscar en eBay
- `GET /api/listings` - Obtener listings
- Plus 15+ more endpoints

## Database Collections
- `card_analyses` - Historial de analisis
- `psa10_references` - Referencias PSA 10
- `watchlist_cards` - Watchlist del monitor
- `ebay_listings` - Listings encontrados

## Key Files
- `/app/frontend/src/components/DashboardHome.jsx` - Dashboard UI
- `/app/frontend/src/pages/Dashboard.jsx` - Layout principal con sidebar
- `/app/frontend/src/components/FlipFinder.jsx` - Modulo Flip Finder
- `/app/backend/server.py` - Todos los endpoints API
- `/app/fix.sh` - Script de deployment

## Prioritized Backlog

### P0 (Critical) - Completed
- AI Card Scanner, Historial, Monitor eBay, Dashboard Module

### P1 (High Priority) - Next
- **Inventory Module**: Administrar coleccion, costos, valores actuales
- **Market Module**: Precios en tiempo real, tendencias, comparaciones

### P2 (Medium Priority)
- **Listings Module**: Publicar en eBay, administrar listings activos
- **Account Module**: Configuracion, integraciones, preferencias
- eBay OAuth user token flow para acceder a listings del vendedor

### P3 (Nice to Have)
- Busqueda automatica diaria (scheduled job)
- Export de reportes (PDF)
- Notificaciones de cambios de precio
- App movil nativa

## Deployment
- Changes deployed via `fix.sh` script (git pull → copy files → build → restart)
- eBay API credentials auto-added to server .env by fix.sh
