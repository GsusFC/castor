# AI Brand Mode (Brand Context Global) — Visión y Diseño (v1)

## Objetivo
Habilitar que **todas las features de IA generativa** de Castor produzcan outputs consistentes con la **voz de marca** de una cuenta (brand voice) y sus reglas, sin exponer prompts editables a usuarios finales.

## Principios
- El contexto de marca se gestiona **a nivel de cuenta** (account-level), orientado a equipos/marcas.
- No se permite edición directa de prompts (“prompts editables”): el control se hace mediante **datos estructurados**.
- El sistema debe ser consistente: cualquier “surface” de IA generativa debe operar con un `accountId` y su contexto.
- Separación clara entre:
  - Traducción literal “gratis” (no IA, no brand voice)
  - “Translate con voz” (IA generativa, brand-aware)

## Definiciones
- **Brand Context (Knowledge Base):** datos estructurados persistidos en `account_knowledge_base`.
- **BrandVoice:** un texto breve que describe cómo escribe la marca (tono, estilo, vocabulario, formato). Campo `brandVoice`.
- **AI Brand Mode:** estado “ON/OFF” que indica si se debe aplicar contexto de marca a la IA generativa.
- **IA generativa:** modelos que producen texto nuevo (write, improve, reply, insights/chat, translate con voz).

## Alcance
### Incluye (IA generativa, brand-aware)
- Asistente IA:
  - `write`
  - `improve`
  - `translate` ("traducir con voz" / localización)
- AI Replies (sugerencias de respuesta)
- Analytics: insights/chat y cualquier recomendación generada

### Excluye
- **Translate literal del cast** (feature “gratis” que ya funciona):
  - No aplica brand voice.
  - Debe permanecer literal (sin reescritura estilística).

## Fuente de verdad de contexto
### Persistencia (DB)
- `account_knowledge_base` (ejemplos relevantes):
  - `brandVoice`
  - `bio`
  - `expertise` (array)
  - `alwaysDo` (array)
  - `neverDo` (array)
  - `hashtags` (array)
  - `defaultTone`
  - `defaultLanguage`
  - `internalNotes` (uso interno)
- `account_documents`:
  - Documentos adjuntos (brand guidelines, claims, FAQs, etc.)

### UI
- Página de edición: `/accounts/[id]/context` (ContextEditor)

## Activación de AI Brand Mode (gating)
### Regla de activación (v1)
- **AI Brand Mode = ON** si `brandVoice` existe y no está vacío.
- **AI Brand Mode = OFF** en caso contrario.

`neverDo` NO es obligatorio para activar (se considera “recomendado”).

## Onboarding propuesto
### Objetivo
Reducir fricción: que el usuario pueda activar Brand Mode en minutos.

### CTA
En cada surface de IA generativa (Studio/AITabs, AI Reply, Analytics):
- Si Brand Mode está OFF:
  - Mostrar banner/notice: “Activa AI Brand Mode completando tu Brand Voice.”
  - CTA: “Completar contexto” → `/accounts/[id]/context` (cuenta activa)

### Estados UX
- **OFF:** no hay `brandVoice`.
- **ON:** `brandVoice` presente.
- **(Opcional) INCOMPLETE:** KB existe pero `brandVoice` vacío; mismo CTA.

## “Translate con voz” (AIAssistant translate)
### Intención
No es traducción literal; es **localización brand-aware**:
- Mantener significado.
- Ajustar tono/registro a `brandVoice`.
- Respetar reglas (`alwaysDo/neverDo`) si existen.

### Reglas
- Output: solo la versión final (sin explicaciones).
- No inventar facts.
- Si el texto contiene claims sensibles: mantenerse conservador.

## Generación automática (asistida) del contexto
### BrandVoice a partir de casts (Neynar + análisis IA)
BrandVoice puede generarse automáticamente a partir del historial de la cuenta.

#### ¿Cuántos casts analizar para un BrandVoice “respetable”?
Recomendación práctica:
- **80–150 casts**: mejor balance calidad/coste (recomendado).
- **30–60 casts**: onboarding rápido (más sesgo).
- **200–400 casts**: cuentas con múltiples temáticas o estilo editorial.
- **800–1000 casts**: rendimientos decrecientes para BrandVoice puro (útil si además extraes reglas y ejemplos).

#### Muestreo recomendado
- Ventana temporal: **3–6 meses** (marca actual).
- Filtrado:
  - priorizar casts originales (texto propio)
  - excluir posts vacíos/solo links
  - dedupe de plantillas repetidas
  - incluir una fracción de replies si quieres reflejar estilo conversacional

### `neverDo` auto-sugerido (confirmable)
`neverDo` puede sugerirse automáticamente y requerir **confirmación explícita** del usuario.

UX sugerido en `/accounts/[id]/context`:
- Bloque: “Sugerir reglas (never do) automáticamente”
- Acción: “Generar sugerencias”
- UI: checklist + “Aplicar seleccionadas”

