# V2 Studio Redesign — Spec

## Visión

Castor pasa de ser una app con feed + scheduler a ser una **herramienta centrada en el composer y la programación de contenido**. El Studio es el corazón del producto.

---

## Cambio de Layout Principal

### Antes (v1)
- Sidebar izquierdo (260px) con navegación completa
- Contenido centrado (max-w-4xl) con mucho espacio desperdiciado
- Composer como modal (max-w-2xl) que bloquea toda la vista
- Calendario y composer nunca conviven
- Feed y Studio tienen el mismo peso en la navegación

### Después (v2)
- **Header horizontal** con navegación mínima (sin sidebar)
- **Split view** en Studio: composer izquierda (~45%) + calendario derecha (~55%)
- Composer es un **panel persistente**, no un modal
- Calendario y composer **siempre visibles a la vez**
- Studio es la vista principal, Feed es secundario

---

## Header (reemplaza el sidebar)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🦫 Castor       [Studio] [Feed]                    [Avatar ▼]  │
└─────────────────────────────────────────────────────────────────┘
```

### Elementos del header
- **Logo** (🦫 Castor) — link a /studio (home = studio, no feed)
- **Studio** — tab activo cuando en /studio
- **Feed** — tab activo cuando en /feed
- **🔔 Notificaciones** — solo visible cuando estás en Feed, abre drawer lateral
- **Avatar** — dropdown con:
  - Mi perfil (avatar + nombre)
  - Preview de cuentas gestionadas (@cuenta1 · @cuenta2)
  - "Configuración" → /settings (perfil, tema, preferencias del usuario)
  - "Gestionar cuentas" → /accounts (cuentas Farcaster, signers, miembros, KB)
  - Separador
  - "Cerrar sesión"

### Decisiones clave
- **Sin botón "+ New Cast"** en header — el composer ya es permanente en Studio
- **Notificaciones solo en Feed** — las notificaciones de Farcaster (likes, replies) pertenecen al contexto social, no al scheduling
- **"Configuración" vs "Gestionar cuentas"** — separa "yo como usuario" de "las cuentas FC que gestiono" sin ambigüedad

---

## Vista Studio (la vista principal)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🦫 Castor       [Studio] [Feed]                    [Avatar ▼]  │
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                  │
│  COMPOSER (~45%)             │  [Calendario] [Cola] [Actividad] │
│                              │                                  │
│  [Account ▼]  [Channel ▼]   │  Calendario con drag & drop      │
│                              │  o lista de cola                 │
│  ┌──────────────────────┐   │  o actividad reciente            │
│  │                      │   │                                  │
│  │  Escribe tu cast...  │   │                                  │
│  │                      │   │                                  │
│  └──────────────────────┘   │                                  │
│                              │                                  │
│  [📷 Media] [GIF] [🤖 AI]  │  Próximos casts (bajo calendario)│
│                              │                                  │
│  ────────────────────────   │                                  │
│  Drafts / Templates         │                                  │
│                              │                                  │
│  [Schedule ▼]  [  Cast  ]  │                                  │
│                              │                                  │
├──────────────────────────────┴──────────────────────────────────┤
```

### Panel Izquierdo — Composer (persistente)

El composer deja de ser un modal. Es un panel fijo que siempre está visible en desktop.

**Estructura vertical:**
1. Selectores (Account, Channel) — barra superior compacta
2. Editor de texto — área principal, flex-grow
3. Toolbar (Media, GIF, AI) — debajo del editor
4. Drafts & Templates — sección colapsable
5. Schedule picker + botón de acción — footer fijo

**Comportamiento:**
- Si no hay nada escrito: muestra estado vacío útil (drafts recientes, sugerencias)
- Click en cast del calendario: carga ese cast para editar
- Click en draft: carga el draft
- Threads: scroll vertical dentro del panel
- AI tabs: se expanden inline dentro del composer

### Panel Derecho — Calendario + Contexto

**Tabs ligeros internos:**
- **Calendario** (default) — vista mensual con drag & drop
- **Cola** — lista cronológica de todo lo programado, más detalle que el calendario
- **Actividad** — historial de publicados con métricas básicas (likes, replies, recasts)

**Debajo de los tabs** (en vista Calendario):
- "Próximos" — lista compacta de los 5-10 próximos casts programados
- Click en uno → lo carga en el composer

### Interacciones entre paneles

1. **Click en día del calendario** → rellena automáticamente la fecha en el Schedule picker del composer
2. **Click en cast del calendario** → lo carga en el composer para editar
3. **Click en cast de "Próximos"** → igual, carga en composer
4. **Click en draft** → carga en composer
5. **Drag cast en calendario** → re-agenda (cambia fecha, mantiene hora)
6. **Publicar/programar en composer** → el calendario se actualiza al instante

---

## Vista Feed

