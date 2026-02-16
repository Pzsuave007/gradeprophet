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
6. Historial de tarjetas analizadas
7. Tema oscuro profesional
8. Análisis de frente y dorso de la tarjeta
9. Fotos de esquinas opcionales para análisis detallado
10. Biblioteca de referencias PSA 10 para comparación
11. Sistema de aprendizaje con feedback de grados reales
12. **Consideración de antigüedad de la tarjeta** - La IA ajusta estándares según el año:
    - Automático desde referencia PSA 10 (extrae año del label)
    - Auto-detección por IA cuando no hay referencia
    - Override manual opcional

## What's Been Implemented

### Enero 2026
- ✅ Dashboard principal con zona de upload drag & drop
- ✅ Integración con OpenAI GPT-5.2 Vision para análisis
- ✅ Desglose detallado de grados por categoría
- ✅ Recomendación de envío a PSA con explicación
- ✅ Historial de análisis con MongoDB
- ✅ CRUD completo de tarjetas analizadas
- ✅ UI responsive con tema oscuro profesional
- ✅ Animación de escaneo durante análisis

### Febrero 2026
- ✅ Upload de imagen frontal y dorso de la tarjeta
- ✅ Fotos opcionales de las 4 esquinas para análisis detallado (útil para compras de eBay)
- ✅ Biblioteca de referencias PSA 10 con lectura automática del label
- ✅ Sistema de aprendizaje: feedback de grados reales de PSA
- ✅ Panel de estadísticas de precisión del AI
- ✅ Eliminación de análisis innecesarios
- ✅ Botones de acción accesibles en móvil (vista detallada)
- ✅ Removidos valores de mercado (Raw/Graded) - usuario usa CardLadder
- ✅ **Consideración de antigüedad de tarjetas**: La IA ahora aplica estándares diferentes según la era:
  - Pre-1980 (Vintage): Estándares significativamente más indulgentes
  - 1980-1989: Estándares más indulgentes
  - 1990-1999 (Semi-Vintage): Estándares moderadamente indulgentes
  - 2000-2009: Estándares ligeramente relajados
  - 2010+: Estándares estrictos (modernos)

## Technical Architecture
- **Frontend**: React + TailwindCSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **AI**: OpenAI GPT-5.2 Vision via emergentintegrations
- **Database**: MongoDB

## API Endpoints
- `POST /api/cards/analyze` - Analiza imagen de tarjeta (soporta año para consideración vintage)
- `GET /api/cards/history` - Historial de análisis
- `GET /api/cards/{id}` - Detalle de análisis
- `DELETE /api/cards/{id}` - Eliminar análisis
- `PUT /api/cards/{id}/feedback` - Agregar grado real de PSA
- `PUT /api/cards/{id}/status` - Actualizar estado (pending, sent_to_psa, graded)
- `POST /api/references` - Guardar referencia PSA 10
- `GET /api/references` - Obtener biblioteca de referencias
- `DELETE /api/references/{id}` - Eliminar referencia

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

### P1 (High Priority)
- Autenticación de usuarios
- Export de reportes (PDF)
- Dashboard de estadísticas avanzadas

### P2 (Medium Priority)
- API de precios en tiempo real (eBay, COMC)
- Integración con PSA submission
- Notificaciones de cambios de precio

### P3 (Nice to Have)
- App móvil nativa
- Scanning batch de múltiples tarjetas
- Marketplace integrado
- Predicción de tendencias de precio

## Next Tasks
1. Agregar autenticación de usuarios
2. Implementar exportación de reportes PDF
3. Dashboard de estadísticas avanzadas
