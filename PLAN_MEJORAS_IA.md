# 🎯 PLAN DE MEJORAS IA CASTOR
## Enfoque: Coherencia de Marca y Excelencia Holística

**Fecha:** 2026-01-11
**Prioridad:** Coherencia de Marca + Mejora en todas las superficies IA
**Timeline:** Fases iterativas

---

## 📋 RESUMEN EJECUTIVO

Castor tiene un sistema IA **robusto y funcional** basado en Google Gemini 2.0-Flash. La mejora estratégica se enfoca en:

1. **Fortalecer coherencia de marca** - El Brand Mode es el diferenciador clave
2. **Mejorar todas las superficies IA** - Reply Dialog, Composer Tabs, Brand Config
3. **Agregar capacidades predictivas** - Sugerir cuál opción tendrá mejor rendimiento
4. **Profundizar en análisis** - Métricas sobre impacto de IA en engagement

---

## 🔍 DIAGNÓSTICO ACTUAL

### Fortalezas ✅
- Análisis automático de estilo de usuario (tone, emojis, temas, frases)
- AI Brand Mode con contexto persistent
- 3 modos + 6 idiomas
- API bien estructurada
- Tests unitarios implementados
- Caché inteligente

### Brechas Identificadas 🔴
1. **Coherencia de marca**
   - Knowledge Base no se valida en generación (contexto se construye pero no se valida completamente)
   - No hay feedback loop: usuario no sabe si respetó brand voice
   - Documentos de marca (accountDocuments) existen pero no se usan

2. **Superficies IA**
   - AIReplyDialog: Funciona pero UI podría ser más intuitiva
   - AITabs: Compacto pero falta contextualización
   - Brand Config: Existe pero uso de documentos adjuntos está vacío

3. **Analytics**
   - No hay tracking de qué sugerencias acepta el usuario
   - No hay correlación con engagement posterior
   - No hay metrics sobre Brand Mode effectiveness

4. **Generación**
   - Solo genera 3 sugerencias (limitado para usuarios exigentes)
   - No hay batch generation (generar muchas a la vez)
   - No hay modo "thread" para generar series coherentes

5. **UX**
   - Usuario no ve si sugerencia respeta brand voice
   - No hay validación post-generación
   - Cargas pueden ser lentas (sin feedback visual claro)

---

## 🚀 FASE 1: COHERENCIA DE MARCA (SEMANA 1)

### 1.1 Brand Voice Validator
**Objetivo:** Verificar que sugerencias respetan brand voice antes de mostrar
**Ubicación:** `src/lib/ai/brand-validator.ts` (nuevo)

```typescript
// Validar sugerencia contra Knowledge Base
validateBrandCoherence(
  suggestion: string,
  knowledgeBase: AccountKnowledgeBase,
  userProfile: UserStyleProfile
): {
  isCoherent: boolean,
  violations: string[],    // "Too formal for casual brand"
  confidence: 0-100,       // 85% confident
  feedback: string         // "This matches your brand voice perfectly"
}
```

**Cambios:**
- Extender endpoint `/api/ai/assistant` para retornar `brandValidation`
- UI muestra badge en cada sugerencia: ✅ "Perfect fit" | ⚠️ "Slightly formal" | ❌ "Off-brand"
- Respuesta con coherence score

**Tests:**
- Validar tono: sugerencia formal en brand casual → violation
- Validar longitud: demasiado largo → warning
- Validar temas: menciona tema no en expertise → neutral

### 1.2 Enhanced Knowledge Base
**Objetivo:** Documentos de marca adjuntos + Ejemplos de casts "on-brand"

**Changes:**
- Agregar tabla `brandExamples` con casts de referencia
- UI para "Mark as on-brand" / "Mark as off-brand" en Feed
- Usar ejemplos en prompt de Gemini para few-shot learning

**API:** `POST /api/accounts/{id}/context/examples`

### 1.3 AI Persona Refinement
**Objetivo:** Perfeccionar análisis automático de estilo del usuario

**Cambios:**
- Aumentar sample de 25 casts a **50 casts** (mejor representación)
- Analizar no solo texto sino **engagement patterns** (qué tipo de posts hace mejor)
- Guardar "power phrases" (frases que generan alto engagement)
- Detección de "seasonal patterns" (temas que varían por época)

**API:** `PUT /api/ai/assistant` (existente, mejorar)

---

## 🎨 FASE 2: MEJORA DE SUPERFICIES (SEMANA 2)

### 2.1 AIReplyDialog Enhancement
**Ubicación:** `src/components/feed/AIReplyDialog.tsx`

