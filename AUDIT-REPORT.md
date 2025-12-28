# 🔍 CASTOR CODEBASE AUDIT REPORT
**Date**: 2025-12-28
**Total Files Analyzed**: 245 TypeScript/TSX files
**Test Coverage**: ~7.7% (19 test files)

---

## 🔴 CRITICAL (Fix Before Next Release)

### 1. No Error Boundaries - App Can Crash Completely
**Files Affected**: All client components (entire app)
**Current Behavior**: Any uncaught error in a component tree will crash the entire application
**Proposed Solution**:
- Add root-level error boundary in `app/layout.tsx`
- Add error boundaries around major features (feed, compose, profile)
- Create `components/error/ErrorBoundary.tsx` with user-friendly fallback UI
**Impact**: HIGH - Prevents complete app crashes, improves UX
**Effort**: LOW - 2-3 hours to implement

### 2. CastCard Component is 1661 Lines - Doing Too Much
**Files Affected**: `components/feed/CastCard.tsx`
**Current Behavior**:
- 18 useState hooks in one component
- Handles: likes, recasts, replies, translation, GIF picker, AI replies, image carousel, moderation, sharing, deletion
- Difficult to maintain, test, and optimize
**Proposed Solution**: Split into:
- `CastCard.tsx` (main layout, ~300 lines)
- `CastActions.tsx` (like/recast/reply buttons)
- `CastReplyThread.tsx` (reply functionality)
- `CastImageGallery.tsx` (image carousel)
- `CastModeration.tsx` (mute/block actions)
- `useCastInteractions.ts` hook (like/recast state)
**Impact**: HIGH - Improves performance, testability, maintainability
**Effort**: HIGH - 2-3 days of refactoring

### 3. RightSidebar Doesn't Use React Query - Data Fetching Inconsistency
**Files Affected**: `components/feed/RightSidebar.tsx`
**Current Behavior**:
- Uses raw fetch in useEffect
- No caching, no retry logic, no background refresh
- Duplicates data that FeedPage already fetches (trending casts)
**Proposed Solution**:
- Convert to useQuery with proper cache keys
- Share trending data with FeedPage via prefetching
- Add proper error handling and loading states
**Impact**: HIGH - Performance, consistency, UX
**Effort**: LOW - 1-2 hours

### 4. Missing Optimistic Updates for Interactions
**Files Affected**: `components/feed/CastCard.tsx`, `components/profile/ProfileView.tsx`
**Current Behavior**: Like/recast buttons have visible lag before UI updates
**Proposed Solution**: Use React Query mutations with optimistic updates
```typescript
const likeMutation = useMutation({
  mutationFn: (castHash) => fetch(`/api/feed/reaction`, ...),
  onMutate: async (castHash) => {
    // Optimistically update UI
    await queryClient.cancelQueries(['feed'])
    const previous = queryClient.getQueryData(['feed'])
    queryClient.setQueryData(['feed'], (old) => updateLikeCount(old, castHash))
    return { previous }
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['feed'], context.previous)
  }
})
```
**Impact**: HIGH - Much better UX, feels instant
**Effort**: MEDIUM - 4-6 hours

---

## 🟡 IMPORTANT (Fix Soon)

### 5. Zero React.memo Usage - Unnecessary Re-renders
**Files Affected**: All components, especially:
- `CastCard.tsx` (re-renders for every feed update)
- `NotificationCard.tsx`
- `ChannelHeader.tsx`
- `UserPopover.tsx`
**Current Behavior**: Components re-render even when props haven't changed
**Proposed Solution**:
- Wrap expensive components in React.memo
- Add proper prop equality checks
- Memoize callback props with useCallback
**Impact**: MEDIUM - Better performance, especially on mobile
**Effort**: MEDIUM - 1 day to identify and wrap key components

### 6. UnifiedDashboard is 1137 Lines - Needs Splitting
**Files Affected**: `app/(app)/studio/UnifiedDashboard.tsx`
**Current Behavior**: Single component handles:
- Account selection
- Cast list/calendar views
- Draft management
- Template list
- Issue warnings
**Proposed Solution**: Split into:
- `StudioLayout.tsx` (main structure)
- `StudioHeader.tsx` (view toggle, account selector)
- `CastCalendar.tsx` (calendar view)
- `CastList.tsx` (list view)
- `StudioSidebar.tsx` (drafts, templates)
- `CastIssueWarnings.tsx` (warnings panel)
**Impact**: MEDIUM - Better maintainability, code reuse
**Effort**: MEDIUM - 1-2 days