## Consistencia técnica (diseño)
### Regla de oro
Toda llamada de IA generativa debe ejecutarse:
- con un `accountId` (cuenta activa)
- cargando `AccountContext` desde esa cuenta

### Consideraciones
- Centralizar la construcción de contexto (system context) en una función única (p.ej. `buildSystemContext(...)`).
- Reutilizar el mismo contrato de datos entre assistant/replies/analytics.

## Implementación (checklist)
Esta sección describe **qué tocar en el código** para llevar esta visión a producción. No es un refactor masivo: es un set de cambios pequeños pero consistentes.

### Plan por PRs (ejecución recomendada)
Este plan traduce las fases a PRs pequeños, revisables y fáciles de revertir.

#### PR1 — Brand Mode gating + CTA (solo UI)
- **Objetivo**: que el usuario entienda y pueda activar Brand Mode.
- **Scope**:
  - Banner/notice cuando Brand Mode está OFF.
  - CTA a `/accounts/[id]/context` con la cuenta activa.
- **Archivos**:
  - `src/components/compose/AITabs.tsx`
  - (si aplica) `src/components/feed/AIReplyDialog.tsx`
- **Criterio de aceptación**:
  - Si `brandVoice` está vacío, se ve el CTA.
  - Si `brandVoice` existe, el CTA no aparece.

#### PR2 — Propagar `accountId` a IA generativa (assistant + replies)
- **Objetivo**: asegurar consistencia de contexto.
- **Scope**:
  - Requests a `/api/ai/assistant` incluyen `accountId` desde la cuenta activa.
  - AI replies también pasan `accountId`.
- **Archivos**:
  - `src/components/ai/AIAssistant.tsx`
  - `src/components/compose/AITabs.tsx`
  - `src/components/feed/AIReplyDialog.tsx`
- **Criterio de aceptación**:
  - Con cuentas distintas, la IA refleja contextos distintos.

#### PR3 — Hardening multi-tenant en `/api/ai/assistant`
- **Objetivo**: impedir fuga cross-account por `accountId`.
- **Scope**:
  - Verificar permisos antes de cargar `AccountContext`.
  - Responder 403 si el usuario no pertenece a la cuenta.
- **Archivos**:
  - `src/app/api/ai/assistant/route.ts`
- **Criterio de aceptación**:
  - Intento de `accountId` ajeno devuelve 403.

#### PR4 — Traducciones: literal vs “con voz” (claridad y no-regresión)
- **Objetivo**: que no se mezcle la traducción literal gratis con la IA.
- **Scope**:
  - Confirmar que `/api/ai/translate` permanece literal y sin `accountId`.
  - Ajustar labels/copy del AIAssistant para que `translate` se entienda como “con voz”.
- **Archivos**:
  - `src/app/api/ai/translate/route.ts`
  - `src/components/feed/CastCard.tsx`
  - `src/components/ai/AIAssistant.tsx`
- **Criterio de aceptación**:
  - Translate del cast funciona igual que antes.
  - Translate del asistente aplica BrandVoice (cuando existe).

#### PR5 — Generar BrandVoice desde casts (80–150) y prefill editable
- **Objetivo**: activar Brand Mode sin que el usuario escriba desde cero.
- **Scope**:
  - Endpoint/acción que genere `brandVoice` con casts (Neynar + IA).
  - Guardado en `account_knowledge_base.brand_voice`.
  - UI para “Generar BrandVoice” (con confirmación/edición).
- **Archivos (orientativo)**:
  - `src/app/(app)/accounts/[id]/context/ContextEditor.tsx`
  - (nuevo o reusado) endpoint API para generación
- **Criterio de aceptación**:
  - Un click genera un borrador de BrandVoice y el usuario puede editar y guardar.

#### PR6 — `neverDo` auto-sugerido (confirmable)
- **Objetivo**: elevar brand safety sin fricción.
- **Scope**:
  - Generación de sugerencias + checklist “Aplicar seleccionadas”.
- **Archivos (orientativo)**:
  - `src/app/(app)/accounts/[id]/context/ContextEditor.tsx`
  - endpoint/acción de sugerencias
- **Criterio de aceptación**:
  - No se aplican reglas sin confirmación explícita.

#### PR7 — (Opcional) Documentos (`account_documents`) para mayor fidelidad
- **Objetivo**: llevar Brand Mode a nivel “marca real” (guidelines/claims/FAQs).
- **Scope**:
  - Empezar con resumen (sin RAG), o diseñar retrieval.
- **Criterio de aceptación**:
  - La IA refleja guidelines documentales de forma medible.

### Fase 1 — Gating + CTA “Completa el contexto”
- Definir un criterio único:
  - AI Brand Mode **ON** si `brandVoice` no está vacío.
  - AI Brand Mode **OFF** en caso contrario.
- Implementar un componente/UI de aviso reutilizable (banner/notice) que:
  - explique el valor ("escribe/traduce con tu voz")
  - linkee a `/accounts/[id]/context` usando la cuenta activa

Archivos a revisar/tocar:
- `src/context/SelectedAccountContext.tsx`
  - Fuente de verdad de la cuenta activa (`accountId`) para las surfaces.
