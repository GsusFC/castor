# Codebase Improvement Opportunities

Found while studying the v1 codebase for the v2 redesign. These are independent of the v2 work and could be applied to v1 too.

---

## High Priority

### 1. Hard-coded timezone `Europe/Madrid`
**Where**: `useScheduleForm.ts`, `CalendarView.tsx`, `toMadridISO` util
**Problem**: Every date operation assumes Madrid timezone. Users in other timezones will see wrong times.
**Fix**: Store user timezone preference (in DB or localStorage), use it in all date operations. Use `Intl.DateTimeFormat().resolvedOptions().timeZone` as default.

### 2. ComposeFooter video polling runs indefinitely
**Where**: `ComposeFooter.tsx` — `useEffect` with `setInterval`
**Problem**: The 3-second polling for video status never stops, even after the modal closes. Memory leak + unnecessary API calls.
**Fix**: Clear interval on unmount AND when all videos are in "ready" state.

### 3. ComposeCard has 20+ props
**Where**: `ComposeCard.tsx`
**Problem**: Massive props interface makes the component hard to use and refactor. Classic "prop drilling" smell.
**Fix**: Group related props into a config object, or use React Context within the composer tree. The v2 ComposerPanel is a chance to fix this.

### 4. No error boundaries
**Where**: Entire app
**Problem**: Any component error crashes the whole page. No graceful degradation.
**Fix**: Add error boundaries around: composer, calendar, feed, each panel in studio.

### 5. No pagination for casts
**Where**: `studio/page.tsx` server component
**Problem**: Fetches ALL casts for ALL accounts at once. As users schedule more, this grows unbounded.
**Fix**: Paginate with cursor-based pagination. Fetch only current month + upcoming for calendar, lazy-load history.

---

## Medium Priority

### 6. Seven nested providers
**Where**: `(app)/layout.tsx`
**Problem**: 7 levels of provider nesting. Each re-render potentially cascades. Hard to read.
**Fix**: Create a `ProviderComposer` utility that flattens the tree:
```tsx
<ProviderComposer providers={[AuthProvider, QueryProvider, ...]}>
  {children}
</ProviderComposer>
```

### 7. SelectedAccountContext makes 2 API calls on mount
**Where**: `SelectedAccountContext.tsx`
**Problem**: Calls `/api/me` + `/api/accounts` on every mount to find user's default account. This data is already available from the server component.
**Fix**: Pass `defaultAccountId` from the server component (already fetched there) and skip the API calls.

### 8. `canModify` is identical to `canAccess`
**Where**: `lib/auth/index.ts`
**Problem**: Both functions have the exact same logic. Misleading — suggests different permission levels that don't exist.
**Fix**: Either differentiate them (members can access but not modify?) or remove `canModify` and use `canAccess` everywhere.

### 9. Silent error swallowing
**Where**: Multiple hooks — `.catch(() => {})`
**Problem**: `syncProStatus.catch(() => {})`, `refreshSession.catch(() => {})`, etc. Failures are invisible.
**Fix**: At minimum log errors. Better: add a global error reporter (Sentry or similar).

### 10. `Math.random()` for IDs
**Where**: `useCastThread.ts` — `createEmptyCast`
**Problem**: Uses `Math.random().toString(36)` for cast IDs. Not collision-safe.
**Fix**: Already using `nanoid` elsewhere in the codebase. Use it consistently.

---

## Low Priority (Quality of Life)

### 11. Mixed language comments
**Where**: Throughout codebase
**Problem**: Spanish comments (`Obtener cuentas del usuario`) mixed with English code and English UI text. Confusing for contributors.
**Fix**: Standardize to English comments.

### 12. Duplicate type definitions
**Where**: `ComposeCard.tsx` has its own `Template` interface, `UnifiedDashboard.tsx` has its own `Cast`/`Account` interfaces
**Problem**: Same types defined in multiple places. Changes require updating all copies.
**Fix**: Create a shared `src/types/` directory with canonical types. Or infer from Drizzle schema + serialize.

### 13. Hardcoded emoji picker
**Where**: `ComposeFooter.tsx` — 40 emojis inline
**Problem**: Not extensible, takes up code space.
**Fix**: Move to a config file or use a proper emoji picker library.

### 14. Spanish locale hardcoded
**Where**: `ComposeCard.tsx` — `'es-ES'` in `getScheduleLabel()`
**Problem**: Schedule label shows dates in Spanish regardless of user preference.
**Fix**: Use browser locale or user preference.

### 15. No React Query DevTools in development
**Where**: `QueryProvider.tsx`
**Problem**: Debugging server state issues is harder without devtools.
**Fix**: Add `ReactQueryDevtools` conditionally in development.

---

## Architecture Suggestions for v2

### A. Shared types between server and client
Create `src/types/serialized.ts` with the exact shape of data after serialization. Both the server page and client component import from the same place. No more duplicate interfaces.

### B. Composer state machine
The composer has complex state transitions (empty → writing → scheduling → submitting → done). A state machine (XState or useReducer) would make these transitions explicit and prevent impossible states.

### C. Calendar-Composer communication via URL params
Instead of prop drilling or context, use URL search params for the composer state:
- `?date=2026-01-15` — pre-fill schedule date
- `?edit=cast_id` — load cast for editing
- `?draft=draft_id` — load draft
This makes deep-linking work and is easier to reason about.

### D. Optimistic updates for calendar drag
Currently `onMoveCast` fires an API call and hopes it works. Use React Query's optimistic update pattern to immediately move the cast in the UI and roll back on error.