### 7. Type Safety Issues - 67 Uses of `any`
**Files Affected**: 38 files (see details below)
**Most Critical**:
- `api/feed/route.ts` (3 occurrences in data processing)
- `api/webhooks/neynar/route.ts` (6 occurrences)
- `api/search/route.ts` (6 occurrences)
- `components/feed/ConversationView.tsx` (2 occurrences)
**Proposed Solution**:
- Create proper TypeScript interfaces for Neynar API responses
- Add type guards for runtime validation
- Replace `as any` with proper type assertions or refactoring
**Impact**: MEDIUM - Prevents runtime errors, better DX
**Effort**: MEDIUM - 2-3 days across all files

### 8. Inconsistent React Query Cache Configuration
**Files Affected**: Multiple components
**Current Behavior**:
- Default: 60s staleTime
- Feed: 30s staleTime
- Analytics: 1 hour staleTime
- LinkRenderer: 1 hour staleTime
- No clear strategy or documentation
**Proposed Solution**:
- Document cache strategy by data type
- Create query key factories with standardized options
```typescript
// lib/query-keys.ts
export const feedKeys = {
  all: ['feed'] as const,
  lists: () => [...feedKeys.all, 'list'] as const,
  list: (type, fid) => [...feedKeys.lists(), { type, fid }] as const,
}
export const feedOptions = {
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
}
```
**Impact**: MEDIUM - More predictable caching behavior
**Effort**: LOW - 2-3 hours

### 9. Missing Prefetching Opportunities
**Files Affected**: `app/(app)/page.tsx`, `components/feed/CastCard.tsx`
**Current Behavior**: Only prefetches on tab hover
**Proposed Solution**: Add strategic prefetching:
- Prefetch cast conversation on CastCard hover
- Prefetch user profile on username hover
- Prefetch channel feed on channel click
- Use intersection observer to prefetch visible content
**Impact**: MEDIUM - Feels faster, better UX
**Effort**: LOW - 3-4 hours

### 10. No Bundle Size Analysis - Potential Bloat
**Files Affected**: Build configuration
**Current Behavior**: No visibility into bundle size or code splitting
**Proposed Solution**:
- Add @next/bundle-analyzer
- Analyze and document current bundle size
- Identify large dependencies (Virtuoso, @tanstack/react-query, lucide-react)
- Add dynamic imports for heavy features (GIF picker, AI assistant)
**Impact**: MEDIUM - Faster initial load
**Effort**: LOW - 2-3 hours for analysis, MEDIUM for optimization

### 11. Low Test Coverage - Only 7.7%
**Files Affected**: Entire codebase
**Current Status**: 19 test files for 245 source files
**Proposed Solution** (Priority order):
1. Add tests for critical API routes (auth, feed, publish)
2. Add tests for core hooks (useAccounts, useTemplates)
3. Add tests for complex components (CastCard, ComposeModal)
4. Add integration tests for key user flows
**Impact**: MEDIUM - Prevents regressions, enables confident refactoring
**Effort**: HIGH - Ongoing effort, 1 week for critical coverage

---

## 🟢 NICE TO HAVE (Tech Debt)

### 12. Code Duplication - Cast Type Definitions
**Files Affected**: Multiple files define similar Cast interfaces
**Proposed Solution**:
- Create `types/farcaster.ts` with canonical type definitions
- Export shared types (Cast, CastAuthor, CastEmbed, etc.)
- Import everywhere instead of redefining
**Impact**: LOW - Consistency, easier updates
**Effort**: LOW - 2 hours

### 13. Inconsistent Error Handling Patterns
**Files Affected**: Various API routes and components
**Current Behavior**: Mix of:
- console.error only
- toast.error
- Silent failures with catch(() => {})
**Proposed Solution**:
- Standardize error handling helper
```typescript
function handleApiError(error: unknown, context: string) {
  logger.error(context, error)
  const message = error instanceof Error ? error.message : 'Unknown error'
  return { error: message, code: 'INTERNAL_ERROR' }
}
```
**Impact**: LOW - Better debugging, consistent UX
**Effort**: LOW - 2-3 hours