- `src/components/compose/AITabs.tsx`
  - Mostrar el banner cuando Brand Mode esté OFF.
  - Asegurar que las acciones de IA usan la cuenta activa.
- `src/components/ai/AIAssistant.tsx`
  - Ajustar copy/labels si hace falta para diferenciar:
    - translate literal (no aquí)
    - `translate` del asistente = “traducir con voz”.

### Fase 2 — Propagación consistente de `accountId` (todas las surfaces de IA generativa)
Objetivo: que **assistant, replies y analytics** llamen a la IA generativa con `accountId`.

Archivos típicos:
- Composer/assistant:
  - `src/components/ai/AIAssistant.tsx`
  - `src/components/compose/AITabs.tsx`
- Replies:
  - `src/components/feed/AIReplyDialog.tsx`
- Analytics:
  - Componentes/rutas dentro de `src/app/(app)/analytics/` que generen texto con IA

Checklist:
- Asegurar que cada request a endpoints de IA generativa incluye `accountId`.
- Si el usuario está en “All accounts”, definir comportamiento:
  - bloquear con UI (pedir selección), o
  - elegir una cuenta por defecto explícita.

### Fase 3 — Hardening multi-tenant (autorización)
Objetivo: evitar que un usuario pueda pasar un `accountId` que no le pertenece y leer/aplicar Brand Context de otra cuenta.

Archivos a revisar/tocar:
- `src/app/api/ai/assistant/route.ts`
  - Verificar permisos antes de cargar `AccountContext` por `accountId`.
- `src/app/api/accounts/[id]/context/route.ts`
  - Reusar el mismo enfoque de authz (ya existe) como referencia.

Checklist:
- Si `accountId` viene en request:
  - validar que el usuario actual pertenece a esa cuenta (owner/member).
  - si no, devolver 403.

### Fase 4 — Diferenciar traducciones (literal vs con voz)
Reglas de implementación:
- **Translate literal del cast**:
  - No debe depender de `accountId`.
  - No debe aplicar `brandVoice`.
- **Translate del AIAssistant (“con voz”)**:
  - Debe aplicar `brandVoice` (y `alwaysDo/neverDo` si existen).

Archivos a revisar/tocar:
- Translate literal:
  - `src/app/api/ai/translate/route.ts`
  - `src/components/feed/CastCard.tsx`
- Translate con voz (assistant):
  - `src/lib/ai/castor-ai.ts`
  - `src/app/api/ai/assistant/route.ts`

### Fase 5 — Generación asistida de BrandVoice y `neverDo`
Objetivo: acelerar onboarding con generación desde casts (Neynar) + confirmación del usuario.

Recomendaciones:
- BrandVoice:
  - generar con **80–150 casts** (3–6 meses), filtrando ruido.
  - escribir el resultado en `account_knowledge_base.brand_voice` (confirmable/edición humana).
- `neverDo`:
  - generar sugerencias y exigir confirmación (checklist + aplicar).

Archivos a revisar/tocar:
- UI:
  - `src/app/(app)/accounts/[id]/context/ContextEditor.tsx`
- API/servicios:
  - Reusar el flujo existente que ya consume Neynar para análisis de casts (p.ej. style-profile) o crear un endpoint dedicado para sugerencias.

### Fase 6 — Tests mínimos (para no romper multi-tenant)
Archivos a revisar/tocar:
- Tests del assistant:
  - `src/lib/ai/castor-ai.test.ts`
  - `src/app/api/ai/assistant/route.test.ts` (si existe en el repo)

Checklist:
- Test: Brand Mode ON cuando `brandVoice` está presente.
- Test: 403 si un usuario intenta usar `accountId` ajeno.
- Test: “translate literal” no depende de contexto.

## Seguridad / multi-tenant
- Cualquier endpoint que acepte `accountId` debe verificar que el usuario autenticado tiene permisos sobre esa cuenta.
- `internalNotes` debe tratarse como información interna (evitar filtrado accidental).

## Métricas de producto (para validar el impacto)
- % usuarios que activan Brand Mode (brandVoice completado)
- Tiempo hasta activación
- % usuarios que aceptan sugerencias de `neverDo`
- Satisfacción: regeneraciones vs aceptación de outputs
- Tasa de edición manual tras generación (proxy de calidad)

## Roadmap sugerido
- **Fase 1:** gating (solo `brandVoice`) + banners/CTAs en surfaces IA generativa.
- **Fase 2:** generación de `brandVoice` desde 80–150 casts (Neynar + IA) y prefill editable.
- **Fase 3:** auto-sugerencia de `neverDo` con confirmación.
- **Fase 4:** uso de `account_documents` (resumen o retrieval) para elevar fidelidad de marca.

## Preguntas abiertas
- ¿Qué ocurre si el usuario tiene “All accounts” seleccionadas? (requerir selección de cuenta para IA generativa, o elegir default)
- ¿Cómo versionar/regenerar BrandVoice cuando la marca cambia (rebrand)?