**Mejoras:**
1. Mostrar **context visualization** del cast original
   - Tema detectado
   - Tone sugerido
   - Engagement del cast original

2. Agregar **"Reply strategy" selector**
   - Modes: Agree | Disagree | Add Value | Humor | Question
   - IA adapta tono según estrategia

3. **Loader states mejorados**
   - Skeleton de sugerencias mientras carga
   - Progress bar real-time

4. **Edit in place**
   - Poder editar sugerencia sin perder original
   - Diff preview (qué cambió vs brand voice)

### 2.2 AITabs Expansion (Composer)
**Ubicación:** `src/components/compose/AITabs.tsx`

**Nuevos modos:**
- **Expand:** Tomar idea corta y expandir coherentemente
- **Condense:** Comprimir sin perder esencia
- **Thread Mode:** Generar 3-5 casts conectados temáticamente
- **Add Thread:** Extender thread existente

**Changes:**
- Tabs mejor organizados (dropdown en mobile)
- Mostrar stats: "Brand Coherence: 92%"
- Sugerir idioma basado en preferencia del usuario

### 2.3 Brand Config Page Redesign
**Ubicación:** `src/app/(app)/accounts/[id]/ai/`

**Mejoras:**
1. **Visual Brand Profile**
   - Cards mostrando: Tone, Avg Length, Top Topics, Top Phrases
   - Refresh button para re-analizar

2. **Knowledge Base Editor - Mejorado**
   - Drag-drop para reordenar prioridades
   - Live preview de prompt que se envía a IA
   - Validación real-time (te dice si hay conflictos)

3. **Document Management**
   - Upload PDFs/docs con brand guidelines
   - IA resume y usa automáticamente
   - Visualizar qué documentos se usaron en cada sugerencia

4. **Team Collaboration**
   - Ver quién editó qué y cuándo
   - Proponer cambios (approval workflow)

5. **Analytics Section - Expanded**
   - % de sugerencias aceptadas
   - Correlación: IA acceptance vs engagement después
   - Top performing tone/length combinations
   - Trend: "Your brand voice is getting stronger" / "More casual lately"

---

## 📊 FASE 3: ANALYTICS & INSIGHTS (SEMANA 3)

### 3.1 AI Usage Tracking
**Cambios en BD:** Agregar tabla `aiSuggestionMetrics`

```typescript
{
  id
  userId, accountId
  suggestionId
  mode, tone, language
  brandCoherence (0-100)
  wasAccepted: boolean
  wasPosted: boolean
  castId (si fue posteado)
  engagement {
    likes, replies, recasts, impressions
  }
  createdAt, postedAt, finalEngagementAt
}
```

### 3.2 Predictive Analytics
**Nuevo componente:** `src/components/ai/EngagementPredictor.tsx`

**Lógica:**
- Historial de user: qué sugerencias (qué tone/length/content) generaron mejor engagement
- ML simple: correlacionar features → engagement
- Mostrar: "This suggestion is similar to your top-performing posts"

**UI:**
- Badge en sugerencias: ⭐⭐⭐⭐⭐ "Based on your history, this could perform well"
- Ranking: reordenar sugerencias por predicted engagement

### 3.3 Dashboard Metricas
**Nueva página:** `/accounts/{id}/ai/analytics`

**Secciones:**
1. **Overview**
   - % of posts using AI
   - Avg Brand Coherence Score
   - Total engagement from AI-assisted posts

2. **Trends**
   - Tone trends over time
   - Language distribution
   - Topic evolution

3. **Comparison: AI vs Manual**
   - Engagement per post (AI assisted vs not)
   - Acceptance rate
   - Time to post (AI faster?)

4. **Best Performers**
   - Top 10 AI-assisted posts by engagement
   - Patterns: What made them successful?

5. **Brand Voice Health**
   - Consistency score over time
   - Predictions: How strong is your brand voice?

---

## ⚡ FASE 4: GENERACIÓN AVANZADA (SEMANA 4)

### 4.1 Batch Generation
**API Enhancement:** `/api/ai/assistant` con `batchSize` param

```json
{
  "mode": "write",
  "batchSize": 10,  // 3-10
  "topic": "...",
  "accountId": "..."
}
```

**Respuesta:**
- 10 sugerencias en diferentes tones/angles
- Sorted by predicted engagement
- UI con tabs para navegar

### 4.2 Thread Generator
**Nuevo endpoint:** `POST /api/ai/thread`

