# GradeProphet - AI Sports Card Grading Predictor

## Original Problem Statement
El usuario quiere crear una webapp para analizar fotos de tarjetas deportivas (sports cards) y predecir el grado que recibirían de PSA (Professional Sports Authenticator). El sistema necesita basarse en los estándares de PSA y usar AI para el análisis. El objetivo es un negocio de grading donde solo se envían tarjetas con buen potencial de grado.

## User Personas
- **Coleccionistas de tarjetas deportivas**: Quieren saber el valor potencial de sus tarjetas antes de enviarlas a PSA
- **Revendedores**: Buscan maximizar ROI enviando solo tarjetas que obtendrán buenos grados
- **Nuevos coleccionistas**: Necesitan aprender qué buscar en una tarjeta de calidad

## Core Requirements (Static)
1. Upload de imágenes de tarjetas deportivas (JPEG, PNG, WEBP)
2. Análisis AI usando OpenAI GPT-5.2 Vision
3. Evaluación basada en estándares PSA:
   - Centering (Centrado)
   - Corners (Esquinas)
   - Surface (Superficie)
   - Edges (Bordes)
4. Grado estimado PSA (1-10)
5. Recomendación de enviar o no a PSA
6. Valor estimado raw vs graded
7. Historial de tarjetas analizadas
8. Tema oscuro profesional

## What's Been Implemented (Jan 2026)
- ✅ Dashboard principal con zona de upload drag & drop
- ✅ Integración con OpenAI GPT-5.2 Vision para análisis
- ✅ Desglose detallado de grados por categoría
- ✅ Recomendación de envío a PSA con explicación
- ✅ Estimación de valores (raw vs graded)
- ✅ Historial de análisis con MongoDB
- ✅ CRUD completo de tarjetas analizadas
- ✅ UI responsive con tema oscuro "The Vault"
- ✅ Animación de escaneo durante análisis

## Technical Architecture
- **Frontend**: React + TailwindCSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **AI**: OpenAI GPT-5.2 Vision via emergentintegrations
- **Database**: MongoDB

## API Endpoints
- `POST /api/cards/analyze` - Analiza imagen de tarjeta
- `GET /api/cards/history` - Historial de análisis
- `GET /api/cards/{id}` - Detalle de análisis
- `DELETE /api/cards/{id}` - Eliminar análisis

## Prioritized Backlog

### P0 (Critical) - Completed ✅
- Análisis de tarjetas con AI
- Historial persistente
- UI funcional

### P1 (High Priority)
- Autenticación de usuarios
- Múltiples fotos por tarjeta (frente/dorso)
- Comparación de tarjetas
- Export de reportes (PDF)

### P2 (Medium Priority)
- API de precios en tiempo real (eBay, COMC)
- Integración con PSA submission
- Dashboard de estadísticas
- Notificaciones cuando el precio de mercado cambia

### P3 (Nice to Have)
- App móvil nativa
- Scanning batch de múltiples tarjetas
- Marketplace integrado
- Predicción de tendencias de precio

## Next Tasks
1. Agregar autenticación de usuarios
2. Permitir subir múltiples fotos (frente y dorso)
3. Implementar comparador de tarjetas
4. Agregar exportación de reportes PDF