```
┌─────────────────────────────────────────────────────────────────┐
│ 🦫 Castor       [Studio] [Feed]            🔔 (3)  [Avatar ▼]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    Feed centrado (max-w-2xl)                    │
│                    Sin cambios respecto a v1                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Layout de una columna centrada
- 🔔 aparece en el header solo aquí
- Click en 🔔 abre drawer de notificaciones (como hoy)
- Sin composer inline — si quieres escribir, vas a Studio

---

## Vistas Settings y Accounts

```
┌─────────────────────────────────────────────────────────────────┐
│ 🦫 Castor       [Studio] [Feed]                    [Avatar ▼]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              Página centrada (max-w-2xl)                        │
│              Sin split view                                     │
│              Layout tipo formulario/settings                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Rutas existentes (/settings, /accounts, /accounts/[id]/*) mantienen su lógica
- Solo cambia el layout wrapper: de sidebar a header

---

## Mobile

La experiencia mobile se mantiene similar a v1:
- Header compacto (logo + avatar)
- Bottom nav (Studio, Feed)
- Composer como full-screen modal (tiene sentido en mobile)
- Calendario como vista dedicada (no split)

No es prioridad rediseñar mobile en esta v2.

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Composer vacío se siente muerto | Estado vacío útil: drafts, sugerencias AI, templates |
| Threads largos en panel de 45% | Scroll vertical + posible "focus mode" expandido |
| Pantallas 1024-1280px apretadas | Calendario celdas compactas, breakpoint mínimo 1024px |
| Muchas cuentas en dropdown avatar | Preview compacto (avatars), "Gestionar cuentas" lleva a página completa |

---

## Estrategia de Coexistencia v1/v2

### Principio
v1 y v2 coexisten en producción. La landing ofrece un selector para que el usuario
elija qué versión usar. v1 no se toca — cero riesgo de regresión.

### Estructura de rutas

```
src/app/
├── (public)/landing/       ← landing con selector [Studio v1] [Studio v2 ✨]
│
├── (app)/                  ← v1 — NO SE TOCA NADA
│   ├── layout.tsx          ← sidebar layout actual (intacto)
│   ├── studio/page.tsx
│   ├── feed/...
│   └── ...
│
├── (v2)/                   ← v2 — NUEVO route group
│   ├── layout.tsx          ← header layout nuevo
│   └── v2/
│       ├── studio/page.tsx ← split view composer + calendario
│       ├── feed/page.tsx   ← feed con header
│       ├── settings/page.tsx
│       └── accounts/...
```

### URLs resultantes

```
castorapp.xyz/              → landing con selector
castorapp.xyz/studio        → v1 (intacto, como hoy)
castorapp.xyz/v2/studio     → v2 (nueva experiencia)
castorapp.xyz/v2/feed       → v2 feed con header
castorapp.xyz/v2/settings   → v2 settings con header
castorapp.xyz/v2/accounts/* → v2 gestión de cuentas
```

### Migración futura
Cuando v2 esté validada:
1. v2 se mueve a las rutas principales (/studio, /feed, etc.)
2. v1 se elimina
3. El selector de la landing desaparece

---

## Archivos Principales

### Nuevos (todo bajo v2, sin tocar v1)
- `src/app/(v2)/layout.tsx` — layout con header horizontal (auth check)
- `src/app/(v2)/v2/studio/page.tsx` — server component, data fetching, split view
- `src/app/(v2)/v2/feed/page.tsx` — feed con header layout
- `src/app/(v2)/v2/settings/page.tsx` — settings con header layout
- `src/app/(v2)/v2/accounts/page.tsx` — gestión de cuentas
- `src/components/v2/AppHeader.tsx` — header horizontal
- `src/components/v2/UserDropdown.tsx` — dropdown del avatar
- `src/components/v2/StudioLayout.tsx` — split view composer + calendario
- `src/components/v2/ComposerPanel.tsx` — composer como panel persistente
- `src/components/v2/CalendarPanel.tsx` — panel derecho con tabs

### Modificar (mínimo)
- `src/app/(public)/landing/page.tsx` — agregar selector v1/v2

### Reutilizar de v1 (importar directamente, no copiar)
- `src/components/compose/ComposeCard.tsx` — el composer interno
- `src/components/compose/ComposeFooter.tsx` — toolbar y acciones
- `src/components/compose/AITabs.tsx` — features de AI
- `src/components/calendar/CalendarView.tsx` — calendario con drag & drop
- `src/hooks/*` — todos los hooks (useAccounts, useTemplates, etc.)
- `src/lib/*` — toda la lógica de negocio
- `src/components/ui/*` — componentes shadcn/ui
- `src/app/api/*` — toda la API (misma para v1 y v2)

### NO TOCAR
- `src/app/(app)/**` — v1 completa intacta
- `src/app/api/**` — API compartida
- `src/lib/db/**` — sin cambios de schema
- Base de datos — sin migraciones

---

## Orden de Implementación

### Fase 1 — Esqueleto navegable
1. **Landing selector** — agregar botones v1/v2 a la landing existente
2. **Route group (v2)** — crear estructura de carpetas + layout.tsx con auth
3. **AppHeader** — header horizontal con tabs Studio/Feed + avatar dropdown
4. **Studio page stub** — página que renderiza split view vacío (dos paneles)

### Fase 2 — Composer panel
5. **ComposerPanel** — extraer lógica de ComposeModal a panel persistente
6. **Reutilizar ComposeCard** — adaptar wrapper sin modificar el componente original
7. **Drafts & Templates** — sección colapsable debajo del composer

### Fase 3 — Calendario panel
8. **CalendarPanel** — wrapper con tabs (Calendario / Cola / Actividad)
9. **Reutilizar CalendarView** — integrar en el panel sin modificar original
10. **Cola** — lista cronológica de casts programados
11. **Actividad** — historial de publicados con métricas

### Fase 4 — Interacciones entre paneles
12. **Click día → fecha** — calendario comunica fecha al composer
13. **Click cast → editar** — calendario/cola carga cast en composer
14. **Publicar → refresh** — composer notifica al calendario que actualice

### Fase 5 — Vistas secundarias
15. **Feed** — adaptar a layout con header
16. **Settings/Accounts** — adaptar a layout centrado con header

### Fase 6 — Polish
17. **Estados vacíos** — composer vacío, calendario vacío
18. **Mobile** — ajustes mínimos para que funcione con header
19. **Animaciones** — transiciones suaves entre estados
20. **Edge cases** — threads largos, muchas cuentas, pantallas pequeñas