```json
{
  "topic": "Why web3 will transform social",
  "threadLength": 5,          // 3-10 casts
  "tone": "educational",
  "accountId": "...",
  "includeExamples": true
}
```

**Lógica:**
- Generar serie coherente temáticamente
- Cada cast refuerza el anterior
- Final con CTA (engagement hook)

### 4.3 Smart Scheduling Suggestions
**Nueva feature:** Sugerir cuándo postear

**API:** `POST /api/ai/suggest-schedule`

```json
{
  "suggestion": "...",
  "accountId": "...",
  "audienceTimezone": "America/New_York"
}
→ { "suggestedTime": "2026-01-12 09:00 EST", "confidence": 85 }
```

---

## 🛠️ IMPLEMENTACIÓN DETALLES

### Variables de Entorno (agregar)
```bash
GEMINI_API_KEY=your_key            # (ya existe)
AI_BATCH_GENERATION_ENABLED=true   # Feature flag
AI_THREADING_ENABLED=true
AI_ANALYTICS_ENABLED=true
```

### Migraciones BD Necesarias
```typescript
// 1. Tabla: aiSuggestionMetrics
createTable('aiSuggestionMetrics', (table) => {
  table.text('id').primary();
  table.text('suggestionId').notNullable();
  table.text('userId').notNullable();
  table.text('accountId').notNullable();
  table.enum('mode', ['write', 'improve', 'translate']).notNullable();
  table.enum('tone', ['casual', 'professional', ...]).notNullable();
  table.text('language').notNullable();
  table.integer('brandCoherence');
  table.boolean('wasAccepted').defaultTo(false);
  table.boolean('wasPosted').defaultTo(false);
  table.text('castId');
  table.jsonb('engagement');
  table.timestamps();
  table.foreign('castId').references('casts.id');
});

// 2. Tabla: brandExamples
createTable('brandExamples', (table) => {
  table.text('id').primary();
  table.text('accountId').notNullable();
  table.text('castId').notNullable();
  table.text('externalCastId');  // Farcaster cast hash
  table.enum('classification', ['on_brand', 'off_brand']).notNullable();
  table.text('notes');
  table.timestamps();
});
```

### Archivos a Crear/Modificar

**Nuevos:**
- `src/lib/ai/brand-validator.ts` - Validador de coherencia
- `src/lib/ai/engagement-predictor.ts` - Predictor de engagement
- `src/lib/ai/thread-generator.ts` - Generador de threads
- `src/components/ai/EngagementPredictor.tsx` - UI predictor
- `src/components/ai/BrandValidationBadge.tsx` - Badge coherencia
- `src/app/api/ai/validate-brand/route.ts` - API validación
- `src/app/api/ai/thread/route.ts` - API threads
- `src/app/(app)/accounts/[id]/ai/analytics/page.tsx` - Página analytics

**Modificar:**
- `src/app/api/ai/assistant/route.ts` - Agregar batchSize, brandValidation
- `src/components/feed/AIReplyDialog.tsx` - Mejorar UI/UX
- `src/components/compose/AITabs.tsx` - Nuevos modos
- `src/app/(app)/accounts/[id]/ai/page.tsx` - Rediseño
- `src/lib/db/schema.ts` - Agregar tablas

### Testing Plan
```typescript
// Unit Tests
- test: brand-validator valida tono
- test: engagement-predictor rankea correctamente
- test: thread-generator crea series coherentes

// Integration Tests
- POST /api/ai/assistant con batchSize=5
- POST /api/ai/thread valida estructura
- GET analytics retorna métricas correctas

// E2E Tests
- User genera sugerencia → ve brand coherence badge
- User ve analytics → verifica correlación AI vs engagement
```

---

## 📈 MÉTRICAS DE ÉXITO

| Métrica | Target |
|---------|--------|
| Brand Coherence Score | 90%+ promedio |
| AI Usage Rate | +50% sobre baseline |
| Engagement (AI vs Manual) | +20-30% para posts con IA |
| User Retention | +40% (power users con IA) |
| Feature Adoption | 70% de accounts con Brand Mode ON |

---

## 🎯 SIGUIENTES PASOS INMEDIATOS

1. **Hoy:** Review este plan
2. **Mañana:** Iniciar FASE 1 - Brand Voice Validator
3. **Semana 1:** Completar mejoras coherencia
4. **Semana 2:** Superficies + Analytics
5. **Semana 3+:** Generación avanzada

---

## 💬 NOTAS

- Mantener backward compatibility con Brand Mode OFF
- Feature flags para rollout gradual
- Monitoreo de API calls (Gemini usage)
- A/B testing de nuevas superficies

