# Studio Ops Hub (RFC)

Status: Draft

Owner: TBD (Product)

Created: 2025-12-19

Related areas:
- `src/app/(app)/studio/page.tsx`
- `src/app/(app)/studio/UnifiedDashboard.tsx`
- `src/app/api/casts/[id]/route.ts`
- `src/lib/publisher.ts`
- `src/lib/db/schema.ts` (`scheduled_casts`, `accounts`)

---

## Resumen (ES)

Vamos a convertir `/studio` en un **hub operativo** pensado para agencias/gestores, añadiendo un tab **Needs attention** (default) que agrupa incidencias **por cuenta** y permite resolverlas sin salir (Retry/Edit/Reschedule/Cancel). Mantendremos la vista actual (calendario + lista) como **Queue**, y el histórico de publicados como **Activity**.

El MVP **reusa** los datos ya cargados en `/studio/page.tsx` y los endpoints existentes (`PATCH/DELETE /api/casts/:id`). No se crean endpoints nuevos en el MVP.

---

## 1) Problema

En el modelo de Castor (agencia/gestor), la pregunta natural no es “¿qué está programado?”, sino:

- “¿Qué le pasa a `@marca1`?”

Hoy `/studio` permite ver scheduled/published, pero no ofrece:

- Un triage claro por cuenta.
- Un ranking de severidad (urgent primero).
- Acciones inline para resolver problemas con mínima navegación.

---

## 2) Objetivos (MVP)

- `/studio` con tabs:
  - `Needs attention` (default)
  - `Queue`
  - `Activity`
- `Needs attention` agrupado **por cuenta**.
- Dentro de cada cuenta: urgentes primero, warnings después.
- Acciones inline por cast:
  - **Retry** (requeue now)
  - **Edit** (abre `ComposeModal` existente)
  - **Reschedule**
  - **Cancel** (delete)
- Reutilizar el query existente del server component `src/app/(app)/studio/page.tsx`.

---

## 3) No objetivos (MVP)

- No implementar “Revisar todo / Mark as reviewed”.
- No construir un Activity feed enriquecido (más allá de published list actual).
- No incluir warnings de BrandVoice en Studio (requiere join de knowledge base en query; se deja para fase 2).
- No cambiar permisos de edición/borrado (se documenta como riesgo/mejora futura).

---

## 4) Modelo de datos y estados relevantes

### 4.1 `scheduled_casts`
En `src/lib/db/schema.ts`:

- `scheduled_casts.status` enum:
  - `draft`
  - `scheduled`
  - `publishing`
  - `published`
  - `failed`
  - `retrying`

Campos críticos para operaciones:
- `scheduledAt`
- `updatedAt`
- `errorMessage`
- `retryCount`
- `threadId`, `threadOrder` (threads)

### 4.2 `accounts`
- `accounts.signerStatus`: `pending | approved | revoked`
- `accounts.type`: `personal | business`

---

## 5) Reglas de “Needs attention”

### 5.1 Urgent
- **Due casts**:
  - `status in ('scheduled','retrying')` AND `scheduledAt <= now`
- **Failed casts**:
  - `status === 'failed'`
- (Opcional fase 1.5) **Stuck publishing**:
  - `status === 'publishing'` AND `updatedAt` muy antiguo.
  - Nota: el umbral existe en `publisher.ts` (`STUCK_PUBLISHING_THRESHOLD_MS`).

### 5.2 Warning
- **Signer KO**:
  - `account.signerStatus !== 'approved'`
  - y la cuenta tiene casts en cola (p.ej. `scheduled/retrying/failed/due`).

### 5.3 Orden
Dentro de cada cuenta:
1) Due (más vencidos primero)
2) Failed (más recientes primero)
3) Signer KO warning

### 5.4 Business-only por defecto (MVP)
Para evitar ruido, `Needs attention` filtra por defecto a cuentas `type === 'business'`.

---

## 6) UX Spec

### 6.1 Tabs mapping

| Tab actual (hoy) | Tab nuevo | Notas |
|---|---|---|
| `Scheduled` | `Queue` | Mantener calendario + lista |
| `Published` | `Activity` | Mantener lista de publicados |
| *(nuevo)* | `Needs attention` | Default |

### 6.2 Summary
- Summary completo (`Urgent: X | Warnings: Y`) vive **dentro** de `Needs attention`.
- En la cabecera de tabs, `Needs attention` muestra un badge con conteo (para señal sin cambiar layout global).

### 6.3 Account cards
Cada card:
- avatar + `@username`
- badges: `Signer OK/KO`, `Due n`, `Failed n`
- quick actions:
  - `Open` → (futuro) `/accounts/:id/studio` o usar filtro actual por `selectedAccountId`.
  - `Fix signer` → flujo existente de signer.

### 6.4 Cast rows
Cada cast row urgent:
- hora programada
- extracto del contenido
- estado (`due`/`failed`)
- acciones inline:
  - Retry
  - Edit
  - Reschedule
  - Cancel

---

## 7) Contratos técnicos (endpoints reusados)