### 14. Missing Loading Skeletons in Some Views
**Files Affected**: `components/feed/ConversationView.tsx`, `components/profile/ProfileView.tsx`
**Current Behavior**: Show generic loader instead of skeleton
**Proposed Solution**: Add layout-matching skeletons like FeedPage does
**Impact**: LOW - Slightly better perceived performance
**Effort**: LOW - 2-3 hours

### 15. Hardcoded Footer Links Point to "#"
**Files Affected**: `components/feed/RightSidebar.tsx:133-137`
**Current Behavior**: Terms, Privacy, Help links don't work
**Proposed Solution**: Create legal pages or link to external docs
**Impact**: LOW - Professionalism, legal compliance
**Effort**: LOW - 1 hour

### 16. No Rate Limiting Visibility for Users
**Files Affected**: All API calls
**Current Behavior**: Rate limit errors show generic error message
**Proposed Solution**:
- Detect 429 status codes
- Show user-friendly message with retry time
- Add rate limit headers to responses (X-RateLimit-Remaining)
**Impact**: LOW - Better UX when rate limited
**Effort**: LOW - 2 hours

### 17. Accessibility - Some Images Missing Alt Text
**Files Affected**: Various components (65 alt attributes found, but some images use empty strings)
**Current Behavior**: Some decorative images have alt="" (good), but some user avatars lack descriptive alt text
**Proposed Solution**: Audit and add descriptive alt text for all meaningful images
**Impact**: LOW - Better accessibility
**Effort**: LOW - 2 hours

---

## 💡 FEATURE OPPORTUNITIES

### 18. Virtual Scrolling Only in Feed - Could Expand
**Current State**: FeedPage uses Virtuoso for infinite scroll
**Opportunity**: Add virtual scrolling to:
- Notifications page (can have 1000+ items)
- User profile casts (can have hundreds)
- Studio cast list (heavy pages)
**Benefit**: Better performance for power users
**Effort**: MEDIUM - 4-6 hours per component

### 19. React Query DevTools Not Enabled
**Current State**: No devtools in development
**Opportunity**: Add React Query DevTools for debugging
```typescript
// components/providers/QueryProvider.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

return (
  <QueryClientProvider client={queryClient}>
    {children}
    {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
  </QueryClientProvider>
)
```
**Benefit**: Easier debugging of cache issues
**Effort**: LOW - 5 minutes

### 20. Opportunity: Background Sync for Offline Support
**Current State**: No offline handling
**Opportunity**:
- Use React Query's built-in retry logic more aggressively
- Add service worker for caching feed data
- Queue compose actions when offline
**Benefit**: Works on flaky mobile connections
**Effort**: HIGH - 1-2 weeks

### 21. Opportunity: Component Library Extraction
**Current State**: UI components mixed with feature components
**Opportunity**:
- Extract `components/ui` to separate package
- Add Storybook for component development
- Enable reuse across projects
**Benefit**: Better component development workflow
**Effort**: MEDIUM - 3-4 days

### 22. Feed Algorithm Experimentation Framework
**Current State**: Feed types are hardcoded (home, following, trending)
**Opportunity**:
- Add A/B testing framework
- Allow users to customize feed algorithm
- Track engagement metrics per feed type
**Benefit**: Data-driven feed improvements
**Effort**: HIGH - 1-2 weeks

---

## 📊 ANSWERS TO SPECIFIC QUESTIONS

### 1. What's the biggest performance bottleneck right now?
**Answer**: **CastCard re-rendering on every feed update**. The 1661-line component has no memoization and re-renders whenever any cast in the feed changes. With 20+ casts visible, this causes significant jank.

**Proof**: No React.memo usage, 18 useState hooks, no prop memoization

### 2. What's the riskiest code (most likely to break)?
**Answer**: **The feed data flow** (`app/(app)/page.tsx:223-257` and `api/feed/route.ts`)
- Complex state management with multiple useEffects
- We just fixed a race condition bug (see commit eca499b)
- In-memory cache can cause stale data on server cold starts
- No error boundaries means feed crash = app crash

### 3. What would break if Neynar API changed?
**Answer**: **Almost everything** - the app is tightly coupled to Neynar:
- No abstraction layer between Neynar client and app code
- `lib/farcaster/client.ts` directly exports Neynar SDK
- API response types are defined inline with `any` (38 files)
- No API contract testing

