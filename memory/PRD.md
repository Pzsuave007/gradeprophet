# GradeProphet - AI Sports Card Grading Predictor

## Original Problem Statement
El usuario quiere crear una webapp para analizar fotos de tarjetas deportivas (sports cards) y predecir el grado que recibirían de PSA (Professional Sports Authenticator). El sistema necesita basarse en los estándares de PSA y usar AI para el análisis. El objetivo es un negocio de grading donde solo se envían tarjetas con buen potencial de grado.

## User Personas
- **Coleccionistas de tarjetas deportivas**: Quieren saber el valor potencial de sus tarjetas antes de enviarlas a PSA
- **Revendedores**: Buscan maximizar ROI enviando solo tarjetas que obtendrán buenos grados
- **Nuevos coleccionistas**: Necesitan aprender qué buscar en una tarjeta de calidad

## Core Requirements (Static)
1. Upload de imágenes de tarjetas deportivas (JPEG, PNG, WEBP)
2. Análisis AI usando OpenAI GPT-4o Vision
3. Evaluación basada en estándares PSA:
   - Centering (Centrado)
   - Corners (Esquinas)
   - Surface (Superficie)
   - Edges (Bordes)
4. Grado estimado PSA (1-10)
5. Recomendación de enviar o no a PSA
6. Historial de tarjetas analizadas
7. Tema oscuro profesional
8. Análisis de frente y dorso de la tarjeta
9. Fotos de esquinas opcionales para análisis detallado
10. Biblioteca de referencias PSA 10 para comparación
11. Sistema de aprendizaje con feedback de grados reales
12. **Consideración de antigüedad de la tarjeta** - La IA ajusta estándares según el año
13. **Importar desde eBay** - Funcionalidad completa implementada
14. **Monitor de eBay** - Sistema de watchlist y búsqueda de nuevos listings

## What's Been Implemented

### Marzo 2026 (Actual)
- ✅ **Monitor de eBay COMPLETO**:
  - Nueva pestaña "Monitor eBay" en la navegación principal
  - Crear watchlist de tarjetas específicas (ej: "1996 Topps Kobe Bryant #138")
  - Botón "Buscar Nuevos Listings" que busca en eBay todas las tarjetas
  - Muestra listings con: imagen, título, precio, tipo (Subasta/Compra Directa)
  - Marcar listings como "Interesante" o "Visto"
  - Filtros: Nuevos, Interesantes, Todos
  - Enlace directo a eBay para ver el listing
  - Stats: total tarjetas, nuevos listings, interesantes
  - Parser HTML mejorado para extraer títulos correctamente de eBay

### Febrero 2026
- ✅ **Importador de eBay COMPLETO**:
  - Pegar URL de listing de eBay (soporta URLs completas y cortas ebay.us)
  - Descarga automática de imágenes usando Scrape.do API
  - Grid de miniaturas con sugerencias de tipo (Frente?/Dorso?)
  - Menú de asignación al hacer clic en una miniatura
  - Asignar imágenes a Frente/Dorso/4 Esquinas
  - Botón "Limpiar" para eliminar imágenes importadas
  - Auto-generar crops de esquinas desde la foto frontal

### Enero 2026
- ✅ Dashboard principal con zona de upload drag & drop
- ✅ Integración con OpenAI GPT-4o Vision para análisis
- ✅ Desglose detallado de grados por categoría
- ✅ Recomendación de envío a PSA con explicación
- ✅ Historial de análisis con MongoDB
- ✅ CRUD completo de tarjetas analizadas
- ✅ UI responsive con tema oscuro profesional
- ✅ Animación de escaneo durante análisis
- ✅ Upload de imagen frontal y dorso de la tarjeta
- ✅ Fotos opcionales de las 4 esquinas para análisis detallado
- ✅ Biblioteca de referencias PSA 10 con lectura automática del label
- ✅ Sistema de aprendizaje: feedback de grados reales de PSA
- ✅ Panel de estadísticas de precisión del AI
- ✅ Eliminación de análisis innecesarios
- ✅ Consideración de antigüedad de tarjetas (vintage adjustment)
- ✅ Detección automática de año desde referencia o por IA

