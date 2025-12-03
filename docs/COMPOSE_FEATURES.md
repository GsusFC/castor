# Castor - Funcionalidades del Compositor de Casts

Este documento describe las lógicas implementadas en el sistema de composición de casts.

---

## 1. Contador de Caracteres Inteligente

**Archivo:** `src/lib/url-utils.ts`

Las URLs en Farcaster siempre cuentan como **23 caracteres**, independientemente de su longitud real.

```typescript
export function calculateTextLength(text: string): number {
  const urls = extractUrls(text)
  let length = text.length
  
  for (const url of urls) {
    length = length - url.length + 23
  }
  
  return length
}
```

**Uso:** El contador en el header del ComposeCard muestra `{chars}/{maxChars}` donde `chars` es el resultado de `calculateTextLength()`.

---

## 2. Menciones (@usuario)

**Archivos:**
- `src/components/compose/MentionAutocomplete.tsx`
- `src/app/api/users/search/route.ts`

### Flujo:
1. Usuario escribe `@` seguido de texto
2. Se detecta el patrón `/@(\w*)$/` en el texto antes del cursor
3. Se muestra un popover con resultados de búsqueda
4. Al seleccionar un usuario, se reemplaza `@query` por `@username `

### API de búsqueda:
```
GET /api/users/search?q={query}
```
Usa Neynar SDK para buscar usuarios en Farcaster.

---

## 3. Detección de URLs y Link Previews

**Archivos:**
- `src/lib/url-utils.ts` - Extracción de URLs
- `src/app/api/og-metadata/route.ts` - Fetch de metadatos Open Graph
- `src/components/compose/LinkPreview.tsx` - Componente visual

### Flujo:
1. Se detectan URLs en el texto con debounce de 500ms
2. URLs de media (imágenes/videos) se ignoran
3. Para cada URL nueva, se hace fetch a `/api/og-metadata`
4. Se muestra preview con título, descripción e imagen

### Tipos de URL detectados:
- URLs estándar (`https://...`)
- URLs de Warpcast (para quote casts)

---

## 4. Reply To (Respuestas)

**Archivos:**
- `src/components/compose/ReplyToPicker.tsx`
- `src/app/api/casts/lookup/route.ts`

### Flujo:
1. Usuario pega URL de Warpcast o hash de cast
2. Se busca el cast via API
3. Se muestra mini-preview del cast original
4. Al publicar, se envía `parentHash` al backend

---

## 5. Vista Previa (Preview)

**Archivo:** `src/components/compose/CastPreview.tsx`

Muestra cómo se verá el cast antes de publicar:
- Avatar y username de la cuenta
- Canal seleccionado
- Contenido con mentions resaltadas
- Link previews
- Media attachments

En el nuevo diseño, se accede via popover con el icono 👁 (solo desktop).

---

## 6. Threads

### Lógica:
- Botón `[+]` en el header añade un nuevo cast al thread
- Solo se activa cuando hay contenido en el cast actual
- Cada cast tiene su propio editor con toolbar
- Al publicar, se usa `/api/casts/schedule-thread`

### Estructura de datos:
```typescript
interface CastItem {
  id: string
  content: string
  media: MediaFile[]
  links: LinkEmbed[]
}
```

---

## 7. Media (Imágenes, Videos, GIFs)

**Archivos:**
- `src/app/api/media/upload/route.ts`
- `src/components/compose/GifPicker.tsx`

### Límites:
- Máximo 2 archivos por cast
- Tipos soportados: imágenes, videos, GIFs

### Flujo de upload:
1. Usuario selecciona archivo
2. Se muestra preview local inmediato
3. Se sube a Cloudinary en background
4. Se actualiza con URL final

---

## 8. Selección de Canal

**Archivo:** `src/components/compose/ChannelPicker.tsx` (ahora integrado en ComposeCard)

### Flujo:
1. Dropdown con búsqueda
2. Carga canales del usuario por defecto
3. Búsqueda en todos los canales con query >= 2 chars
4. Canal seleccionado se muestra como chip

---

## 9. Programación de Fecha/Hora

**Lógica de timezone:**
- UI muestra hora en Europe/Madrid
- Se convierte a UTC para almacenar
- Función `toMadridISO()` maneja DST automáticamente

---

## 10. Auto-Refresh de Casts Programados

**Archivo:** `src/components/AutoRefresh.tsx`

Componente que refresca la página cada 30 segundos cuando hay casts programados pendientes.

```typescript
<AutoRefresh interval={30000} enabled={hasScheduledCasts} />
```

Usa `router.refresh()` de Next.js para revalidar datos del servidor sin recargar la página completa.

---

## Arquitectura del ComposeCard

El nuevo `ComposeCard` unifica todos los componentes en una sola card compacta:

```
┌─────────────────────────────────────────────────────────────┐
│  [@cuenta ▼]  [#canal ▼]  [🕐 fecha ▼]    [👁] [+]  45/320  │
├─────────────────────────────────────────────────────────────┤
│  [Reply to context - si existe]                             │
├─────────────────────────────────────────────────────────────┤
│  Textarea con contenido                                     │
│  [Link previews]                                            │
│  [Media thumbnails]                                         │
│  ─────────────────────────────────────────────────────────  │
│  [📷] [😀] [GIF]                                            │
├─────────────────────────────────────────────────────────────┤
│                              [Borrador] [Programar →]       │
└─────────────────────────────────────────────────────────────┘
```

### Props principales:
- `isEditMode`: Oculta botón + y borrador, cambia texto a "Guardar"
- `hasContent`: Habilita/deshabilita acciones
- `hasOverLimit`: Muestra contador en rojo

---

---

## 11. Modal de Composición

**Archivo:** `src/components/compose/ComposeModal.tsx`

El compositor ahora funciona como un modal accesible desde cualquier página del dashboard.

### Comportamiento:
- **Desktop**: Modal centrado con max-width de 512px
- **Móvil**: Fullscreen para máxima comodidad

### Flujo:
1. Click en "Nuevo Cast" en sidebar
2. Se abre el modal con el `ComposeCard`
3. Al publicar/guardar → cierra el modal y hace `router.refresh()`
4. El cast aparece inmediatamente en el listado/calendario

### Ventajas:
- No pierdes el contexto de la página actual
- Feedback visual inmediato al ver el cast añadido
- Un solo click para empezar a escribir

---

## Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `src/components/compose/ComposeCard.tsx` | Componente principal unificado |
| `src/components/compose/ComposeModal.tsx` | Modal que envuelve ComposeCard |
| `src/components/compose/types.ts` | Tipos compartidos |
| `src/lib/url-utils.ts` | Utilidades de URLs |
| `src/components/layout/Sidebar.tsx` | Sidebar con botón que abre el modal |
| `src/app/(dashboard)/dashboard/edit/[id]/page.tsx` | Página de editar cast |