**Recommendation**: Create adapter layer:
```typescript
// lib/farcaster/adapter.ts
export interface FarcasterClient {
  getFeed(params): Promise<Feed>
  publishCast(params): Promise<Cast>
  // ... standardized interface
}

export function createNeynarAdapter(): FarcasterClient {
  // Wraps Neynar SDK
}
```

### 4. What's the hardest part of this codebase for a new developer?
**Answer**: **Understanding the feed data flow** and **the mega-components**
- CastCard.tsx: 1661 lines, hard to understand what it does
- FeedPage: Complex queryKey management, multiple useState/useEffect interactions
- No architecture documentation
- Lack of types makes it hard to understand data shapes

**Recommendation**:
- Add README.md with architecture overview
- Add Mermaid diagrams for feed data flow
- Break up mega-components
- Add JSDoc comments to complex logic

### 5. What's duplicated that could be abstracted?
**Answer**: Several patterns:

**A. Cast Type Definitions** (10+ files define similar interfaces)
**B. Fetch Error Handling** (every API call reimplements try/catch/toast)
**C. User Avatar Display** (repeated in CastCard, ProfileView, NotificationCard, etc.)
```typescript
// Current: repeated 15+ times
{author.pfp_url && (
  <Image src={author.pfp_url} alt={author.username} width={40} height={40} />
)}

// Better: extract to UserAvatar component
<UserAvatar user={author} size="md" />
```

**D. Modal Patterns** (similar dialog structure repeated)
**E. Empty States** (each view implements its own)

---

## 🎯 RECOMMENDED PRIORITIES (Next 2 Weeks)

### Week 1 - Stability & Quick Wins
1. ✅ Add error boundaries (2 hours) - CRITICAL
2. ✅ Fix RightSidebar React Query (2 hours) - CRITICAL
3. ✅ Add React.memo to top 5 components (4 hours) - HIGH IMPACT
4. ✅ Add React Query DevTools (5 minutes) - QUICK WIN
5. ✅ Optimize CastCard - create useCastInteractions hook (1 day) - HIGH IMPACT

### Week 2 - Architecture Improvements
6. Start CastCard refactoring (2-3 days) - CRITICAL
7. Add bundle analyzer and identify optimization targets (3 hours)
8. Create shared type definitions (2 hours)
9. Add tests for critical API routes (2 days)

### Month 2 - Major Refactoring
10. Complete CastCard split into smaller components
11. Refactor UnifiedDashboard
12. Improve type safety (remove `any` types)
13. Add prefetching strategies
14. Implement optimistic updates for all mutations

---

## 🔒 SECURITY NOTES

### ✅ Security Strengths
- Environment variables properly validated with Zod
- No exposed secrets (NEXT_PUBLIC_ only for Giphy, which is appropriate)
- Auth uses JWT with httpOnly cookies
- No dangerouslySetInnerHTML usage (XSS protection)
- CSRF protection via SameSite cookies
- Rate limiting implemented
- Circuit breaker for external APIs

### ⚠️ Security Considerations
1. **Input Sanitization**: Cast text rendering uses `renderCastText` - verify it properly sanitizes user input
2. **SSRF Protection**: File upload endpoints should validate URLs (appears to have `lib/ssrf.ts` - good!)
3. **Auth Middleware**: Verify all protected routes use `withAuth` wrapper
4. **Neynar API Key**: Stored server-side only (good)
5. **CORS**: Verify middleware properly restricts origins

---

## 📈 METRICS TO TRACK

Post-improvements, track these metrics:
1. **Bundle Size**: Target < 300KB gzipped for main bundle
2. **Time to Interactive**: Target < 3s on 3G
3. **Largest Contentful Paint**: Target < 2.5s
4. **Feed Render Time**: Measure before/after CastCard optimization
5. **Test Coverage**: Goal 60%+ for critical paths
6. **Error Rate**: Track with Sentry or similar
7. **Cache Hit Rate**: Track React Query cache hits

---

## 🛠️ TOOLS TO ADD

1. **@next/bundle-analyzer** - Identify bundle bloat
2. **React Query DevTools** - Debug cache issues
3. **@testing-library/react** - Better component testing
4. **Storybook** - Component development
5. **Lighthouse CI** - Track performance metrics
6. **TypeScript strict mode** - Gradually enable stricter checks
7. **ESLint rules**:
   - `@typescript-eslint/no-explicit-any` - Warn on `any` usage
   - `react/jsx-no-bind` - Prevent inline function creation

---

**END OF AUDIT REPORT**
