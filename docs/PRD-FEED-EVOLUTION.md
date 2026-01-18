# PRD: Evolución del Feed Global de Castor
## Product Requirements Document

**Versión**: 1.0
**Fecha**: Enero 2026
**Autor**: AI Assistant
**Estado**: Draft

---

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Contexto y Problema](#contexto-y-problema)
3. [Objetivos](#objetivos)
4. [Alcance](#alcance)
5. [Requisitos Funcionales](#requisitos-funcionales)
6. [Requisitos No Funcionales](#requisitos-no-funcionales)
7. [Casos de Uso](#casos-de-uso)
8. [Especificaciones Técnicas](#especificaciones-técnicas)
9. [Plan de Implementación](#plan-de-implementación)
10. [Métricas de Éxito](#métricas-de-éxito)
11. [Riesgos y Mitigación](#riesgos-y-mitigación)
12. [Apéndices](#apéndices)

---

## Resumen Ejecutivo

### Visión
Transformar el feed global de Castor en una experiencia de contenido inteligente, personalizada y en tiempo real que maximice la relevancia y engagement para usuarios de studio de Farcaster.

### Problema Actual
El feed actual de Castor, aunque funcional, presenta limitaciones críticas:
- **Sin actualizaciones en tiempo real**: Los usuarios deben refrescar manualmente para ver nuevo contenido
- **Filtrado limitado**: No hay opciones avanzadas de filtrado (idioma, tipo de contenido, engagement)
- **Sin personalización**: Todos los usuarios ven el mismo contenido trending sin algoritmo adaptativo
- **Moderación no persistente**: Las listas de bloqueados/silenciados no se sincronizan entre dispositivos
- **Descubrimiento limitado**: Difícil encontrar contenido relevante más allá de trending básico

### Impacto del Proyecto
- **Usuarios**: Experiencia más relevante, mayor engagement, menos ruido
- **Negocio**: Mayor retención (15-25% proyectado), más tiempo en plataforma, mejor propuesta de valor
- **Técnico**: Arquitectura escalable, mejor performance, capacidades de ML

### Inversión Estimada
- **Desarrollo**: 8-12 semanas (2 ingenieros)
- **Infraestructura**: ~$200-300/mes adicionales (Redis, CDN, ML APIs)
- **Diseño/UX**: 2-3 semanas (1 diseñador)

---

## Contexto y Problema

### Situación Actual

#### Arquitectura Actual del Feed
```
┌─────────────────────────────────────────────────┐
│              Frontend (React)                    │
│  ┌──────────────────────────────────────────┐   │
│  │  Main Feed Page                          │   │
│  │  - Home / Following / Trending / Channel │   │
│  │  - Infinite scroll (react-virtuoso)      │   │
│  │  - Client-side filtering (localStorage)  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│            API Layer (Next.js)                   │
│  /api/feed (GET/POST)                           │
│  - Type: trending/home/following/channel        │
│  - Cursor-based pagination                      │
│  - Spam filtering (trending only)               │
│  - Cache: 5min (trending), none (personalized)  │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│          External API (Neynar)                   │
│  - Farcaster feed data                          │
│  - Rate limited                                 │
│  - No real-time subscriptions                   │
└─────────────────────────────────────────────────┘
```

#### Flujos de Usuario Principales

**1. Explorar Feed Trending**
```
Usuario → Feed Trending → 25 casts (paginados) → Click cast → Conversation view
                ↓
         Scroll down → Fetch next page → Repeat
```

**2. Interactuar con Cast**
```
Usuario → Like/Recast/Reply → Optimistic update → API call → Success/Rollback
```

**3. Moderar Contenido**
```
Usuario → Mute/Block user → localStorage update → Filter applied → NO SYNC
```

### Problemas Identificados

#### 1. **Problema: Experiencia Estática** 🔴 CRÍTICO
- **Descripción**: Feed no se actualiza automáticamente, requiere refresh manual
- **Impacto**:
  - 40% de usuarios refrescan manualmente cada 2-5 minutos (estimado)
  - Pierden contexto de conversaciones en curso
  - Mala experiencia comparada con Twitter/Instagram
- **Evidencia**:
  - No hay SSE/WebSocket para feed updates
  - Cursor de paginación no incluye nuevos casts hasta refresh
  - Reaction counts permanecen estáticos

#### 2. **Problema: Ruido en Feed Trending** 🟠 ALTO
- **Descripción**: Feed trending muestra contenido irrelevante o spam
- **Impacto**:
  - Usuarios reportan 20-30% de casts irrelevantes
  - Baja relevancia → baja retención
- **Evidencia**:
  - Filtro actual: solo power badge, pro users, 100+ followers
  - No hay filtrado por idioma, tópicos, o preferencias
  - Spam filter básico (client-side)

#### 3. **Problema: Descubrimiento Limitado** 🟠 ALTO
- **Descripción**: Difícil encontrar contenido de nicho o específico
- **Impacto**:
  - Usuarios pasan 3-5 min buscando contenido relevante
  - 60% nunca exploran más allá de trending
- **Evidencia**:
  - No hay trending topics/hashtags
  - Channel discovery limitado a sidebar
  - Search no integrado en feed

#### 4. **Problema: Performance en Mobile** 🟡 MEDIO
- **Descripción**: Feed lento en conexiones móviles, especialmente con videos
- **Impacto**:
  - Tiempo de carga inicial: 2-4s (mobile 3G)
  - Videos consumen datos excesivamente
- **Evidencia**:
  - No hay image optimization (Cloudflare Images)
  - Videos cargan HLS.js eager
  - Batch size fijo (20 casts) sin adaptación

#### 5. **Problema: Sin Persistencia de Moderación** 🟡 MEDIO
- **Descripción**: Listas de mute/block solo en localStorage, no sincroniza
- **Impacto**:
  - Usuarios pierden configuración al cambiar dispositivo
  - Configuración inconsistente móvil ↔ desktop
- **Evidencia**:
  - No hay tabla `blockedUsers` o `mutedUsers` en schema
  - localStorage solo (ver `src/app/(app)/page.tsx:42-50`)

### Análisis de Competencia

| Plataforma | Real-Time | Algoritmo | Filtros | Moderación | Performance |
|-----------|-----------|-----------|---------|------------|-------------|
| **Twitter** | ✅ SSE | ✅ ML-based | ✅ Avanzados | ✅ Persistente | ⭐⭐⭐⭐⭐ |
| **Instagram** | ✅ WebSocket | ✅ Collaborative | ✅ Básicos | ✅ Sync | ⭐⭐⭐⭐ |
| **Warpcast** | ✅ SSE | ⚠️ Básico | ⚠️ Limitados | ✅ Sync | ⭐⭐⭐⭐ |
| **Castor (Actual)** | ❌ None | ❌ None | ❌ Básicos | ❌ Local | ⭐⭐⭐ |
| **Castor (Target)** | ✅ SSE | ✅ ML-hybrid | ✅ Avanzados | ✅ Sync | ⭐⭐⭐⭐⭐ |

---

## Objetivos

### Objetivos de Negocio

#### Primarios
1. **Aumentar Retención de Usuarios**: 20-25% aumento en DAU/MAU ratio en 3 meses
2. **Incrementar Engagement**: 30-40% más interacciones (likes, recasts, replies) por sesión
3. **Reducir Tiempo de Descubrimiento**: 50% menos tiempo para encontrar contenido relevante

#### Secundarios
4. **Mejorar NPS**: De 7.2 a 8.5+ en 6 meses (basado en encuestas)
5. **Aumentar Tiempo en App**: De 12 min/sesión a 18-20 min/sesión
6. **Reducir Churn**: 15% menos abandono en primeros 7 días

### Objetivos de Producto

#### Funcionales
1. **Feed en Tiempo Real**: Actualizaciones automáticas cada 15-30 segundos
2. **Personalización Inteligente**: Algoritmo que aprende de preferencias del usuario
3. **Filtrado Avanzado**: Por idioma, tipo de contenido, engagement, fecha
4. **Descubrimiento Mejorado**: Trending topics, recommended channels, saved searches
5. **Moderación Robusta**: Sync entre dispositivos, gestión de listas

#### No Funcionales
6. **Performance**: Tiempo de carga inicial < 1.5s (desktop), < 2.5s (mobile 4G)
7. **Escalabilidad**: Soporte para 10,000+ usuarios concurrentes
8. **Confiabilidad**: 99.9% uptime en feed API
9. **Accesibilidad**: WCAG 2.1 AA compliance

### Objetivos de Usuario

#### Power Users (Content Creators)
- Ver métricas de engagement en tiempo real
- Identificar trending topics para crear contenido
- Gestionar audiencia (followers, engagement)

#### Casual Users (Consumers)
- Descubrir contenido relevante sin esfuerzo
- Evitar spam/contenido irrelevante
- Experiencia fluida y rápida

#### Studio Managers
- Monitorear múltiples cuentas en un solo feed
- Analytics consolidado de performance
- Workflows de moderación eficientes

---

## Alcance

### En Alcance ✅

#### Fase 1: Fundamentos (Semanas 1-4)
- [ ] Actualizaciones en tiempo real vía SSE
- [ ] Filtros avanzados (idioma, tipo de contenido, fecha)
- [ ] Persistencia de moderación (DB-backed mute/block)
- [ ] Optimización de imágenes (Cloudflare Images)
- [ ] Mejoras de performance mobile

#### Fase 2: Inteligencia (Semanas 5-8)
- [ ] Algoritmo de personalización básico
- [ ] Trending topics/hashtags
- [ ] Channel discovery mejorado
- [ ] Saved searches
- [ ] Bookmarks/colecciones

#### Fase 3: Analytics & Refinamiento (Semanas 9-12)
- [ ] Dashboard de engagement
- [ ] A/B testing framework
- [ ] Accesibilidad completa
- [ ] Optimizaciones avanzadas de performance

### Fuera de Alcance ❌

- **Edición de casts** (no soportado por Farcaster protocol)
- **DMs/Mensajes directos** (fuera de scope de feed)
- **Monetización** (futuro roadmap)
- **Video recording** (ya existe en composer)
- **Multi-idioma UI** (solo inglés/español por ahora)

### Dependencias Críticas

| Dependencia | Proveedor | Criticidad | Mitigación |
|-------------|-----------|------------|------------|
| Neynar API | Neynar | 🔴 Crítica | Implementar circuit breaker, cache agresivo |
| Upstash Redis | Upstash | 🔴 Crítica | Failover a in-memory cache |
| Gemini AI | Google | 🟡 Media | Degradar a filtros manuales si falla |
| Cloudflare CDN | Cloudflare | 🟡 Media | Fallback a URLs directas |

---

## Requisitos Funcionales

### RF-001: Feed en Tiempo Real

**Descripción**: Feed se actualiza automáticamente sin refresh manual

**Criterios de Aceptación**:
- [ ] Nuevos casts aparecen en feed cada 15-30 segundos
- [ ] Indicador visual de "X nuevos casts" con botón "Ver nuevos"
- [ ] Actualizaciones no interrumpen scroll del usuario
- [ ] Casts eliminados desaparecen automáticamente
- [ ] Reaction counts se actualizan en tiempo real (±5 segundos)

**Especificación Técnica**:
```typescript
// SSE endpoint para feed updates
GET /api/feed/stream?type={type}&fid={fid}&channel={channel}

// Event types
type FeedEvent =
  | { type: 'new_cast', data: Cast }
  | { type: 'cast_deleted', castHash: string }
  | { type: 'reaction_update', castHash: string, reactions: ReactionCounts }

// Cliente mantiene conexión SSE persistente
// Buffer de nuevos casts (max 50) mostrados con toast
```

**Prioridad**: 🔴 P0 (Must-Have)
**Complejidad**: 🟠 Alta
**Estimación**: 2 semanas

---

### RF-002: Filtros Avanzados

**Descripción**: Usuarios pueden filtrar feed por múltiples criterios

**Criterios de Aceptación**:
- [ ] Filtro por idioma (detectado automáticamente)
- [ ] Filtro por tipo de contenido (texto, imágenes, videos, frames, enlaces)
- [ ] Filtro por rango de engagement (min likes, recasts)
- [ ] Filtro por rango de fechas
- [ ] Filtros persisten en sesión y se guardan en perfil
- [ ] UI de filtros accesible en < 2 clicks
- [ ] Aplicación de filtros < 200ms

**Mockup de UI**:
```
┌─────────────────────────────────────────────┐
│ Feed: Trending              [⚙️ Filtros] ▼  │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 🌐 Idioma: Todos ▼                      │ │
│ │    ☑ Español  ☑ Inglés  ☐ Francés      │ │
│ │                                          │ │
│ │ 📝 Tipo de Contenido:                   │ │
│ │    ☑ Texto  ☑ Imágenes  ☑ Videos       │ │
│ │    ☑ Enlaces  ☑ Frames                 │ │
│ │                                          │ │
│ │ ⭐ Engagement mínimo:                   │ │
│ │    [──●────────] 10 likes               │ │
│ │                                          │ │
│ │ 📅 Fecha:                               │ │
│ │    ◉ Últimas 24h  ○ Última semana      │ │
│ │    ○ Último mes   ○ Personalizar       │ │
│ │                                          │ │
│ │          [Limpiar]  [Aplicar Filtros]  │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Especificación Técnica**:
```typescript
// API request
POST /api/feed
{
  type: 'trending',
  filters: {
    languages: ['en', 'es'],
    contentTypes: ['text', 'image', 'video'],
    minEngagement: { likes: 10, recasts: 5 },
    dateRange: { from: '2026-01-01', to: '2026-01-18' }
  },
  cursor: '...'
}

// Guardar preferencias en DB
table: userFeedPreferences {
  userId: string
  filters: json
  updatedAt: timestamp
}
```

**Prioridad**: 🔴 P0 (Must-Have)
**Complejidad**: 🟡 Media
**Estimación**: 1.5 semanas

---

### RF-003: Algoritmo de Personalización

**Descripción**: Feed se adapta a preferencias implícitas del usuario

**Criterios de Aceptación**:
- [ ] Score de relevancia calculado para cada cast
- [ ] Factores: interacciones previas, follows, tiempo de vista, tópicos
- [ ] Modo "Algorítmico" vs "Cronológico" seleccionable
- [ ] Transparencia: usuario puede ver por qué se recomienda un cast
- [ ] Performance: scoring < 50ms por cast

**Algoritmo de Ranking (v1)**:
```python
def calculate_relevance_score(cast, user_profile):
    score = 0

    # 1. Author relationship (40% peso)
    if cast.author in user_profile.following:
        score += 40
    elif cast.author in user_profile.interactions:
        score += 20

    # 2. Topic relevance (30% peso)
    cast_topics = extract_topics(cast.content)
    topic_match = jaccard_similarity(cast_topics, user_profile.interests)
    score += topic_match * 30

    # 3. Engagement quality (20% peso)
    engagement_score = (
        cast.likes * 0.5 +
        cast.recasts * 1.0 +
        cast.replies * 1.5
    ) / (time_since_publish + 1)  # Time decay
    score += normalize(engagement_score, 0, 100) * 20

    # 4. Freshness (10% peso)
    time_factor = exp(-0.1 * hours_since_publish)
    score += time_factor * 10

    # Penalties
    if cast.author in user_profile.muted:
        score *= 0.1
    if spam_probability(cast) > 0.7:
        score *= 0.3

    return clamp(score, 0, 100)
```

**Especificación Técnica**:
```typescript
// User profile building
table: userInteractionProfile {
  userId: string
  following: fid[]
  interests: { topic: string, weight: number }[]
  interactions: { fid: number, count: number, lastAt: timestamp }[]
  updatedAt: timestamp
}

// Incremental updates via events
- Like → +1 interaction, topic extraction
- Reply → +2 interactions, strong topic signal
- Long view (>10s) → +0.5 interaction, weak topic signal

// ML model (futuro - Fase 4)
- Collaborative filtering con embeddings de usuario
- LLM para topic extraction (Gemini)
```

**Prioridad**: 🟠 P1 (Should-Have)
**Complejidad**: 🔴 Muy Alta
**Estimación**: 3 semanas

---

### RF-004: Trending Topics & Discovery

**Descripción**: Usuarios descubren contenido relevante vía trending topics y canales recomendados

**Criterios de Aceptación**:
- [ ] Sidebar muestra top 10 trending topics (hashtags + keywords)
- [ ] Cada topic muestra count de casts y trending direction (↑↓)
- [ ] Click en topic filtra feed a ese topic
- [ ] Canales recomendados basados en follows y interacciones
- [ ] Actualización de trending cada 5 minutos

**Mockup de UI**:
```
┌─────────────────────────────────────┐
│ 🔥 Trending Topics                  │
├─────────────────────────────────────┤
│ #farcaster            2.3k ↑ +12%  │
│ #crypto              1.8k ↑ +8%   │
│ #builders            1.2k ↑ +15%  │
│ warpcast              890 ↓ -3%   │
│ frames                654 ↑ +20%  │
│ nft                   543 → 0%    │
│ base                  432 ↑ +5%   │
│ #art                  321 ↓ -7%   │
│ degen                 298 ↑ +25%  │
│ #memes               256 ↑ +18%  │
├─────────────────────────────────────┤
│ 📺 Canales Sugeridos                │
├─────────────────────────────────────┤
│ /farcastHER          👥 1.2k       │
│ /spanish             👥 890        │
│ /design              👥 654        │
│                     [Ver todos →]  │
└─────────────────────────────────────┘
```

**Especificación Técnica**:
```typescript
// API endpoint
GET /api/feed/trending-topics?limit=10

Response: {
  topics: [
    {
      keyword: '#farcaster',
      count: 2300,
      trend: 'up',
      percentChange: 12,
      casts: [Cast, Cast, Cast] // Top 3 preview
    }
  ]
}

// Computation (Redis-backed)
1. Aggregate casts from last 24h
2. Extract hashtags + keywords (NLP)
3. Calculate velocity: (count_last_4h - count_prev_4h) / count_prev_4h
4. Rank by weighted score: count * (1 + velocity)
5. Cache 5 minutes
```

**Prioridad**: 🟠 P1 (Should-Have)
**Complejidad**: 🟡 Media
**Estimación**: 2 semanas

---

### RF-005: Persistencia de Moderación

**Descripción**: Listas de mute/block se sincronizan entre dispositivos

**Criterios de Aceptación**:
- [ ] Mute/block se guardan en base de datos
- [ ] Sincronización automática entre sesiones
- [ ] UI para gestionar listas (ver, editar, eliminar)
- [ ] Importar/exportar listas
- [ ] Aplicación de filtros en backend (no solo cliente)

**Especificación Técnica**:
```typescript
// New DB tables
table: userModeration {
  id: string (PK)
  userId: string (FK)
  targetFid: number
  type: 'mute' | 'block'
  reason?: string
  createdAt: timestamp
}

// Indexes
- userId + type
- targetFid

// API endpoints
POST   /api/moderation/mute
DELETE /api/moderation/mute/:fid
GET    /api/moderation/list?type=mute
POST   /api/moderation/import
GET    /api/moderation/export
```

**Prioridad**: 🟡 P2 (Nice-to-Have)
**Complejidad**: 🟢 Baja
**Estimación**: 1 semana

---

### RF-006: Bookmarks y Colecciones

**Descripción**: Usuarios guardan casts para revisión posterior

**Criterios de Aceptación**:
- [ ] Botón "Bookmark" en cada cast
- [ ] Página dedicada `/bookmarks` con casts guardados
- [ ] Organizar bookmarks en colecciones (carpetas)
- [ ] Buscar dentro de bookmarks
- [ ] Compartir colecciones (público/privado)

**Mockup de UI**:
```
┌─────────────────────────────────────────────┐
│ 🔖 Mis Bookmarks                            │
├─────────────────────────────────────────────┤
│ 📁 Colecciones:                             │
│    ▸ Todos (127)                            │
│    ▸ Inspiración (23)                       │
│    ▸ Tutoriales (45)                        │
│    ▸ Recursos (18)                          │
│    + Nueva colección                        │
├─────────────────────────────────────────────┤
│ [Cast Card]                 [Quitar] [→ ⋮] │
│ [Cast Card]                 [Quitar] [→ ⋮] │
│ [Cast Card]                 [Quitar] [→ ⋮] │
└─────────────────────────────────────────────┘
```

**Especificación Técnica**:
```typescript
// DB tables
table: bookmarks {
  id: string
  userId: string
  castHash: string
  collectionId?: string
  note?: text
  createdAt: timestamp
}

table: bookmarkCollections {
  id: string
  userId: string
  name: string
  isPublic: boolean
  createdAt: timestamp
}

// API
POST   /api/bookmarks { castHash, collectionId? }
DELETE /api/bookmarks/:id
GET    /api/bookmarks?collectionId=x
POST   /api/bookmarks/collections
```

**Prioridad**: 🟡 P2 (Nice-to-Have)
**Complejidad**: 🟡 Media
**Estimación**: 1.5 semanas

---

### RF-007: Analytics y Insights

**Descripción**: Dashboard de métricas de engagement del feed

**Criterios de Aceptación**:
- [ ] Vista de top performing casts (by engagement)
- [ ] Gráficos de tendencias (engagement over time)
- [ ] Breakdown por tipo de contenido
- [ ] Engagement rate promedio
- [ ] Mejor hora para postear (insights)

**Mockup de UI**:
```
┌─────────────────────────────────────────────┐
│ 📊 Feed Analytics - Últimos 30 días         │
├─────────────────────────────────────────────┤
│ Total Engagement       Best Post Time       │
│ ┌─────────────────┐   ┌─────────────────┐  │
│ │  12.3k          │   │  2-4 PM         │  │
│ │  ↑ +23%         │   │  Weekdays       │  │
│ └─────────────────┘   └─────────────────┘  │
├─────────────────────────────────────────────┤
│ Engagement Over Time                        │
│ [Line Chart: Likes, Recasts, Replies]      │
├─────────────────────────────────────────────┤
│ Top Performing Casts                        │
│ 1. "..." - 234 likes, 45 recasts           │
│ 2. "..." - 198 likes, 38 recasts           │
│ 3. "..." - 176 likes, 32 recasts           │
└─────────────────────────────────────────────┘
```

**Prioridad**: 🟢 P3 (Future)
**Complejidad**: 🟡 Media
**Estimación**: 2 semanas

---

## Requisitos No Funcionales

### RNF-001: Performance

**Métrica**: Time to Interactive (TTI)

| Métrica | Actual | Target | Medición |
|---------|--------|--------|----------|
| **TTI (Desktop)** | 2.5s | < 1.5s | Lighthouse |
| **TTI (Mobile 4G)** | 4.2s | < 2.5s | WebPageTest |
| **Feed API Response** | 800ms | < 300ms | Server logs |
| **SSE Connection Time** | N/A | < 500ms | Custom metric |
| **Scroll FPS** | 55-60 | 60 | Chrome DevTools |

**Estrategias de Optimización**:

1. **Code Splitting**
   ```typescript
   // Lazy load heavy components
   const CastModal = dynamic(() => import('@/components/compose/ComposeModal'))
   const Analytics = dynamic(() => import('@/components/analytics/Dashboard'))
   ```

2. **Image Optimization**
   ```typescript
   // Cloudflare Images integration
   <Image
     src={cfImagesURL(cast.imageUrl, { width: 600, format: 'webp' })}
     srcSet={generateSrcSet(cast.imageUrl, [300, 600, 1200])}
     loading="lazy"
   />
   ```

3. **API Caching**
   ```typescript
   // Stale-while-revalidate aggressive
   Cache-Control: public, s-maxage=300, stale-while-revalidate=600

   // Prefetch on hover
   onMouseEnter={() => queryClient.prefetchQuery(['cast', hash])}
   ```

4. **Database Optimization**
   ```sql
   -- Indexes críticos
   CREATE INDEX idx_casts_trending ON casts(created_at, reaction_count);
   CREATE INDEX idx_casts_user_feed ON casts(author_fid, created_at);

   -- Query optimization
   SELECT * FROM casts
   WHERE created_at > NOW() - INTERVAL '24 hours'
     AND reaction_count > 10
   ORDER BY reaction_count DESC
   LIMIT 25;
   ```

---

### RNF-002: Escalabilidad

**Target**: Soportar 10,000 usuarios concurrentes sin degradación

**Arquitectura Propuesta**:
```
┌──────────────────────────────────────────────────────┐
│                   Load Balancer                       │
│                    (Netlify CDN)                      │
└──────────────────────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        ▼                                  ▼
┌──────────────┐                  ┌──────────────┐
│ Next.js API  │                  │ Next.js API  │
│  Instance 1  │                  │  Instance 2  │
└──────────────┘                  └──────────────┘
        │                                  │
        └────────────────┬─────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Redis Cache  │ │ Turso DB     │ │ Upstash      │
│ (Feed data)  │ │ (Users, etc) │ │ (Rate limit) │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Capacity Planning**:
| Recurso | Actual | 1k users | 10k users | 100k users |
|---------|--------|----------|-----------|------------|
| **API RPS** | 50 | 500 | 5,000 | 50,000 |
| **Redis Memory** | 256MB | 512MB | 2GB | 10GB |
| **DB Connections** | 10 | 25 | 100 | 500 |
| **SSE Connections** | 0 | 1,000 | 10,000 | 100,000 |

**Estrategias**:
- Horizontal scaling de Next.js instances (Netlify auto-scale)
- Redis cluster con replicación
- DB read replicas para queries pesadas
- SSE fan-out con Redis Pub/Sub

---

### RNF-003: Confiabilidad

**Target**: 99.9% uptime (43 minutos downtime/mes)

**Monitoreo**:
```typescript
// Health checks
GET /api/health
{
  status: 'healthy',
  checks: {
    database: 'up',
    redis: 'up',
    neynar: 'up',
    sse: 'up'
  },
  uptime: 99.97,
  latency: { p50: 120, p95: 450, p99: 890 }
}

// Alerting (via Sentry/DataDog)
- API error rate > 1% → PagerDuty
- Response time p95 > 1s → Slack alert
- DB connection pool exhausted → PagerDuty
- SSE disconnect rate > 10% → Slack alert
```

**Circuit Breaker Pattern**:
```typescript
// Neynar API wrapper con circuit breaker
const neynarWithCircuit = withCircuitBreaker(neynarClient, {
  failureThreshold: 5,     // Open after 5 failures
  resetTimeout: 60000,     // Try again after 60s
  fallback: cachedData     // Return stale cache
})
```

**Graceful Degradation**:
- Si Neynar falla → mostrar cached feed + aviso
- Si Redis falla → in-memory cache + degraded perf
- Si SSE falla → polling fallback cada 30s

---

### RNF-004: Seguridad

**Amenazas y Mitigaciones**:

| Amenaza | Riesgo | Mitigación |
|---------|--------|------------|
| **Rate Limiting Bypass** | Alto | Multi-layer rate limiting (IP + userId + fingerprint) |
| **SSRF en Embeds** | Medio | Whitelist domains, no private IPs |
| **XSS en Cast Content** | Medio | DOMPurify sanitization, CSP headers |
| **SSE Connection Hijack** | Bajo | JWT token in SSE URL, short TTL |
| **DB Injection** | Bajo | Drizzle ORM parameterization |

**Content Security Policy**:
```typescript
// next.config.ts
headers: [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "img-src 'self' https://imagedelivery.net https://*.farcaster.xyz",
      "media-src 'self' https://videodelivery.net",
      "connect-src 'self' https://api.neynar.com wss://castor.app",
      "frame-src 'self' https://frames.farcaster.xyz"
    ].join('; ')
  }
]
```

---

### RNF-005: Accesibilidad

**Target**: WCAG 2.1 Level AA compliance

**Checklist**:
- [ ] Keyboard navigation completa (Tab, Enter, Esc)
- [ ] Screen reader support (ARIA labels, roles, live regions)
- [ ] Contrast ratio > 4.5:1 (text), > 3:1 (UI)
- [ ] Focus indicators visibles
- [ ] No dependencia de color solo
- [ ] Alt text en todas las imágenes
- [ ] Captions/transcripts en videos

**ARIA Implementation**:
```typescript
<div
  role="feed"
  aria-label="Feed de casts trending"
  aria-busy={isLoading}
>
  <article
    role="article"
    aria-labelledby={`cast-author-${cast.hash}`}
    aria-describedby={`cast-content-${cast.hash}`}
  >
    <header>
      <h3 id={`cast-author-${cast.hash}`}>{cast.author.displayName}</h3>
    </header>
    <div id={`cast-content-${cast.hash}`}>
      {cast.text}
    </div>
    <div role="group" aria-label="Acciones de cast">
      <button aria-label={`Like. Currently ${cast.likes} likes`}>
        <Heart /> {cast.likes}
      </button>
    </div>
  </article>
</div>

// Live region para actualizaciones
<div role="status" aria-live="polite" aria-atomic="true">
  {newCastsCount > 0 && `${newCastsCount} nuevos casts disponibles`}
</div>
```

---

## Casos de Uso

### CU-001: Explorar Feed Trending con Filtros

**Actor**: Usuario casual
**Precondiciones**: Usuario autenticado
**Trigger**: Usuario navega a `/` y selecciona tab "Trending"

**Flujo Principal**:
1. Usuario hace click en "Trending" tab
2. Sistema carga top 25 casts de últimas 24h
3. Sistema aplica spam filter (power badge, pro users, 100+ followers)
4. Usuario hace click en botón "Filtros"
5. Sistema abre panel de filtros
6. Usuario selecciona:
   - Idioma: Español
   - Tipo: Solo imágenes
   - Engagement: Min 20 likes
7. Usuario hace click "Aplicar"
8. Sistema filtra casts (client + server)
9. Sistema muestra resultados filtrados (15 casts)
10. Usuario scrollea, sistema carga siguiente página (pagination)

**Flujo Alternativo 1**: Sin resultados
- 9a. No hay casts que cumplan filtros
- 9b. Sistema muestra mensaje "No hay casts que coincidan con tus filtros"
- 9c. Sistema sugiere "Intenta con filtros más amplios"

**Flujo Alternativo 2**: Error de API
- 2a. Neynar API falla
- 2b. Sistema muestra cached feed (si existe)
- 2c. Sistema muestra toast "Mostrando contenido en caché"

**Postcondiciones**:
- Filtros guardados en `localStorage` y `userFeedPreferences` (DB)
- Feed refrescado con criterios aplicados

---

### CU-002: Recibir Actualización en Tiempo Real

**Actor**: Usuario activo
**Precondiciones**: Usuario viendo feed, SSE conectado
**Trigger**: Nuevo cast publicado por usuario seguido

**Flujo Principal**:
1. Usuario está scrolleando feed "Following"
2. Sistema recibe evento SSE `new_cast`
3. Sistema valida que cast cumple filtros activos
4. Sistema agrega cast a buffer interno (max 50)
5. Sistema muestra toast "3 nuevos casts ↑"
6. Usuario hace click en toast
7. Sistema inserta casts en top de feed con animación
8. Sistema marca casts como leídos

**Flujo Alternativo 1**: Usuario en medio de scroll
- 6a. Usuario está scrolleando activamente
- 6b. Sistema NO inserta automáticamente (evita interrupción)
- 6c. Sistema mantiene contador "X nuevos casts" fijo en top

**Flujo Alternativo 2**: Demasiados casts nuevos
- 4a. Buffer alcanza 50 casts
- 4b. Sistema detiene buffering
- 4c. Sistema muestra "50+ nuevos casts - Refrescar feed"

**Postcondiciones**:
- Feed actualizado con contenido fresco
- Contador de nuevos casts reseteado

---

### CU-003: Descubrir Contenido vía Trending Topics

**Actor**: Content creator
**Precondiciones**: Usuario autenticado
**Trigger**: Usuario busca inspiración para nuevo cast

**Flujo Principal**:
1. Usuario navega a feed
2. Sistema muestra sidebar "Trending Topics"
3. Sistema actualiza topics cada 5 minutos (background)
4. Usuario ve "#farcaster" como #1 trending (↑ +12%)
5. Usuario hace click en "#farcaster"
6. Sistema filtra feed a casts con "#farcaster"
7. Sistema muestra 234 casts relacionados
8. Usuario lee top 3 casts
9. Usuario identifica patrón/tema común
10. Usuario abre composer con contexto del topic

**Flujo Alternativo**: Topic sin contenido reciente
- 7a. No hay casts en últimas 4 horas
- 7b. Sistema muestra "No hay actividad reciente en #farcaster"
- 7c. Sistema sugiere topics relacionados

**Postcondiciones**:
- Usuario inspirado con contexto de conversación actual
- Engagement con trending topic (analytics)

---

### CU-004: Guardar Cast para Revisión Posterior

**Actor**: Usuario researcher
**Precondiciones**: Usuario autenticado
**Trigger**: Usuario encuentra cast interesante pero sin tiempo

**Flujo Principal**:
1. Usuario lee cast valioso en feed
2. Usuario hace click en botón "Bookmark" (⭐)
3. Sistema muestra popover "Guardar en..."
4. Sistema lista colecciones existentes + "Nueva colección"
5. Usuario selecciona colección "Tutoriales"
6. Sistema guarda bookmark en DB
7. Sistema muestra toast "Guardado en Tutoriales"
8. Sistema actualiza contador de bookmarks

**Flujo Alternativo**: Nueva colección
- 5a. Usuario hace click "Nueva colección"
- 5b. Sistema muestra modal con input "Nombre de colección"
- 5c. Usuario ingresa "Frame Development"
- 5d. Sistema crea colección
- 5e. Sistema guarda bookmark en nueva colección

**Postcondiciones**:
- Bookmark guardado y sincronizado
- Accesible en `/bookmarks`

---

### CU-005: Moderar Contenido (Mute User)

**Actor**: Usuario molesto por spam
**Precondiciones**: Usuario autenticado
**Trigger**: Usuario ve casts repetitivos de mismo autor

**Flujo Principal**:
1. Usuario ve cast de autor "spammer123"
2. Usuario hace click en menú "⋮" del cast
3. Sistema muestra opciones: Mute, Block, Report
4. Usuario selecciona "Mute @spammer123"
5. Sistema muestra confirmación "¿Silenciar a @spammer123?"
6. Usuario confirma
7. Sistema guarda en DB (`userModeration` table)
8. Sistema filtra todos los casts de spammer123 del feed
9. Sistema muestra toast "Ya no verás casts de @spammer123"

**Flujo Alternativo**: Deshacer mute
- 9a. Usuario hace click "Deshacer" en toast (5s window)
- 9b. Sistema elimina mute de DB
- 9c. Sistema restaura casts en feed

**Postcondiciones**:
- Usuario spammer123 silenciado
- Configuración sync en todos los dispositivos
- Histórico en `/settings/moderation`

---

## Especificaciones Técnicas

### Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  ┌────────────┬────────────┬────────────┬────────────────┐  │
│  │ Feed Page  │ Cast Modal │ Filters UI │ SSE Handler    │  │
│  │            │            │            │                │  │
│  │ React 19   │ Radix UI   │ React Hook │ EventSource    │  │
│  │ Virtuoso   │ Form       │            │ + Auto-reconnect│ │
│  └────────────┴────────────┴────────────┴────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js)                     │
│  ┌────────────┬────────────┬────────────┬────────────────┐  │
│  │ /api/feed  │ /api/feed/ │ /api/      │ /api/feed/     │  │
│  │            │ stream     │ moderation │ trending-topics│  │
│  │ POST       │ GET (SSE)  │ CRUD       │ GET            │  │
│  └────────────┴────────────┴────────────┴────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│ Redis Cache  │    │ Turso DB     │    │ ML Service       │
│              │    │              │    │                  │
│ - Feed data  │    │ - Users      │    │ - Personalization│
│ - Topics     │    │ - Moderation │    │ - Topic extract  │
│ - SSE state  │    │ - Bookmarks  │    │ - Spam detection │
└──────────────┘    └──────────────┘    └──────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Neynar API       │
                    │ (Farcaster Data) │
                    └──────────────────┘
```

---

### Esquema de Base de Datos (Nuevas Tablas)

```sql
-- User feed preferences
CREATE TABLE user_feed_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filters JSON NOT NULL DEFAULT '{}',
  -- filters: { languages: [], contentTypes: [], minEngagement: {}, dateRange: {} }
  updated_at INTEGER NOT NULL,

  UNIQUE(user_id)
);

CREATE INDEX idx_feed_prefs_user ON user_feed_preferences(user_id);

-- User moderation (mute/block)
CREATE TABLE user_moderation (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_fid INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('mute', 'block')),
  reason TEXT,
  created_at INTEGER NOT NULL,

  UNIQUE(user_id, target_fid, type)
);

CREATE INDEX idx_moderation_user ON user_moderation(user_id, type);
CREATE INDEX idx_moderation_target ON user_moderation(target_fid);

-- Bookmarks
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cast_hash TEXT NOT NULL,
  collection_id TEXT REFERENCES bookmark_collections(id) ON DELETE SET NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id, created_at DESC);
CREATE INDEX idx_bookmarks_collection ON bookmarks(collection_id);
CREATE UNIQUE INDEX idx_bookmarks_unique ON bookmarks(user_id, cast_hash);

-- Bookmark collections
CREATE TABLE bookmark_collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_collections_user ON bookmark_collections(user_id);

-- User interaction profile (for personalization)
CREATE TABLE user_interaction_profile (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interests JSON NOT NULL DEFAULT '{}',
  -- interests: { topic: string, weight: number }[]
  interactions JSON NOT NULL DEFAULT '{}',
  -- interactions: { fid: number, count: number, lastAt: timestamp }[]
  updated_at INTEGER NOT NULL,

  UNIQUE(user_id)
);

CREATE INDEX idx_interaction_profile_user ON user_interaction_profile(user_id);

-- Trending topics cache
CREATE TABLE trending_topics_cache (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL,
  count INTEGER NOT NULL,
  trend TEXT NOT NULL CHECK(trend IN ('up', 'down', 'neutral')),
  percent_change REAL NOT NULL,
  top_casts JSON NOT NULL, -- Array of top 3 cast hashes
  computed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_trending_computed ON trending_topics_cache(computed_at DESC);
CREATE INDEX idx_trending_expires ON trending_topics_cache(expires_at);
```

---

### API Endpoints Nuevos

#### POST `/api/feed/v2`

**Descripción**: Feed mejorado con filtros y personalización

**Request**:
```typescript
{
  type: 'trending' | 'home' | 'following' | 'channel' | 'personalized',
  fid?: number,
  channelId?: string,
  cursor?: string,
  limit?: number, // 1-50, default 25

  // NEW: Filtros avanzados
  filters?: {
    languages?: string[], // ['en', 'es', 'fr']
    contentTypes?: ('text' | 'image' | 'video' | 'link' | 'frame')[],
    minEngagement?: {
      likes?: number,
      recasts?: number,
      replies?: number
    },
    dateRange?: {
      from?: string, // ISO date
      to?: string
    },
    hashtags?: string[] // Filter by specific hashtags
  },

  // NEW: Sorting
  sortBy?: 'chronological' | 'engagement' | 'personalized',

  // NEW: Personalization
  usePersonalization?: boolean // Default true for 'home'
}
```

**Response**:
```typescript
{
  casts: Cast[],
  next: {
    cursor: string
  } | null,
  meta: {
    total: number,
    filtered: number,
    appliedFilters: FilterSummary
  }
}
```

**Caching**:
- Trending: `s-maxage=300` (5 min)
- Personalized: `private, no-cache`
- Channel: `s-maxage=180` (3 min)

**Rate Limit**: 100 req/min per user

---

#### GET `/api/feed/stream`

**Descripción**: SSE stream para actualizaciones en tiempo real

**Request**:
```
GET /api/feed/stream?type=following&fid=12345&token=jwt_token
```

**Response** (SSE):
```
event: connected
data: {"status":"connected","clientId":"abc123"}

event: new_cast
data: {"type":"new_cast","cast":{...}}

event: cast_deleted
data: {"type":"cast_deleted","castHash":"0x123..."}

event: reaction_update
data: {"type":"reaction_update","castHash":"0x123...","reactions":{"likes":45,"recasts":12}}

event: ping
data: {"timestamp":1705612345}
```

**Implementation**:
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const fid = searchParams.get('fid')
  const token = searchParams.get('token')

  // Validate JWT token
  const session = await verifyToken(token)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Initial connection
      send('connected', { status: 'connected', clientId: nanoid() })

      // Subscribe to Redis pub/sub
      const subscriber = redis.subscribe(`feed:${type}:${fid}`)

      subscriber.on('message', (channel, message) => {
        const event = JSON.parse(message)
        send(event.type, event.data)
      })

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        send('ping', { timestamp: Date.now() })
      }, 30000)

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        subscriber.unsubscribe()
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

---

#### GET `/api/feed/trending-topics`

**Descripción**: Top trending topics/hashtags

**Request**:
```
GET /api/feed/trending-topics?limit=10&timeframe=24h
```

**Response**:
```typescript
{
  topics: [
    {
      keyword: '#farcaster',
      count: 2341,
      trend: 'up',
      percentChange: 12.3,
      topCasts: ['0x123...', '0x456...', '0x789...'] // Hashes
    }
  ],
  computedAt: '2026-01-18T12:00:00Z',
  nextUpdate: '2026-01-18T12:05:00Z'
}
```

**Computation** (Background Job - every 5 min):
```typescript
// Cron: /api/cron/compute-trending-topics
async function computeTrendingTopics() {
  const now = new Date()
  const last24h = subHours(now, 24)
  const last4h = subHours(now, 4)
  const prev4h = subHours(now, 8)

  // 1. Fetch recent casts from Neynar
  const casts = await neynarClient.fetchRecentCasts({ limit: 5000 })

  // 2. Extract hashtags + keywords (NLP)
  const topics = new Map<string, TopicMetrics>()

  for (const cast of casts) {
    const hashtags = extractHashtags(cast.text)
    const keywords = extractKeywords(cast.text, { minLength: 4, maxWords: 2 })

    for (const topic of [...hashtags, ...keywords]) {
      if (!topics.has(topic)) {
        topics.set(topic, { count: 0, countLast4h: 0, countPrev4h: 0, topCasts: [] })
      }

      const metrics = topics.get(topic)!
      metrics.count++

      if (cast.timestamp > last4h) metrics.countLast4h++
      else if (cast.timestamp > prev4h) metrics.countPrev4h++

      // Track top casts by engagement
      if (metrics.topCasts.length < 3) {
        metrics.topCasts.push(cast.hash)
      } else {
        const minEngagement = Math.min(...metrics.topCasts.map(h => getEngagement(h)))
        if (getEngagement(cast.hash) > minEngagement) {
          metrics.topCasts.sort((a, b) => getEngagement(b) - getEngagement(a))
          metrics.topCasts[2] = cast.hash
        }
      }
    }
  }

  // 3. Calculate trend and velocity
  const trending = Array.from(topics.entries()).map(([keyword, metrics]) => {
    const velocity = metrics.countPrev4h > 0
      ? (metrics.countLast4h - metrics.countPrev4h) / metrics.countPrev4h
      : 1

    const trend = velocity > 0.05 ? 'up' : velocity < -0.05 ? 'down' : 'neutral'
    const percentChange = velocity * 100

    // Weighted score: count * (1 + velocity)
    const score = metrics.count * (1 + Math.max(velocity, 0))

    return {
      keyword,
      count: metrics.count,
      trend,
      percentChange: Math.round(percentChange * 10) / 10,
      topCasts: metrics.topCasts,
      score
    }
  })

  // 4. Sort by score and take top N
  trending.sort((a, b) => b.score - a.score)
  const topN = trending.slice(0, 20)

  // 5. Cache in DB
  await db.delete(trendingTopicsCache).where(
    lt(trendingTopicsCache.expiresAt, now)
  )

  await db.insert(trendingTopicsCache).values(
    topN.map(t => ({
      id: nanoid(),
      keyword: t.keyword,
      count: t.count,
      trend: t.trend,
      percentChange: t.percentChange,
      topCasts: JSON.stringify(t.topCasts),
      computedAt: now,
      expiresAt: addMinutes(now, 5)
    }))
  )

  // 6. Publish to Redis for real-time updates
  await redis.publish('trending-topics:updated', JSON.stringify({ updatedAt: now }))
}
```

---

### Componentes Frontend Clave

#### `<FeedWithRealtime>`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Virtuoso } from 'react-virtuoso'
import { useSSE } from '@/hooks/useSSE'
import { CastCard } from '@/components/feed/cast-card'
import { FeedFilters } from '@/components/feed/FeedFilters'

interface FeedWithRealtimeProps {
  type: 'trending' | 'home' | 'following' | 'channel'
  fid?: number
  channelId?: string
}

export function FeedWithRealtime({ type, fid, channelId }: FeedWithRealtimeProps) {
  const [filters, setFilters] = useState<FeedFilters>({})
  const [newCastsBuffer, setNewCastsBuffer] = useState<Cast[]>([])

  // Fetch feed with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['feed', type, fid, channelId, filters],
    queryFn: async ({ pageParam }) => {
      const res = await fetch('/api/feed/v2', {
        method: 'POST',
        body: JSON.stringify({
          type,
          fid,
          channelId,
          cursor: pageParam,
          filters
        })
      })
      return res.json()
    },
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    staleTime: 30 * 1000
  })

  // Real-time updates via SSE
  const { events, isConnected } = useSSE({
    url: `/api/feed/stream?type=${type}&fid=${fid}`,
    enabled: true
  })

  useEffect(() => {
    for (const event of events) {
      if (event.type === 'new_cast') {
        setNewCastsBuffer(prev => {
          // Max 50 buffered casts
          if (prev.length >= 50) return prev
          return [event.data.cast, ...prev]
        })
      }

      if (event.type === 'cast_deleted') {
        // Remove from buffer and main feed
        setNewCastsBuffer(prev => prev.filter(c => c.hash !== event.castHash))
        queryClient.setQueryData(['feed', type, fid, channelId, filters], (old) => {
          // Remove from all pages
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              casts: page.casts.filter(c => c.hash !== event.castHash)
            }))
          }
        })
      }

      if (event.type === 'reaction_update') {
        // Update reaction counts
        queryClient.setQueryData(['feed', type, fid, channelId, filters], (old) => {
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              casts: page.casts.map(c =>
                c.hash === event.castHash
                  ? { ...c, reactions: event.reactions }
                  : c
              )
            }))
          }
        })
      }
    }
  }, [events])

  const allCasts = data?.pages.flatMap(page => page.casts) ?? []

  const handleShowNewCasts = () => {
    // Insert buffered casts at top
    queryClient.setQueryData(['feed', type, fid, channelId, filters], (old) => {
      const firstPage = old.pages[0]
      return {
        ...old,
        pages: [
          { ...firstPage, casts: [...newCastsBuffer, ...firstPage.casts] },
          ...old.pages.slice(1)
        ]
      }
    })
    setNewCastsBuffer([])
  }

  return (
    <div>
      {/* Filter UI */}
      <FeedFilters filters={filters} onChange={setFilters} />

      {/* New casts notification */}
      {newCastsBuffer.length > 0 && (
        <div className="sticky top-0 z-50 flex justify-center p-4">
          <button
            onClick={handleShowNewCasts}
            className="bg-primary text-white px-4 py-2 rounded-full shadow-lg"
          >
            ↑ {newCastsBuffer.length} nuevos casts
          </button>
        </div>
      )}

      {/* Connection status */}
      {!isConnected && (
        <div className="bg-yellow-100 text-yellow-800 p-2 text-sm text-center">
          Conexión perdida. Reconectando...
        </div>
      )}

      {/* Virtualized feed */}
      <Virtuoso
        data={allCasts}
        useWindowScroll
        increaseViewportBy={800}
        endReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
          }
        }}
        itemContent={(index, cast) => (
          <CastCard key={cast.hash} cast={cast} />
        )}
        components={{
          Footer: () => isFetchingNextPage ? <LoadingSpinner /> : null
        }}
      />
    </div>
  )
}
```

---

#### `<FeedFilters>`

```typescript
'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'

export function FeedFilters({ filters, onChange }) {
  const [open, setOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState(filters)

  const handleApply = () => {
    onChange(localFilters)
    setOpen(false)
  }

  const handleClear = () => {
    setLocalFilters({})
    onChange({})
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          ⚙️ Filtros {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96">
        <div className="space-y-4">
          {/* Language filter */}
          <div>
            <h4 className="font-medium mb-2">🌐 Idioma</h4>
            <div className="space-y-2">
              <Checkbox
                checked={localFilters.languages?.includes('es')}
                onCheckedChange={(checked) => {
                  setLocalFilters(prev => ({
                    ...prev,
                    languages: checked
                      ? [...(prev.languages || []), 'es']
                      : prev.languages?.filter(l => l !== 'es')
                  }))
                }}
              >
                Español
              </Checkbox>
              <Checkbox
                checked={localFilters.languages?.includes('en')}
                onCheckedChange={(checked) => {
                  setLocalFilters(prev => ({
                    ...prev,
                    languages: checked
                      ? [...(prev.languages || []), 'en']
                      : prev.languages?.filter(l => l !== 'en')
                  }))
                }}
              >
                English
              </Checkbox>
            </div>
          </div>

          {/* Content type filter */}
          <div>
            <h4 className="font-medium mb-2">📝 Tipo de Contenido</h4>
            <div className="space-y-2">
              {['text', 'image', 'video', 'link', 'frame'].map(type => (
                <Checkbox
                  key={type}
                  checked={localFilters.contentTypes?.includes(type)}
                  onCheckedChange={(checked) => {
                    setLocalFilters(prev => ({
                      ...prev,
                      contentTypes: checked
                        ? [...(prev.contentTypes || []), type]
                        : prev.contentTypes?.filter(t => t !== type)
                    }))
                  }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Checkbox>
              ))}
            </div>
          </div>

          {/* Engagement filter */}
          <div>
            <h4 className="font-medium mb-2">⭐ Engagement Mínimo</h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">
                  Likes: {localFilters.minEngagement?.likes || 0}
                </label>
                <Slider
                  value={[localFilters.minEngagement?.likes || 0]}
                  onValueChange={([value]) => {
                    setLocalFilters(prev => ({
                      ...prev,
                      minEngagement: { ...prev.minEngagement, likes: value }
                    }))
                  }}
                  max={100}
                  step={5}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="ghost" onClick={handleClear}>
              Limpiar
            </Button>
            <Button onClick={handleApply}>
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

---

### Hooks Personalizados

#### `useSSE`

```typescript
'use client'

import { useEffect, useState, useRef } from 'react'
import { getSession } from '@/lib/auth'

interface SSEOptions {
  url: string
  enabled?: boolean
  onError?: (error: Error) => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useSSE({
  url,
  enabled = true,
  onError,
  reconnectInterval = 2000,
  maxReconnectAttempts = 5
}: SSEOptions) {
  const [events, setEvents] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectAttemptsRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    async function connect() {
      try {
        // Get auth token
        const session = await getSession()
        if (!session) return

        const token = await generateSSEToken(session.userId)

        // Create EventSource
        const eventSource = new EventSource(`${url}&token=${token}`)
        eventSourceRef.current = eventSource

        eventSource.addEventListener('connected', (e) => {
          setIsConnected(true)
          reconnectAttemptsRef.current = 0
          console.log('[SSE] Connected:', e.data)
        })

        eventSource.addEventListener('new_cast', (e) => {
          const data = JSON.parse(e.data)
          setEvents(prev => [...prev, { type: 'new_cast', ...data }])
        })

        eventSource.addEventListener('cast_deleted', (e) => {
          const data = JSON.parse(e.data)
          setEvents(prev => [...prev, { type: 'cast_deleted', ...data }])
        })

        eventSource.addEventListener('reaction_update', (e) => {
          const data = JSON.parse(e.data)
          setEvents(prev => [...prev, { type: 'reaction_update', ...data }])
        })

        eventSource.addEventListener('ping', () => {
          // Heartbeat - keep connection alive
        })

        eventSource.onerror = (error) => {
          console.error('[SSE] Error:', error)
          setIsConnected(false)
          eventSource.close()

          // Reconnect with exponential backoff
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = reconnectInterval * Math.pow(2, reconnectAttemptsRef.current)
            reconnectAttemptsRef.current++

            setTimeout(() => {
              console.log('[SSE] Reconnecting... (attempt', reconnectAttemptsRef.current, ')')
              connect()
            }, delay)
          } else {
            onError?.(new Error('Max reconnect attempts reached'))
          }
        }
      } catch (error) {
        console.error('[SSE] Connection error:', error)
        onError?.(error as Error)
      }
    }

    connect()

    return () => {
      eventSourceRef.current?.close()
    }
  }, [url, enabled])

  return {
    events,
    isConnected,
    clearEvents: () => setEvents([])
  }
}
```

---

## Plan de Implementación

### Fase 1: Fundamentos (Semanas 1-4)

#### Sprint 1-2: Real-Time Updates & Filtros Básicos
- [ ] **Semana 1**
  - [ ] Implementar endpoint SSE `/api/feed/stream`
  - [ ] Redis Pub/Sub para broadcasting de eventos
  - [ ] Hook `useSSE` con reconexión automática
  - [ ] Componente `<FeedWithRealtime>` básico
  - [ ] Testing de SSE (load testing con 1000 conexiones)

- [ ] **Semana 2**
  - [ ] UI de filtros (`<FeedFilters>` component)
  - [ ] Backend filtering en `/api/feed/v2`
  - [ ] Persistencia de filtros en DB (`userFeedPreferences`)
  - [ ] Migración de datos de localStorage a DB
  - [ ] Testing de filtros

**Entregables**:
- Feed con actualizaciones en tiempo real ✅
- Filtros básicos (idioma, tipo de contenido) ✅
- Persistencia de preferencias ✅

**Métricas de Éxito**:
- SSE connection success rate > 95%
- Filter application time < 200ms
- Zero data loss en migraciones

---

#### Sprint 3-4: Moderación & Optimización
- [ ] **Semana 3**
  - [ ] Tablas `userModeration` en schema
  - [ ] API endpoints para mute/block CRUD
  - [ ] Migración de listas localStorage → DB
  - [ ] UI de gestión de moderación en `/settings/moderation`
  - [ ] Sync automático entre dispositivos

- [ ] **Semana 4**
  - [ ] Integración Cloudflare Images para srcset
  - [ ] Lazy loading de HLS.js (solo on play)
  - [ ] Optimización de batch size adaptativo
  - [ ] Performance testing (Lighthouse)
  - [ ] Bug fixes y refinamiento

**Entregables**:
- Moderación persistente y sincronizada ✅
- Mejoras de performance mobile (30% faster) ✅

**Métricas de Éxito**:
- TTI mobile < 2.5s
- Lighthouse score > 85
- Moderation sync latency < 1s

---

### Fase 2: Inteligencia (Semanas 5-8)

#### Sprint 5-6: Personalización & Trending Topics
- [ ] **Semana 5**
  - [ ] Tabla `userInteractionProfile`
  - [ ] Event tracking de interacciones (likes, replies, views)
  - [ ] Algoritmo de scoring básico (v1)
  - [ ] Modo "Algorítmico" vs "Cronológico" toggle
  - [ ] Testing de relevancia con usuarios beta

- [ ] **Semana 6**
  - [ ] Background job para trending topics (cron)
  - [ ] NLP extraction de hashtags/keywords
  - [ ] Tabla `trendingTopicsCache`
  - [ ] API `/api/feed/trending-topics`
  - [ ] Sidebar UI con trending topics

**Entregables**:
- Algoritmo de personalización básico ✅
- Trending topics en sidebar ✅

**Métricas de Éxito**:
- Relevance score correlación > 0.6 con engagement
- Trending topics refresh < 5min
- User satisfaction score > 4.0/5.0

---

#### Sprint 7-8: Descubrimiento & Bookmarks
- [ ] **Semana 7**
  - [ ] Channel discovery mejorado
  - [ ] Saved searches functionality
  - [ ] Search integration en feed
  - [ ] Autocomplete para búsquedas

- [ ] **Semana 8**
  - [ ] Tablas `bookmarks` y `bookmarkCollections`
  - [ ] API endpoints para bookmarks CRUD
  - [ ] Página `/bookmarks`
  - [ ] UI de colecciones
  - [ ] Compartir colecciones (público/privado)

**Entregables**:
- Descubrimiento mejorado ✅
- Sistema de bookmarks completo ✅

**Métricas de Éxito**:
- Search time to result < 3s
- Bookmark creation success rate > 99%
- Collection usage rate > 30% de usuarios

---

### Fase 3: Analytics & Refinamiento (Semanas 9-12)

#### Sprint 9-10: Analytics Dashboard
- [ ] **Semana 9**
  - [ ] Analytics schema (extend `castAnalytics`)
  - [ ] Data aggregation pipeline
  - [ ] Dashboard components
  - [ ] Charts (engagement over time, top casts)

- [ ] **Semana 10**
  - [ ] AI-powered insights (Gemini)
  - [ ] Best time to post calculator
  - [ ] Content type performance breakdown
  - [ ] Export data functionality

**Entregables**:
- Analytics dashboard completo ✅
- AI insights ✅

---

#### Sprint 11-12: A/B Testing & Accesibilidad
- [ ] **Semana 11**
  - [ ] A/B testing framework
  - [ ] Feature flags infrastructure
  - [ ] Experiment tracking
  - [ ] Statistical significance calculator

- [ ] **Semana 12**
  - [ ] Accessibility audit (WCAG 2.1 AA)
  - [ ] ARIA labels completos
  - [ ] Keyboard navigation improvements
  - [ ] Screen reader testing
  - [ ] Color contrast fixes
  - [ ] Focus management
  - [ ] Final QA y bug fixes

**Entregables**:
- A/B testing platform ✅
- WCAG 2.1 AA compliance ✅

**Métricas de Éxito**:
- Accessibility score > 95 (Lighthouse)
- Zero critical accessibility issues
- A/B testing confidence interval > 95%

---

### Cronograma Visual

```
Enero 2026                Febrero 2026              Marzo 2026                Abril 2026
Week: 1  2  3  4          5  6  7  8               9  10 11 12               13
      ├──┴──┴──┤          ├──┴──┴──┤               ├──┴──┴──┤                │
      │ FASE 1 │          │ FASE 2 │               │ FASE 3 │                Launch
      │        │          │        │               │        │                ↓
      Real-Time          Personalización         Analytics             Production
      Filtros            Trending Topics         A/B Testing            Rollout
      Moderación         Bookmarks               Accessibility
      Performance        Discovery
```

---

## Métricas de Éxito

### KPIs Primarios

| Métrica | Baseline | Target (3 meses) | Medición |
|---------|----------|------------------|----------|
| **DAU/MAU Ratio** | 35% | 50%+ | Analytics dashboard |
| **Avg Session Duration** | 12 min | 18-20 min | PostHog/Mixpanel |
| **Engagement Rate** | 2.3 actions/session | 3.5+ actions/session | Internal analytics |
| **Feed Refresh Rate** | 8x/session (manual) | < 2x/session (auto) | Event tracking |
| **Content Discovery Time** | 4.5 min | < 2 min | User timing API |
| **User Retention (D7)** | 42% | 55%+ | Cohort analysis |

### KPIs Secundarios

| Métrica | Baseline | Target | Medición |
|---------|----------|--------|----------|
| **NPS Score** | 7.2 | 8.5+ | Quarterly survey |
| **API Error Rate** | 0.8% | < 0.3% | Sentry |
| **SSE Connection Success** | N/A | > 95% | Server logs |
| **Feed Load Time (p95)** | 2.8s | < 1.5s | RUM |
| **Bookmarks Created** | N/A | 20% users | Analytics |
| **Filter Usage** | 5% users | 40% users | Analytics |

### Métricas de Performance Técnica

| Métrica | Baseline | Target | Tool |
|---------|----------|--------|------|
| **Lighthouse Score** | 72 | > 85 | Lighthouse CI |
| **Largest Contentful Paint** | 3.2s | < 2.0s | Web Vitals |
| **Cumulative Layout Shift** | 0.15 | < 0.1 | Web Vitals |
| **Time to First Byte** | 680ms | < 400ms | WebPageTest |
| **API p95 Latency** | 890ms | < 500ms | Datadog |
| **SSE Reconnect Rate** | N/A | < 5% | Custom metric |

---

## Riesgos y Mitigación

### Riesgos Técnicos

#### 🔴 ALTO: Neynar API Rate Limiting

**Descripción**: Con más usuarios y SSE activo, podemos exceder rate limits de Neynar

**Probabilidad**: Alta (70%)
**Impacto**: Crítico (feed no carga)

**Mitigación**:
1. **Cache agresivo**:
   - Redis cache con TTL dinámico (trending: 5min, personalized: 1min)
   - Cache warming con background jobs

2. **Request batching**:
   - Agrupar requests de SSE en ventanas de 1s
   - Enviar batch update en lugar de individual

3. **Circuit breaker**:
   - Detectar rate limit (429)
   - Degradar a cached data + warning toast
   - Exponential backoff para retry

4. **Tier upgrade**:
   - Negociar con Neynar upgrade de tier
   - Provisionar headroom de 2x actual usage

**Plan de Contingencia**:
- Si rate limit crítico → mostrar cached feed + disable SSE
- Comunicación proactiva a usuarios: "Experiencia limitada temporalmente"

---

#### 🟠 MEDIO: SSE Connection Overhead

**Descripción**: 10,000 conexiones SSE simultáneas pueden saturar servidor

**Probabilidad**: Media (40%)
**Impacto**: Alto (degradación de performance)

**Mitigación**:
1. **Connection pooling**:
   - Redis Pub/Sub con fan-out
   - 1 subscription por feed type (no por usuario)

2. **Horizontal scaling**:
   - Load balancer distribuye SSE connections
   - Sticky sessions para mantener estado

3. **Graceful degradation**:
   - Si connections > threshold → disable SSE para nuevos usuarios
   - Fallback a polling cada 30s

4. **Monitoring**:
   - Alert si active connections > 8000
   - Auto-scaling trigger en Netlify

---

#### 🟡 BAJO: ML Model Performance

**Descripción**: Scoring de relevancia puede ser lento (> 100ms por cast)

**Probabilidad**: Media (50%)
**Impacto**: Medio (feed loading lento)

**Mitigación**:
1. **Pre-computation**:
   - Calcular scores en background job
   - Guardar en Redis con TTL 5min

2. **Sampling**:
   - Solo scorear top 100 casts, resto cronológico
   - Progressive enhancement

3. **Client-side filtering**:
   - Scoring simple en cliente para instant feedback
   - Server-side refinement async

4. **Simplificación de algoritmo**:
   - v1: reglas simples (< 50ms)
   - v2: ML model (después de optimizar)

---

### Riesgos de Producto

#### 🟠 MEDIO: Baja Adopción de Personalización

**Descripción**: Usuarios prefieren cronológico sobre algorítmico

**Probabilidad**: Media (40%)
**Impacto**: Medio (feature no usada)

**Mitigación**:
1. **A/B Testing**:
   - 50% usuarios en mode algorítmico default
   - Medir engagement, retention

2. **Educación**:
   - Tooltip explaining benefits
   - Onboarding tutorial

3. **Transparency**:
   - "Why am I seeing this?" button
   - Settings para ajustar pesos

4. **Hybrid approach**:
   - Cronológico + boost de casts relevantes
   - Menos disruptivo que full algorítmico

---

#### 🟡 BAJO: Complejidad de Filtros

**Descripción**: Demasiadas opciones de filtrado abruman a usuarios

**Probabilidad**: Baja (20%)
**Impacto**: Bajo (feature subutilizada)

**Mitigación**:
1. **Progressive disclosure**:
   - Filtros básicos visibles (idioma, tipo)
   - Avanzados colapsados ("Más filtros...")

2. **Presets**:
   - "Solo imágenes"
   - "Alto engagement"
   - "Últimas 24h"

3. **UX Research**:
   - User testing con 10 usuarios
   - Iterar basado en feedback

---

### Riesgos Operacionales

#### 🔴 ALTO: Incremento de Costos de Infraestructura

**Descripción**: Redis, CDN, API calls aumentan costos 3-5x

**Probabilidad**: Alta (80%)
**Impacto**: Alto (budget overrun)

**Proyección de Costos**:
| Servicio | Actual | Projected (10k users) | Incremento |
|----------|--------|-----------------------|------------|
| Upstash Redis | $50/mes | $200/mes | +300% |
| Netlify Functions | $80/mes | $250/mes | +212% |
| Neynar API | $100/mes | $400/mes | +300% |
| Cloudflare CDN | $20/mes | $80/mes | +300% |
| **TOTAL** | **$250/mes** | **$930/mes** | **+272%** |

**Mitigación**:
1. **Cost monitoring**:
   - Dashboard de costos en tiempo real
   - Alerts si > $1000/mes

2. **Optimización**:
   - Aggressive caching para reducir API calls
   - Image optimization para reducir bandwidth

3. **Tier negotiation**:
   - Volume discounts con providers
   - Commitment discounts (annual prepay)

4. **Revenue plan**:
   - Premium features ($10/mes) para offset costs
   - Target: 100 paying users = $1000/mes revenue

---

## Apéndices

### Apéndice A: Benchmarks de Competencia

#### Warpcast Feed Performance

| Métrica | Warpcast | Castor (Actual) | Castor (Target) |
|---------|----------|-----------------|-----------------|
| Time to First Cast | 1.2s | 2.5s | < 1.5s |
| Scroll FPS | 60 | 55-60 | 60 |
| Real-time Updates | ✅ SSE | ❌ | ✅ SSE |
| Filter Options | 3 | 1 | 8+ |
| Personalization | Basic | None | ML-based |

#### Twitter Feed Performance

| Métrica | Twitter | Castor (Target) |
|---------|---------|-----------------|
| Time to First Tweet | 0.8s | < 1.5s |
| Algorithmic Feed | ✅ Advanced | ✅ Basic |
| Real-time | ✅ WebSocket | ✅ SSE |
| Bookmarks | ✅ | ✅ |
| Lists | ✅ | ❌ (future) |

---

### Apéndice B: Diccionario de Términos

| Término | Definición |
|---------|------------|
| **Cast** | Publicación en Farcaster (equivalente a tweet) |
| **FID** | Farcaster ID - identificador único de usuario |
| **Neynar** | Proveedor de API para datos de Farcaster |
| **SSE** | Server-Sent Events - protocolo para updates en tiempo real |
| **Trending** | Casts con más engagement reciente |
| **Power Badge** | Usuario verificado de Farcaster |
| **Pro User** | Usuario premium de la plataforma |
| **Spam Filter** | Filtro para contenido de baja calidad |
| **Circuit Breaker** | Pattern para fallos de APIs externas |
| **Virtualization** | Renderizar solo elementos visibles en lista |

---

### Apéndice C: Referencias Técnicas

**Librerías Clave**:
- [react-virtuoso](https://virtuoso.dev/) - Virtualized lists
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) - SSE client
- [Upstash Redis](https://upstash.com/) - Serverless Redis
- [Drizzle ORM](https://orm.drizzle.team/) - Type-safe ORM
- [Gemini AI](https://ai.google.dev/) - ML personalization

**Documentación**:
- [Farcaster Protocol](https://docs.farcaster.xyz/)
- [Neynar API](https://docs.neynar.com/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)

---

### Apéndice D: User Stories Detalladas

#### US-001: Ver Feed en Tiempo Real
```
Como usuario activo de Castor,
Quiero que el feed se actualice automáticamente,
Para no perder contenido nuevo de usuarios que sigo

Criterios de Aceptación:
- [ ] Veo notificación "X nuevos casts" cuando hay contenido nuevo
- [ ] Hago click y los casts aparecen en top del feed
- [ ] No interrumpe mi scroll actual
- [ ] Funciona en móvil y desktop
- [ ] Veo indicator de conexión activa
```

#### US-002: Filtrar Feed por Preferencias
```
Como content creator,
Quiero filtrar casts por tipo de contenido e idioma,
Para encontrar inspiración relevante rápidamente

Criterios de Aceptación:
- [ ] Abro panel de filtros en < 2 clicks
- [ ] Selecciono múltiples filtros simultáneamente
- [ ] Veo resultados en < 1 segundo
- [ ] Filtros persisten entre sesiones
- [ ] Puedo limpiar filtros fácilmente
```

#### US-003: Descubrir Trending Topics
```
Como usuario casual,
Quiero ver qué temas están trending,
Para participar en conversaciones relevantes

Criterios de Aceptación:
- [ ] Veo sidebar con top 10 topics
- [ ] Cada topic muestra count y trend direction
- [ ] Hago click y filtro feed a ese topic
- [ ] Topics se actualizan cada 5 minutos
- [ ] Puedo ver top casts de cada topic
```

---

### Apéndice E: Plan de Rollout

#### Beta Testing (Semana 11)
- **Participantes**: 50 usuarios power (top contributors)
- **Duración**: 1 semana
- **Features**: Todas menos A/B testing
- **Feedback**: Survey + analytics
- **Criterio de Éxito**: > 80% satisfaction, < 5 critical bugs

#### Gradual Rollout (Semana 12-13)
```
Día 1-2:   10% usuarios (flag: feed_v2_enabled)
Día 3-4:   25% usuarios
Día 5-6:   50% usuarios
Día 7-8:   75% usuarios
Día 9-10:  100% usuarios
```

**Rollback Criteria**:
- Error rate > 5%
- API latency p95 > 2s
- SSE disconnect rate > 20%
- User complaints > 10/hour

---

## Conclusión

Este PRD define una hoja de ruta completa para transformar el feed global de Castor en una experiencia de clase mundial. Con actualizaciones en tiempo real, personalización inteligente, y descubrimiento mejorado, Castor se posicionará como la herramienta premium para gestión de contenido en Farcaster.

**Próximos Pasos**:
1. ✅ Revisión de stakeholders
2. ✅ Refinamiento de estimaciones
3. ✅ Kick-off de Fase 1
4. ✅ Setup de tracking de métricas

**Aprobaciones**:
- [ ] Product Lead: _______________  Fecha: _______
- [ ] Engineering Lead: _______________  Fecha: _______
- [ ] Design Lead: _______________  Fecha: _______

---

**Última Actualización**: Enero 18, 2026
**Versión**: 1.0
**Mantenedor**: Equipo de Producto Castor