## Technical Architecture
- **Frontend**: React + TailwindCSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **AI**: OpenAI GPT-4o Vision (standard `openai` library)
- **Web Scraping**: Scrape.do API for eBay imports
- **Database**: MongoDB

## API Endpoints
- `POST /api/cards/analyze` - Analiza imagen de tarjeta
- `GET /api/cards/history` - Historial de análisis
- `GET /api/cards/{id}` - Detalle de análisis
- `DELETE /api/cards/{id}` - Eliminar análisis
- `PUT /api/cards/{id}/feedback` - Agregar grado real de PSA
- `PUT /api/cards/{id}/status` - Actualizar estado
- `POST /api/references` - Guardar referencia PSA 10
- `GET /api/references` - Obtener biblioteca de referencias
- `DELETE /api/references/{id}` - Eliminar referencia
- `POST /api/ebay/import` - Importar imágenes desde URL de eBay
- `POST /api/corners/crop` - Auto-generar crops de esquinas
- **`POST /api/watchlist`** - Agregar tarjeta a watchlist
- **`GET /api/watchlist`** - Obtener watchlist
- **`DELETE /api/watchlist/{id}`** - Eliminar tarjeta de watchlist
- **`PUT /api/watchlist/{id}`** - Actualizar tarjeta de watchlist
- **`POST /api/watchlist/search`** - Buscar nuevos listings en eBay
- **`GET /api/listings`** - Obtener listings encontrados
- **`PUT /api/listings/{id}/status`** - Actualizar estado de listing
- **`DELETE /api/listings/{id}`** - Eliminar listing
- **`GET /api/listings/stats`** - Estadísticas de listings

## Database Collections
- **`card_analyses`**: Historial de análisis de tarjetas
- **`psa_references`**: Biblioteca de referencias PSA 10
- **`watchlist_cards`**: Tarjetas a monitorear en eBay
- **`ebay_listings`**: Listings encontrados en eBay

## Prioritized Backlog

### P0 (Critical) - Completed ✅
- Análisis de tarjetas con AI
- Historial persistente
- UI funcional
- Upload frente/dorso
- Fotos de esquinas
- Referencias PSA 10
- Sistema de aprendizaje
- Consideración de antigüedad de tarjetas
- **Importador de eBay COMPLETO**
- **Monitor de eBay COMPLETO**

### P1 (High Priority)
- Autenticación de usuarios
- Búsqueda automática diaria (scheduled job)
- Export de reportes (PDF)
- Dashboard de estadísticas avanzadas
- Asignación automática por IA (detectar qué imagen es frente/dorso)

### P2 (Medium Priority)
- API de precios en tiempo real (eBay, COMC)
- Integración con PSA submission
- Notificaciones de cambios de precio

### P3 (Nice to Have)
- App móvil nativa
- Scanning batch de múltiples tarjetas
- Marketplace integrado
- Predicción de tendencias de precio

## Known Issues
- Scrape.do API tiene errores 502 intermitentes (~30% de requests). Reintentar usualmente funciona.
- El proceso de búsqueda puede tomar 30-60 segundos por tarjeta debido a render=true del scraping

## Key Files
- `/app/frontend/src/components/CardScanner.jsx` - Componente de análisis con importador de eBay
- `/app/frontend/src/components/EbayMonitor.jsx` - Componente del monitor de eBay (NUEVO)
- `/app/frontend/src/pages/Dashboard.jsx` - Dashboard con pestañas Analizar/Monitor
- `/app/backend/server.py` - Todos los endpoints API
- `/app/frontend/.env` - REACT_APP_BACKEND_URL
- `/app/backend/.env` - MONGO_URL, OPENAI_API_KEY, SCRAPEDO_API_KEY

## Deployment Notes
- La aplicación es auto-hosteable sin dependencias de Emergent
- Usa la librería estándar `openai` de Python
- Scripts de instalación disponibles para cPanel/WHM (AlmaLinux)
