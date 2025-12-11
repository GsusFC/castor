# Vista de Cast/Conversación - Especificación

## Objetivo
Permitir ver un cast individual con su contexto completo (conversación, replies) sin salir de Castor.

---

## 1. Arquitectura

### 1.1 Ruta
```
/cast/[identifier]
```
- `identifier` puede ser:
  - Hash del cast: `0x1234abcd...`
  - URL de Warpcast: Se parsea para extraer el hash

### 1.2 Layout
```
┌─────────────────────────────────────┐
│ ← Back          Conversación        │  Header
├─────────────────────────────────────┤
│ [Cast padre si existe]              │  Parent (opcional)
│   └── línea conectora               │
├─────────────────────────────────────┤
│ ████████████████████████████        │  Cast principal
│ █ Cast seleccionado        █        │  (destacado)
│ ████████████████████████████        │
├─────────────────────────────────────┤
│ Replies (N)                         │
│ ┌─ Reply 1 ─────────────────┐       │
│ └─────────────────────────────┘     │
│ ┌─ Reply 2 ─────────────────┐       │
│ └─────────────────────────────┘     │
└─────────────────────────────────────┘
```

---

## 2. API

### 2.1 GET `/api/casts/[hash]/conversation`

**Request:**
```
GET /api/casts/abc123/conversation
```

**Response:**
```json
{
  "cast": { ... },           // Cast principal
  "parent": { ... } | null,  // Cast padre (si es reply)
  "thread": [ ... ],         // Thread completo (desde root)
  "replies": {
    "casts": [ ... ],        // Replies directos
    "cursor": "...",         // Para paginación
    "hasMore": true
  }
}
```

### 2.2 Neynar Endpoints a usar
- `GET /cast` - Obtener cast por hash
- `GET /cast/conversation` - Obtener conversación completa
- `GET /cast/replies` - Obtener replies (paginado)

---

## 3. Componentes

### 3.1 `ConversationView`
```tsx
interface ConversationViewProps {
  castHash: string
  onBack: () => void
  onSelectUser: (username: string) => void
  onReply: (cast: Cast) => void
}
```

**Responsabilidades:**
- Cargar conversación desde API
- Mostrar parent → cast → replies
- Manejar paginación de replies
- Scroll automático al cast principal

### 3.2 `ThreadLine`
Componente visual para conectar casts en un thread (línea vertical).

### 3.3 Modificar `CastCard`
- Prop `variant`: `'default' | 'highlighted' | 'compact'`
- `highlighted` para el cast principal
- `compact` para contexto (parent, replies en preview)

---

## 4. Navegación

### 4.1 Puntos de entrada
| Origen | Acción | Destino |
|--------|--------|---------|
| Notificación (like/recast/mention) | Click | `/cast/[hash]` |
| CastCard embed | Click en quote | `/cast/[hash]` |
| URL de Warpcast en texto | Click | `/cast/[hash]` |
| Búsqueda de casts | Click en resultado | `/cast/[hash]` |

### 4.2 Navegación interna
- **Back button**: Vuelve a la vista anterior
- **Click en usuario**: Abre `ProfileView`
- **Click en reply**: Navega a ese cast como principal
- **Click en parent**: Navega al parent como principal

---

## 5. Estados

### 5.1 Loading
```
┌─────────────────────────────────────┐
│ ← Back          Conversación        │
├─────────────────────────────────────┤
│         [Skeleton loader]           │
│                                     │
└─────────────────────────────────────┘
```

### 5.2 Error
```
┌─────────────────────────────────────┐
│ ← Back          Conversación        │
├─────────────────────────────────────┤
│   ⚠️ No se pudo cargar el cast     │
│   [Reintentar]                      │
└─────────────────────────────────────┘
```

### 5.3 Cast eliminado
```
┌─────────────────────────────────────┐
│ ← Back          Conversación        │
├─────────────────────────────────────┤
│   🗑️ Este cast ha sido eliminado   │
└─────────────────────────────────────┘
```

---

## 6. Implementación por fases

### Fase 1: Base (MVP)
- [ ] Crear ruta `/cast/[hash]/page.tsx`
- [ ] Crear API `/api/casts/[hash]/conversation`
- [ ] Componente `ConversationView` básico
- [ ] Mostrar cast principal + replies

### Fase 2: Contexto
- [ ] Mostrar cast padre si existe
- [ ] Componente `ThreadLine`
- [ ] Navegación entre casts del thread

### Fase 3: Integración
- [ ] Conectar notificaciones → ConversationView
- [ ] Conectar embeds de casts → ConversationView
- [ ] Conectar búsqueda → ConversationView

### Fase 4: UX
- [ ] Scroll automático al cast principal
- [ ] Animaciones de transición
- [ ] Keyboard navigation
- [ ] Responsive (drawer en mobile)

---

## 7. Consideraciones técnicas

### 7.1 Cache
- Usar React Query con cache de 5 minutos
- Invalidar al responder/likear

### 7.2 Mobile
- En mobile, usar `Sheet` desde abajo
- En desktop, navegación normal o modal

### 7.3 Deep linking
- URLs compartibles: `castor.app/cast/0x123...`
- Redirect desde URLs de Warpcast

---

## 8. Prioridad
**Alta** - Es core para la experiencia de usuario, actualmente rompe el flujo al salir a Warpcast.