### 7.1 Retry MVP
No existe un endpoint `retry` dedicado. Se hace con `PATCH /api/casts/:id`:

- Payload:
  - `{ scheduledAt: nowISO }`

Garantía clave:
- En `src/app/api/casts/[id]/route.ts`, si el cast estaba en `failed` o `retrying`, al hacer PATCH el backend resetea:
  - `status -> scheduled`
  - `errorMessage -> null`
  - `retryCount -> 0`

Esto evita “bugs silenciosos” donde el publisher ignore casts por estado/error previo.

### 7.2 Reschedule
- `PATCH /api/casts/:id` con `{ scheduledAt: iso }`

### 7.3 Cancel
- `DELETE /api/casts/:id`

### 7.4 Edit
- Reutilizar `ComposeModal` existente (ya soporta edición en Studio).

---

## 8) Permisos y seguridad

Hoy, `PATCH/DELETE /api/casts/:id` validan acceso via `canAccess` (owner o miembro). Esto implica que miembros pueden modificar (MVP).

Riesgo / mejora (fase 2):
- Introducir `canModify`/role checks para acciones destructivas (cancel) o publicación.

---

## 9) Plan de implementación (sin refactor masivo)

### 9.1 Frontend
- `src/app/(app)/studio/UnifiedDashboard.tsx`
  - Renombrar tabs a `Needs attention | Queue | Activity`
  - Mantener Queue/Activity como mapping de `scheduled/published` existente
  - Añadir `NeedsAttentionTab`
  - Añadir handler `handleRetryCast` (PATCH scheduledAt=now)
  - Badge count en tab `Needs attention`

- Nuevo archivo:
  - `src/app/(app)/studio/NeedsAttentionTab.tsx`
  - Responsabilidad: agrupar por cuenta, computar urgent/warning, render UI.

### 9.2 Backend
- MVP: no cambios.

### 9.3 Data
- MVP: no cambios.

---

## 10) QA

Manual:
- Cuenta business con cast vencido → aparece en urgent con acciones.
- Retry → reprograma a now y el cast deja de estar failed (tras refresh).
- Cuenta con signer KO y casts → warning + CTA Fix signer.
- Queue y Activity siguen funcionando como antes.

Unit tests (recomendado):
- Testear la función pura de grouping/rules (sin React).

---

## 11) Rollout

MVP sin feature flag (opcional). Si se introduce flag, el tab podría aparecer solo para roles admin/pro inicialmente.

---

## 12) Riesgos

- Diferencias de timezone en cálculo de `due` (usar ISO consistently).
- Permisos demasiado amplios para miembros.
- False positives si incluimos `publishing stuck` sin un threshold claro.

---

## 13) Open Questions / Decisions (accounts.type: personal vs business)

### 13.1 Decisión pendiente

En el modelo de monetización/uso de Castor:

- La cuenta **personal** (login) **no se comparte**.
- Las cuentas **business** **sí se pueden compartir** (colaboración/roles).

Sin embargo, en el flujo actual de conexión de cuentas, el backend puede crear cuentas con un `type` por defecto.

### 13.2 Estado actual (code reality)

- `accounts.type` existe en DB: `personal | business`.
- El endpoint `POST /api/accounts/check-signer` crea cuentas nuevas con `type: 'personal'` por defecto.

Esto es un mismatch con el silver path “connect business account” y también afecta a:

- Filtrado business-only en `Needs attention` (MVP).
- Qué cuentas aparecen como “gestionables/compartibles”.

### 13.3 Opciones

**Opción A (recomendada):**

- En `ConnectAccountModal`, el usuario elige el tipo: `Personal` vs `Business`.
- El frontend envía ese `type` al backend.
- `check-signer` persiste el `type` seleccionado al crear/actualizar la cuenta.

Pros:
- Explícito.
- Alineado con monetización y mental model.

Cons:
- Añade un paso/decisión en UI.

**Opción B (heurística automática):**

- Si `fid === session.fid` → `personal`.
- Si `fid !== session.fid` → `business`.

Pros:
- UX más simple.

Cons:
- Puede fallar en casos edge (p.ej. si el usuario quiere conectar un segundo FID “personal” pero no compartible, o si cambia su login FID).

**Opción C (post-fix):**

- Mantener conexión como hoy.
- Añadir acción posterior “Convert to business” en `/accounts` (solo owner/admin) antes de permitir sharing.

Pros:
- No bloquea conexión.

Cons:
- Más fricción; riesgo de cuentas mal tipadas.

### 13.4 Reglas/invariantes a documentar (independientemente de la opción)

- Sharing UI (team/members) solo debería existir para `type === 'business'`.
- En `/studio` (Ops Hub), `Needs attention` filtra por defecto a `business`.
- Operaciones de publish/schedule/edit/cancel siempre deben ser **account-scoped** (ya lo son), pero el UI multi-cuenta debe mostrar siempre la cuenta.

### 13.5 Impacto en MVP

Para poder cumplir “business-only por defecto” de forma consistente, necesitamos decidir y corregir el origen de verdad de `accounts.type`.
