# CLAUDE.md - AI Assistant Guide for Castor

This document provides comprehensive guidance for AI assistants working on the Castor codebase. It covers architecture, conventions, patterns, and workflows to ensure consistent, high-quality contributions.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Codebase Structure](#codebase-structure)
4. [Key Architectural Patterns](#key-architectural-patterns)
5. [Development Workflows](#development-workflows)
6. [Code Conventions](#code-conventions)
7. [Testing Guidelines](#testing-guidelines)
8. [Security Considerations](#security-considerations)
9. [Common Tasks & Examples](#common-tasks--examples)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Castor** is a Farcaster content scheduling and management platform for studio accounts. It enables users to schedule casts, manage multiple Farcaster accounts, leverage AI-powered content generation, and analyze post performance.

### Core Features

- **Multi-Account Management**: Connect and manage multiple Farcaster accounts
- **Content Scheduling**: Schedule individual casts and threads with media attachments
- **AI-Powered Tools**: Content generation, translation, brand voice validation, reply suggestions
- **Analytics**: Track cast performance, engagement metrics, and insights
- **Team Collaboration**: Share account access with team members
- **Knowledge Base**: Store brand context for AI-powered content generation
- **Templates**: Reusable cast templates for common content types

### Key Business Logic

- **Account System**: Users can own multiple accounts, with role-based access (owner/member)
- **Scheduling**: Casts are scheduled via cron job (runs every 5 minutes)
- **Publisher**: Background job processes up to 5 casts per execution with retry logic
- **Rate Limiting**: Upstash Redis-based rate limiting for API protection
- **Idempotency**: Critical operations use idempotency keys to prevent duplicates
- **Distributed Locks**: Prevent race conditions in concurrent operations

---

## Technology Stack

### Core Framework

- **Next.js 16.0.7** - React framework with App Router, Server Components, Server Actions
- **React 19.1.2** - UI library with latest concurrent features
- **TypeScript 5.9.3** - Strict type safety enabled

### Database & ORM

- **SQLite** - Development database (file-based)
- **Turso/@libsql/client** - Production edge database (LibSQL)
- **Drizzle ORM 0.36.4** - Type-safe SQL query builder
- **Drizzle Kit 0.28.1** - Schema migrations and management

### Styling & UI

- **Tailwind CSS 3.4.15** - Utility-first CSS framework
- **Radix UI** - Headless accessible components
- **shadcn/ui** - Pre-built component library
- **Lucide React** - Icon library (460+ icons)
- **next-themes** - Dark mode support

### Farcaster Integration

- **@farcaster/auth-kit** - Sign In With Farcaster
- **@neynar/nodejs-sdk** - Official Neynar API client (v2)
- **@noble/ed25519** - Cryptographic signing for Farcaster

### AI/ML

- **@google/generative-ai** - Gemini AI integration (text generation, translation)
- **@vitalets/google-translate-api** - Translation fallback

### Data & State Management

- **@tanstack/react-query** - Server state management, caching
- **React Context** - UI state (no Redux/Zustand)
- **@upstash/redis** - Rate limiting, caching, distributed locks

### Media & Assets

- **Cloudflare Stream** - Video hosting and streaming
- **Cloudflare Images** - Image CDN and optimization
- **Livepeer** - Alternative video provider
- **HLS.js** - Video playback in browser

### Testing

- **Vitest** - Unit testing framework (Jest-compatible)
- **@testing-library/react** - Component testing utilities
- **Playwright** - E2E testing
- **@vitest/coverage-v8** - Code coverage

### Utilities

- **jose** - JWT operations
- **nanoid** - ID generation
- **date-fns** - Date manipulation
- **zod** - Runtime validation and type inference
- **pino** - Structured logging

---

## Codebase Structure

### High-Level Overview

```
castor/
├── src/                      # Application source code
│   ├── app/                  # Next.js App Router (pages, layouts, API routes)
│   ├── components/           # React components
│   ├── context/              # React Context providers
│   ├── hooks/                # Custom React hooks
│   └── lib/                  # Core business logic, utilities
├── drizzle/                  # Database migrations
├── e2e/                      # Playwright E2E tests
├── public/                   # Static assets
└── scripts/                  # Build and deployment scripts
```

### Detailed `src/` Structure

#### `src/app/` - Next.js App Router

```
app/
├── (app)/                    # Protected routes (authenticated users only)
│   ├── accounts/            # Account management UI
│   │   ├── [id]/           # Single account pages
│   │   │   ├── ai/         # AI settings (brand voice, style profile)
│   │   │   └── context/    # Knowledge base management
│   │   └── connect/        # New account onboarding
│   ├── analytics/          # Analytics dashboard
│   ├── cast/[hash]/        # Individual cast detail view
│   ├── edit/[id]/          # Edit scheduled cast
│   ├── notifications/      # Notifications page
│   ├── settings/           # User settings
│   ├── studio/             # Main dashboard (calendar view, cast list)
│   └── user/[username]/    # Public user profile
├── (public)/               # Public routes (unauthenticated access)
│   └── landing/            # Landing page
├── api/                    # API routes (RESTful endpoints)
│   ├── accounts/           # Account CRUD operations
│   ├── ai/                 # AI-powered features (assistant, translate, reply)
│   ├── analytics/          # Analytics data and insights
│   ├── auth/               # Authentication endpoints
│   ├── casts/              # Cast scheduling, publishing, management
│   ├── channels/           # Farcaster channel operations
│   ├── cron/               # Scheduled background jobs
│   ├── feed/               # Activity feed data
│   ├── media/              # Media upload and processing
│   ├── social/             # Social graph (follow, followers, etc.)
│   ├── templates/          # Cast template CRUD
│   └── users/              # User profile data
├── login/                  # Login page
└── layout.tsx              # Root layout (providers, fonts, metadata)
```

#### `src/components/` - React Components

**Organization Principle**: Components are organized by feature/domain, not by type.

```
components/
├── accounts/               # Account-related UI components
├── ai/                     # AI feature UI (chat, suggestions)
├── calendar/               # Calendar view components
├── compose/                # Cast composer (main feature)
│   ├── ComposeModal.tsx    # Main modal orchestrator
│   ├── ComposeCard.tsx     # Individual cast card in thread
│   ├── AccountSelector.tsx # Account picker dropdown
│   ├── ChannelPicker.tsx   # Channel selection with search
│   ├── GifPicker.tsx       # GIF search integration
│   ├── AITabs.tsx          # AI features tab interface
│   └── types.ts            # Compose-specific TypeScript types
├── embeds/                 # Embed renderers (URLs, images, videos)
│   └── renderers/          # Specific embed types (cast, frame, etc.)
├── feed/                   # Feed and social components
│   ├── cast-card/          # Modular cast card
│   │   ├── CastHeader.tsx  # Author info, timestamp
│   │   ├── CastContent.tsx # Text content, embeds
│   │   ├── CastActions.tsx # Like, reply, recast buttons
│   │   └── types.ts        # Cast-related types
│   ├── ConversationView.tsx # Thread/conversation display
│   ├── NotificationCard.tsx # Notification item
│   └── VirtualizedCarousel.tsx # Media carousel (virtualized)
├── layout/                 # Layout components
│   ├── MobileNav.tsx       # Bottom navigation bar
│   └── ResponsiveSidebar.tsx # Desktop sidebar
├── profile/                # User profile components
├── providers/              # React Context providers
│   ├── AuthProvider.tsx    # Farcaster authentication
│   ├── QueryProvider.tsx   # React Query setup
│   ├── NotificationsProvider.tsx # Real-time notifications (SSE)
│   └── ThemeProvider.tsx   # Dark mode theming
└── ui/                     # shadcn/ui components (20+ reusable primitives)
    ├── button.tsx
    ├── dialog.tsx
    ├── dropdown-menu.tsx
    └── ...
```

#### `src/lib/` - Core Business Logic

```
lib/
├── ai/                     # AI integrations
│   ├── castor-ai.ts        # Main AI assistant (Gemini)
│   ├── brand-validator.ts  # Brand voice validation
│   ├── languages.ts        # Supported languages config
│   └── prompt-utils.ts     # Prompt templating helpers
├── api/                    # API utilities
│   └── response.ts         # Standardized API responses
├── auth/                   # Authentication
│   └── index.ts            # JWT session management
├── compose/                # Composer business logic
│   ├── constants.ts        # Max chars, embeds, media limits
│   ├── embeds.ts           # URL embed detection and parsing
│   ├── media-utils.ts      # Media file handling
│   ├── serialization.ts    # Cast data serialization
│   ├── text-utils.ts       # Text processing (mentions, URLs)
│   ├── validation-rules.ts # Validation rule definitions
│   └── validation.ts       # Cast validation logic
├── db/                     # Database
│   ├── index.ts            # Drizzle client initialization
│   ├── safe-db.ts          # Wrapped DB operations with error handling
│   └── schema.ts           # Complete database schema (15+ tables)
├── farcaster/              # Farcaster SDK
│   ├── client.ts           # Neynar client wrapper
│   └── index.ts            # Public exports
├── notifications/          # Notifications system
│   └── events.ts           # SSE event emitters
├── validations/            # Zod schemas
│   └── index.ts            # All validation schemas
├── audit.ts                # Audit logging utilities
├── env.ts                  # Environment variable validation
├── fetch.ts                # Timeout-enabled fetch wrapper
├── idempotency.ts          # Idempotency key management
├── lock.ts                 # Distributed locking (Redis)
├── logger.ts               # Pino logger configuration
├── media-upload.ts         # Media upload orchestration
├── media-validation.ts     # Media file validation
├── publisher.ts            # Cast publishing logic
├── rate-limit.ts           # Upstash rate limiting
├── retry.ts                # Retry logic with exponential backoff
└── utils.ts                # General utilities (cn, formatters, etc.)
```

#### `src/hooks/` - Custom React Hooks

```
hooks/
├── useAccounts.ts          # Account management state
├── useAdaptiveLoading.ts   # Performance-based loading
├── useCastThread.ts        # Thread composition state
├── useComposeSubmit.ts     # Composer submit logic
├── useDebounce.ts          # Debounced values
├── useFeedNavigation.ts    # Feed routing helpers
├── useMediaQuery.ts        # Responsive breakpoints
├── useNotificationStream.ts # SSE notification stream
├── useScheduleForm.ts      # Schedule form state
├── useTemplates.ts         # Template CRUD operations
└── useUserChannels.ts      # Channel favorites management
```

#### Database Schema (`src/lib/db/schema.ts`)

**15 Tables:**

1. **users** - Application users (Farcaster login)
2. **accounts** - Connected Farcaster accounts (fid, signer, profile data)
3. **accountMembers** - Team collaboration (multi-user access to accounts)
4. **scheduledCasts** - Scheduled posts (content, media, scheduling)
5. **castMedia** - Attached images/videos (Cloudflare URLs)
6. **threads** - Thread grouping for multi-cast threads
7. **templates** - Reusable cast templates
8. **castAnalytics** - Published cast metrics (likes, recasts, replies)
9. **userStyleProfiles** - AI-learned writing style per account
10. **accountKnowledgeBase** - Brand voice and context documents
11. **accountDocuments** - Individual knowledge base entries
12. **userChannels** - User's favorite Farcaster channels
13. **analyticsInsightsCache** - Cached AI-generated insights
14. **notifications** - In-app notifications
15. **mediaUploads** - Media upload tracking and status

---

## Key Architectural Patterns

### 1. API Route Pattern

**Standard Structure for All API Routes:**

```typescript
// src/app/api/{resource}/route.ts

export async function POST(request: NextRequest) {
  // 1. Get client IP for rate limiting
  const ip = getClientIP(request)

  // 2. Authentication check
  const session = await getSession()
  if (!session) {
    return ApiErrors.unauthorized()
  }

  // 3. Parse and validate request body
  const body = await request.json()
  const validation = validate(scheduleCastSchema, body)
  if (!validation.success) {
    return validation.error // Returns formatted validation errors
  }
  const data = validation.data

  // 4. Rate limiting
  const rateLimit = await checkRateLimit(`schedule:${session.userId}`, 'api')
  if (!rateLimit.success) {
    return ApiErrors.rateLimited()
  }

  // 5. Authorization check (resource-level permissions)
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, data.accountId)
  })

  if (!canAccess(session, { ownerId: account.ownerId })) {
    return ApiErrors.forbidden()
  }

  // 6. Idempotency check (for critical operations)
  const idemKey = `schedule:${session.userId}:${data.idempotencyKey}`
  const cached = await getIdempotencyResponse(idemKey)
  if (cached) {
    return success(cached.data, cached.status)
  }

  // 7. Business logic with distributed lock (if needed)
  const result = await withLock(`cast:${data.accountId}`, async () => {
    // Database transaction for atomicity
    return await db.transaction(async (tx) => {
      const cast = await tx.insert(scheduledCasts).values({
        id: nanoid(),
        accountId: data.accountId,
        content: data.content,
        scheduledAt: new Date(data.scheduledAt),
        status: 'scheduled',
      }).returning()

      // Insert related data
      if (data.media?.length) {
        await tx.insert(castMedia).values(
          data.media.map(m => ({ castId: cast[0].id, ...m }))
        )
      }

      return cast[0]
    })
  })

  // 8. Store idempotency response
  await setIdempotencyResponse(
    idemKey,
    { status: 201, data: result },
    60 * 60 // 1 hour TTL
  )

  // 9. Return standardized success response
  return success(result, 201)
}
```

**Key Takeaways:**

- Always check authentication first
- Use standardized error responses from `ApiErrors`
- Validate all inputs with Zod schemas
- Apply rate limiting to prevent abuse
- Use idempotency keys for critical operations (scheduling, publishing)
- Wrap concurrent operations in distributed locks
- Use database transactions for multi-table operations
- Return standardized responses: `success(data, status)` or `ApiErrors.*`

### 2. Server vs Client Components

**Server Components (Default)**

Use for:
- Data fetching
- Database access
- Secret/API key usage
- SEO-critical content
- Initial page loads

```typescript
// src/app/(app)/studio/page.tsx
// NO 'use client' directive = Server Component

export const dynamic = 'force-dynamic' // Disable static generation

export default async function StudioPage() {
  // 1. Direct async/await (no useEffect)
  const session = await getSession()

  // 2. Redirect unauthenticated users
  if (!session) {
    redirect('/login')
  }

  // 3. Direct database access
  const accounts = await db.query.accounts.findMany({
    where: eq(accountsTable.ownerId, session.userId),
    with: {
      members: true // Load relations
    }
  })

  // 4. Pass data to client components as props
  return <StudioDashboard accounts={accounts} userId={session.userId} />
}
```

**Client Components**

Use for:
- Interactivity (onClick, onChange, etc.)
- React hooks (useState, useEffect, useContext)
- Browser APIs (localStorage, window, navigator)
- Third-party libraries requiring browser context

```typescript
// src/components/compose/ComposeModal.tsx
'use client' // REQUIRED for client-side features

import { useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'

export function ComposeModal({ open, onOpenChange }: Props) {
  // React hooks
  const [content, setContent] = useState('')
  const { accounts, selectedAccountId, setSelectedAccountId } = useAccounts()

  // Event handlers
  const handleSubmit = async () => {
    const response = await fetch('/api/casts/schedule', {
      method: 'POST',
      body: JSON.stringify({ content, accountId: selectedAccountId })
    })
    // ...
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      <Button onClick={handleSubmit}>Schedule</Button>
    </Dialog>
  )
}
```

### 3. Database Patterns

**Schema Definition**

```typescript
// src/lib/db/schema.ts

// 1. Define table
export const scheduledCasts = sqliteTable(
  'scheduled_casts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp' }).notNull(),
    status: text('status', {
      enum: ['draft', 'scheduled', 'published', 'failed']
    }).notNull().default('draft'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // 2. Add indexes for query performance
    accountIdx: index('casts_account_idx').on(table.accountId),
    statusIdx: index('casts_status_idx').on(table.status),
    scheduledIdx: index('casts_scheduled_idx').on(table.scheduledAt),
  })
)

// 3. Define relations
export const scheduledCastsRelations = relations(scheduledCasts, ({ one, many }) => ({
  account: one(accounts, {
    fields: [scheduledCasts.accountId],
    references: [accounts.id],
  }),
  media: many(castMedia),
  analytics: one(castAnalytics),
}))

// 4. Infer TypeScript types
export type ScheduledCast = typeof scheduledCasts.$inferSelect
export type NewScheduledCast = typeof scheduledCasts.$inferInsert
```

**Query Patterns**

```typescript
// Basic query
const casts = await db.query.scheduledCasts.findMany({
  where: eq(scheduledCasts.accountId, accountId)
})

// Query with relations
const casts = await db.query.scheduledCasts.findMany({
  where: and(
    eq(scheduledCasts.accountId, accountId),
    eq(scheduledCasts.status, 'scheduled')
  ),
  with: {
    account: true,  // Load account relation
    media: true,    // Load all media
  },
  orderBy: (casts, { desc }) => [desc(casts.scheduledAt)],
  limit: 20,
})

// Complex query with multiple conditions
const dueCasts = await db.query.scheduledCasts.findMany({
  where: and(
    eq(scheduledCasts.status, 'scheduled'),
    lte(scheduledCasts.scheduledAt, new Date())
  ),
  with: {
    account: {
      columns: { id: true, fid: true, signerUuid: true }
    },
    media: true,
  },
  limit: 5,
})

// Transactions for atomicity
await db.transaction(async (tx) => {
  // All operations succeed or all fail
  const cast = await tx.insert(scheduledCasts).values({...}).returning()
  await tx.insert(castMedia).values([...])
  await tx.update(accounts).set({ lastCastAt: new Date() })
})
```

### 4. Authentication & Authorization

**JWT Session Management**

```typescript
// src/lib/auth/index.ts

// Create session after Farcaster sign-in
export async function createSession(user: AuthUser): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  const token = await new SignJWT({ user, expiresAt: expiresAt.toISOString() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey())

  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

// Get current session (with auto-renewal)
export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE)?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    const session = payload as unknown as Session

    // Auto-renew if expiring soon (< 1 day)
    const timeUntilExpiry = new Date(session.expiresAt).getTime() - Date.now()
    if (timeUntilExpiry < REFRESH_THRESHOLD_MS) {
      refreshSession(session.user).catch(() => {})
    }

    return session.user
  } catch {
    return null
  }
}
```

**Authorization Helpers**

```typescript
// Check if user can access resource
export function canAccess(
  session: AuthUser,
  context: { ownerId?: string; isMember?: boolean }
): boolean {
  // Admin has global access
  if (session.role === 'admin') return true

  // Owner has access
  if (context.ownerId === session.userId) return true

  // Explicit member access
  if (context.isMember) return true

  return false
}

// Usage in API route
const account = await db.query.accounts.findFirst({
  where: eq(accounts.id, accountId)
})

const membership = await db.query.accountMembers.findFirst({
  where: and(
    eq(accountMembers.accountId, accountId),
    eq(accountMembers.userId, session.userId)
  )
})

if (!canAccess(session, {
  ownerId: account.ownerId,
  isMember: !!membership
})) {
  return ApiErrors.forbidden()
}
```

### 5. State Management Strategy

**No Global State Library** - Uses composition of React primitives:

**Server State: React Query**

```typescript
// src/hooks/useAccounts.ts
'use client'

import { useQuery } from '@tanstack/react-query'

export function useAccounts() {
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await fetch('/api/accounts')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    staleTime: 60 * 1000, // 1 minute
  })

  return { accounts, isLoading }
}
```

**UI State: React Context**

```typescript
// src/context/SelectedAccountContext.tsx
'use client'

const SelectedAccountContext = createContext<ContextValue | undefined>(undefined)

export function SelectedAccountProvider({ children }: { children: ReactNode }) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  return (
    <SelectedAccountContext.Provider value={{ selectedAccountId, setSelectedAccountId }}>
      {children}
    </SelectedAccountContext.Provider>
  )
}

export function useSelectedAccount() {
  const context = useContext(SelectedAccountContext)
  if (!context) throw new Error('Must be used within SelectedAccountProvider')
  return context
}
```

**Form State: Custom Hooks**

```typescript
// src/hooks/useScheduleForm.ts
export function useScheduleForm() {
  const [date, setDate] = useState<Date>()
  const [time, setTime] = useState('')

  const toISO = () => {
    if (!date || !time) return null
    const [hours, minutes] = time.split(':')
    const combined = new Date(date)
    combined.setHours(parseInt(hours), parseInt(minutes))
    return combined.toISOString()
  }

  return {
    date, setDate,
    time, setTime,
    toISO,
    reset: () => {
      setDate(undefined)
      setTime('')
    }
  }
}
```

### 6. Error Handling Patterns

**API Routes**

```typescript
// Standardized error responses
export const ApiErrors = {
  unauthorized: () =>
    NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    ),

  forbidden: (message = 'Access denied') =>
    NextResponse.json(
      { success: false, error: message, code: 'FORBIDDEN' },
      { status: 403 }
    ),

  notFound: (resource: string) =>
    NextResponse.json(
      { success: false, error: `${resource} not found`, code: 'NOT_FOUND' },
      { status: 404 }
    ),

  validationFailed: (errors: ValidationError[]) =>
    NextResponse.json(
      { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: errors },
      { status: 400 }
    ),

  rateLimited: () =>
    NextResponse.json(
      { success: false, error: 'Too many requests', code: 'RATE_LIMITED' },
      { status: 429 }
    ),
}

// Usage
try {
  const result = await riskyOperation()
  return success(result)
} catch (error) {
  console.error('[Context] Operation failed:', error)
  return ApiErrors.operationFailed('Failed to process request')
}
```

**Client-Side**

```typescript
import { toast } from 'sonner'

// User-facing error handling
const handleSubmit = async () => {
  try {
    const response = await fetch('/api/casts/schedule', {
      method: 'POST',
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      toast.error(error.error || 'Failed to schedule cast')
      return
    }

    toast.success('Cast scheduled successfully')
  } catch (error) {
    console.error('Submit error:', error)
    toast.error('Network error. Please try again.')
  }
}
```

**Retry Logic**

```typescript
// src/lib/retry.ts - Exponential backoff
const result = await retryOperation(
  () => neynarClient.publishCast(data),
  {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    context: 'Publish Cast'
  }
)
```

---

## Development Workflows

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Edit .env with your credentials
# Required: NEYNAR_API_KEY, SESSION_SECRET (32+ chars)
# Optional: GEMINI_API_KEY, UPSTASH_REDIS_REST_URL

# 4. Initialize database
npm run db:push

# 5. Start development server
npm run dev
# App runs at http://localhost:3001
```

### Database Workflows

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly to DB (development only)
npm run db:push

# Open Drizzle Studio (visual database editor)
npm run db:studio
# Opens at https://local.drizzle.studio
```

### Testing Workflows

```bash
# Unit tests
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:ui           # Vitest UI

# E2E tests
npm run test:e2e          # Headless
npm run test:e2e:ui       # Playwright UI
npm run test:e2e:headed   # Headed browser mode
```

### Development Best Practices

1. **Always read files before modifying**
   ```typescript
   // BAD: Making changes without context
   // GOOD: Read file first to understand existing patterns
   ```

2. **Use path aliases**
   ```typescript
   // BAD: import { db } from '../../../lib/db'
   // GOOD: import { db } from '@/lib/db'
   ```

3. **Follow file naming conventions**
   ```
   Components:  ComposeModal.tsx (PascalCase)
   Utilities:   url-utils.ts (kebab-case)
   Hooks:       useAccounts.ts (camelCase with 'use' prefix)
   ```

4. **Prefer editing over creating new files**
   - Extend existing utilities instead of creating new ones
   - Add to existing components before creating new ones

5. **Server Components by default**
   - Only add 'use client' when needed for interactivity
   - Keep data fetching in Server Components when possible

6. **Type safety**
   - Infer types from Drizzle schema
   - Use Zod for runtime validation
   - Avoid `any` - use `unknown` and narrow

### Adding New Features

**Example: Adding a New API Endpoint**

1. Create route file: `src/app/api/{resource}/route.ts`
2. Implement handler following standard pattern (see API Route Pattern above)
3. Add Zod validation schema: `src/lib/validations/index.ts`
4. Add database operations if needed
5. Create client-side hook: `src/hooks/use{Resource}.ts`
6. Add tests: `src/app/api/{resource}/route.test.ts`

**Example: Adding a New Page**

1. Create page file: `src/app/(app)/{route}/page.tsx`
2. Implement as Server Component with data fetching
3. Extract interactive parts to Client Components
4. Add to navigation if needed: `src/components/layout/`

---

## Code Conventions

### File Naming

- **Components**: `PascalCase.tsx` - `ComposeModal.tsx`, `CastCard.tsx`
- **Utilities**: `kebab-case.ts` - `url-utils.ts`, `media-upload.ts`
- **Hooks**: `camelCase.ts` with `use` prefix - `useAccounts.ts`
- **Types**: `types.ts` (exports interfaces/types)
- **Tests**: `{filename}.test.ts` - `validation.test.ts`

### TypeScript Conventions

```typescript
// Prefer interfaces for objects
export interface AuthUser {
  userId: string
  fid: number
  role: 'admin' | 'member'
}

// Use type for unions, primitives
export type Status = 'draft' | 'scheduled' | 'published' | 'failed'

// Infer types from schema
export type ScheduledCast = typeof scheduledCasts.$inferSelect

// Use const assertions for readonly values
export const CAST_LIMITS = {
  STANDARD: 1024,
  PRO: 4096,
} as const

// Type function parameters and returns
export async function publishCast(
  castId: string,
  accountId: string
): Promise<PublishResult> {
  // ...
}
```

### Variable Naming

```typescript
// camelCase for variables and functions
const selectedAccount = accounts.find(...)
function calculateTextLength(text: string): number

// PascalCase for components and classes
export function ComposeModal() {}
class ApiClient {}

// SCREAMING_SNAKE_CASE for constants
const MAX_CHARS_STANDARD = 1024
const AUTH_COOKIE = 'castor_session'

// Prefix booleans with is/has/can/should
const isLoading = true
const hasError = false
const canAccess = checkPermissions()
```

### Import/Export Conventions

```typescript
// Use path aliases
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/hooks'

// Prefer named exports
export function success<T>(data: T) { ... }
export const ApiErrors = { ... }

// Barrel exports for cleaner imports
// src/hooks/index.ts
export * from './useAccounts'
export * from './useTemplates'

// Usage:
import { useAccounts, useTemplates } from '@/hooks'
```

### Component Patterns

```typescript
// Client Component with TypeScript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ComposeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultAccountId?: string
}

export function ComposeModal({
  open,
  onOpenChange,
  defaultAccountId
}: ComposeModalProps) {
  const [content, setContent] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ... */}
    </Dialog>
  )
}
```

```typescript
// Server Component with async data fetching
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const accounts = await db.query.accounts.findMany({
    where: eq(accountsTable.ownerId, session.userId)
  })

  return <Dashboard accounts={accounts} />
}
```

### Code Organization

```typescript
// Order of declarations in files:
// 1. Imports (external, then internal)
import { useState } from 'react'
import { toast } from 'sonner'
import { useAccounts } from '@/hooks/useAccounts'
import { Button } from '@/components/ui/button'

// 2. Constants
const MAX_RETRIES = 3

// 3. Types/Interfaces
interface Props {
  accountId: string
}

// 4. Helper functions
function formatContent(text: string) {
  return text.trim()
}

// 5. Main component/export
export function Component({ accountId }: Props) {
  // ...
}
```

---

## Testing Guidelines

### Unit Testing with Vitest

**Test File Location**: Co-locate tests with source files or in `__tests__/` directory

```typescript
// src/lib/compose/validation.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { validateCast, hasMediaIssues } from './validation'

describe('validateCast', () => {
  it('should validate empty content', () => {
    const result = validateCast('')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Content is required')
  })

  it('should validate content length', () => {
    const longText = 'a'.repeat(5000)
    const result = validateCast(longText)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Content exceeds maximum length')
  })

  it('should validate URLs', () => {
    const content = 'Check this out: https://example.com'
    const result = validateCast(content)
    expect(result.valid).toBe(true)
    expect(result.embeds).toHaveLength(1)
  })
})

describe('hasMediaIssues', () => {
  it('should return true when media is uploading', () => {
    const casts = [{ media: [{ uploading: true }] }]
    expect(hasMediaIssues(casts)).toBe(true)
  })

  it('should return false for valid media', () => {
    const casts = [{ media: [{ url: 'https://cdn.com/image.jpg', uploading: false }] }]
    expect(hasMediaIssues(casts)).toBe(false)
  })
})
```

**Component Testing**

```typescript
// src/components/ui/button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick handler', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies variant styles', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('bg-destructive')
  })
})
```

### E2E Testing with Playwright

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in with Farcaster' }).click()
    // ... complete auth flow
  })

  test('should display user accounts', async ({ page }) => {
    await page.goto('/studio')

    await expect(page.getByText('My Accounts')).toBeVisible()
    await expect(page.getByRole('list')).toContainText('Test Account')
  })

  test('should schedule a cast', async ({ page }) => {
    await page.goto('/studio')

    // Open composer
    await page.getByRole('button', { name: 'New Cast' }).click()

    // Fill form
    await page.getByPlaceholder('What\'s happening?').fill('Test cast')
    await page.getByLabel('Schedule').click()
    await page.getByLabel('Date').fill('2024-12-31')
    await page.getByLabel('Time').fill('14:30')

    // Submit
    await page.getByRole('button', { name: 'Schedule' }).click()

    // Verify success
    await expect(page.getByText('Cast scheduled')).toBeVisible()
  })
})
```

### Testing Best Practices

1. **Test user behavior, not implementation**
   ```typescript
   // BAD: Testing internal state
   expect(component.state.isOpen).toBe(true)

   // GOOD: Testing visible behavior
   expect(screen.getByRole('dialog')).toBeVisible()
   ```

2. **Use meaningful test descriptions**
   ```typescript
   // BAD
   test('test 1', () => {})

   // GOOD
   test('should show error toast when API request fails', () => {})
   ```

3. **Arrange-Act-Assert pattern**
   ```typescript
   test('should validate email format', () => {
     // Arrange
     const email = 'invalid-email'

     // Act
     const result = validateEmail(email)

     // Assert
     expect(result.valid).toBe(false)
     expect(result.error).toBe('Invalid email format')
   })
   ```

4. **Mock external dependencies**
   ```typescript
   import { vi } from 'vitest'

   vi.mock('@/lib/farcaster/client', () => ({
     neynarClient: {
       publishCast: vi.fn().mockResolvedValue({ hash: '0x123' })
     }
   }))
   ```

---

## Security Considerations

### 1. Authentication & Sessions

- **JWT-based sessions** stored in HTTP-only cookies
- **7-day session duration** with automatic renewal (< 24 hours remaining)
- **Secure cookie flags**: `httpOnly: true, secure: true, sameSite: 'lax'`
- **Session validation** on every protected route

### 2. Authorization

- **Multi-level access control**:
  - User owns account (via `ownerId`)
  - User is explicit member (via `accountMembers` table)
  - Admin role has global access
- **Resource-level permissions** checked in every API route
- **No client-side permission checks** - always validate server-side

### 3. Rate Limiting

```typescript
// Upstash Redis-based rate limiting
const rateLimit = await checkRateLimit(
  `schedule:${session.userId}`,
  'api', // tier: 'api' | 'web'
  {
    requests: 100,
    window: '1m'
  }
)

if (!rateLimit.success) {
  return ApiErrors.rateLimited()
}
```

**Rate Limit Tiers**:
- **API routes**: 100 requests/minute per user
- **Web routes**: 300 requests/minute per user
- **Critical operations** (publish, delete): 10 requests/minute

### 4. Input Validation

- **All inputs validated** with Zod schemas before processing
- **Type-safe validation** with TypeScript inference
- **Sanitization** of user content (URLs, text)

```typescript
// Example validation
const validation = validate(scheduleCastSchema, body)
if (!validation.success) {
  return validation.error // Returns detailed field errors
}
```

### 5. SSRF Protection

```typescript
// src/lib/ssrf.ts - Prevent Server-Side Request Forgery

// Block private IP ranges
const BLOCKED_IP_RANGES = [
  '127.0.0.0/8',    // Localhost
  '10.0.0.0/8',     // Private network
  '172.16.0.0/12',  // Private network
  '192.168.0.0/16', // Private network
  '169.254.0.0/16', // Link-local
]

// Validate URLs before fetching
export async function safeFetch(url: string): Promise<Response> {
  const parsed = new URL(url)

  // Only allow HTTP(S)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid protocol')
  }

  // Check against blocked IPs
  const ip = await dns.resolve(parsed.hostname)
  if (isPrivateIP(ip)) {
    throw new Error('Access to private IPs blocked')
  }

  return fetch(url, { signal: AbortSignal.timeout(5000) })
}
```

### 6. Idempotency

**Prevent duplicate operations** (critical for scheduling, publishing):

```typescript
const idemKey = `schedule:${session.userId}:${nanoid()}`
const cached = await getIdempotencyResponse(idemKey)

if (cached) {
  return success(cached.data, cached.status)
}

// Perform operation
const result = await scheduleOperation()

// Cache result for 1 hour
await setIdempotencyResponse(idemKey, { status: 201, data: result }, 3600)
```

### 7. Distributed Locks

**Prevent race conditions** in concurrent operations:

```typescript
// src/lib/lock.ts - Redis-based distributed locking

const result = await withLock(
  `publish:${accountId}`,
  async () => {
    // Critical section - only one process can execute at a time
    return await publishCast(castId)
  },
  {
    timeout: 10000,  // 10 second lock timeout
    retries: 3
  }
)
```

### 8. Content Security

- **XSS prevention**: React automatically escapes JSX content
- **No `dangerouslySetInnerHTML`** unless absolutely necessary
- **Sanitize URLs** before rendering in embeds
- **CSP headers** configured in `next.config.ts`

### 9. Secrets Management

```typescript
// src/lib/env.ts - Environment variable validation

const envSchema = z.object({
  SESSION_SECRET: z.string().min(32),
  NEYNAR_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
}).superRefine((val, ctx) => {
  // Enforce production requirements
  if (val.NODE_ENV === 'production') {
    if (!val.SESSION_SECRET) {
      ctx.addIssue({ message: 'SESSION_SECRET required in production' })
    }
    if (!val.UPSTASH_REDIS_REST_URL) {
      ctx.addIssue({ message: 'Redis required in production' })
    }
  }
})

export const env = envSchema.parse(process.env)
```

**Never commit secrets**:
- Use `.env.local` for local development (gitignored)
- Use environment variables in production (Netlify)
- Validate required secrets on startup

### 10. SQL Injection Prevention

- **Drizzle ORM** handles parameterization automatically
- **Never concatenate user input** into SQL strings
- Use ORM query builder or prepared statements

---

## Common Tasks & Examples

### 1. Adding a New API Endpoint

**Task**: Create `/api/templates/[id]/route.ts` for template CRUD

```typescript
// src/app/api/templates/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { ApiErrors, success } from '@/lib/api/response'
import { validate } from '@/lib/validations'
import { updateTemplateSchema } from '@/lib/validations'

// GET /api/templates/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params

  const template = await db.query.templates.findFirst({
    where: and(
      eq(templates.id, id),
      eq(templates.userId, session.userId)
    )
  })

  if (!template) return ApiErrors.notFound('Template')

  return success(template)
}

// PUT /api/templates/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params
  const body = await request.json()

  // Validate input
  const validation = validate(updateTemplateSchema, body)
  if (!validation.success) return validation.error

  // Check ownership
  const existing = await db.query.templates.findFirst({
    where: eq(templates.id, id)
  })

  if (!existing) return ApiErrors.notFound('Template')
  if (existing.userId !== session.userId) return ApiErrors.forbidden()

  // Update
  const updated = await db
    .update(templates)
    .set({
      name: validation.data.name,
      content: validation.data.content,
      updatedAt: new Date(),
    })
    .where(eq(templates.id, id))
    .returning()

  return success(updated[0])
}

// DELETE /api/templates/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params

  const template = await db.query.templates.findFirst({
    where: eq(templates.id, id)
  })

  if (!template) return ApiErrors.notFound('Template')
  if (template.userId !== session.userId) return ApiErrors.forbidden()

  await db.delete(templates).where(eq(templates.id, id))

  return success({ deleted: true })
}
```

### 2. Creating a Custom Hook

**Task**: Create `useTemplates` hook for template management

```typescript
// src/hooks/useTemplates.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  content: string
  createdAt: Date
}

export function useTemplates() {
  const queryClient = useQueryClient()

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Failed to fetch templates')
      return res.json() as Promise<Template[]>
    },
  })

  // Create template
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; content: string }) => {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template created')
    },
    onError: () => {
      toast.error('Failed to create template')
    },
  })

  // Update template
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; content: string }) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template updated')
    },
  })

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template deleted')
    },
  })

  return {
    templates,
    isLoading,
    createTemplate: createMutation.mutate,
    updateTemplate: updateMutation.mutate,
    deleteTemplate: deleteMutation.mutate,
  }
}
```

### 3. Adding Database Schema

**Task**: Add `castDrafts` table for auto-saved drafts

```typescript
// src/lib/db/schema.ts

export const castDrafts = sqliteTable(
  'cast_drafts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .references(() => accounts.id, { onDelete: 'cascade' }),
    content: text('content').default(''),
    mediaUrls: text('media_urls', { mode: 'json' }).$type<string[]>(),
    channelId: text('channel_id'),
    parentUrl: text('parent_url'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index('drafts_user_idx').on(table.userId),
    accountIdx: index('drafts_account_idx').on(table.accountId),
    updatedIdx: index('drafts_updated_idx').on(table.updatedAt),
  })
)

export const castDraftsRelations = relations(castDrafts, ({ one }) => ({
  user: one(users, {
    fields: [castDrafts.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [castDrafts.accountId],
    references: [accounts.id],
  }),
}))

export type CastDraft = typeof castDrafts.$inferSelect
export type NewCastDraft = typeof castDrafts.$inferInsert
```

Then generate and apply migration:

```bash
npm run db:generate  # Creates migration file
npm run db:push      # Applies to database
```

### 4. Creating a New Page

**Task**: Create `/analytics` page

```typescript
// src/app/(app)/analytics/page.tsx

import { Suspense } from 'react'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { castAnalytics, scheduledCasts } from '@/lib/db/schema'
import { eq, and, gte } from 'drizzle-orm'
import { subDays } from 'date-fns'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import { AnalyticsSkeleton } from '@/components/analytics/AnalyticsSkeleton'

export const metadata = {
  title: 'Analytics - Castor',
  description: 'Track your cast performance and engagement',
}

export const dynamic = 'force-dynamic'

async function fetchAnalytics(userId: string) {
  const thirtyDaysAgo = subDays(new Date(), 30)

  return await db.query.castAnalytics.findMany({
    where: and(
      eq(castAnalytics.userId, userId),
      gte(castAnalytics.publishedAt, thirtyDaysAgo)
    ),
    with: {
      cast: {
        columns: {
          content: true,
          publishedAt: true,
        },
      },
    },
    orderBy: (analytics, { desc }) => [desc(analytics.publishedAt)],
  })
}

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Analytics</h1>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent userId={session.userId} />
      </Suspense>
    </div>
  )
}

async function AnalyticsContent({ userId }: { userId: string }) {
  const analytics = await fetchAnalytics(userId)

  return <AnalyticsDashboard data={analytics} />
}
```

### 5. Adding Validation Schema

**Task**: Add validation for cast scheduling

```typescript
// src/lib/validations/index.ts

import { z } from 'zod'

export const scheduleCastSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  content: z.string().min(1, 'Content is required').max(4096, 'Content too long'),
  scheduledAt: z.string().datetime('Invalid date format'),
  channelId: z.string().optional(),
  parentUrl: z.string().url('Invalid parent URL').optional(),
  media: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['image', 'video']),
    mimeType: z.string(),
  })).max(4, 'Maximum 4 media attachments').optional(),
  idempotencyKey: z.string().optional(),
})

export type ScheduleCastInput = z.infer<typeof scheduleCastSchema>

// Helper for validation in API routes
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: NextResponse } {
  const result = schema.safeParse(data)

  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }))

    return {
      success: false,
      error: ApiErrors.validationFailed(errors),
    }
  }

  return { success: true, data: result.data }
}
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```
Error: LibsqlError: SQLITE_CANTOPEN: unable to open database file
```

**Solution**:
```bash
# Ensure database file exists
npm run db:push

# Check DATABASE_URL in .env
DATABASE_URL="file:local.db"
```

#### 2. Session/Authentication Issues

```
Error: Session expired or invalid
```

**Solution**:
- Ensure `SESSION_SECRET` is set in `.env` (min 32 characters)
- Check cookie settings in `src/lib/auth/index.ts`
- Clear browser cookies and re-authenticate

#### 3. API Rate Limiting

```
429 Too Many Requests
```

**Solution**:
- Rate limits are per-user, per-endpoint
- Wait for window to reset (1 minute for most endpoints)
- Check `src/lib/rate-limit.ts` for specific limits
- Disable in development: set `DISABLE_RATE_LIMIT=true` in `.env`

#### 4. Neynar API Errors

```
Error: Failed to publish cast - Invalid signer
```

**Solution**:
- Verify `NEYNAR_API_KEY` is set correctly
- Check signer status: `GET /api/accounts/check-signer`
- Re-create signer if expired: `POST /api/accounts/create-signer`

#### 5. Build Errors

```
Error: Module not found: Can't resolve '@/lib/...'
```

**Solution**:
- Check path alias in `tsconfig.json`
- Ensure file exists at specified path
- Restart TypeScript server in IDE

#### 6. Turbopack Issues

```
Error: Turbopack crashed
```

**Solution**:
```bash
# Use clean dev start
npm run dev:clean

# Or disable Turbopack temporarily
next dev -p 3001
```

### Debugging Tips

1. **Enable verbose logging**:
   ```typescript
   // src/lib/logger.ts
   export const logger = pino({
     level: process.env.LOG_LEVEL || 'debug'
   })
   ```

2. **Inspect database**:
   ```bash
   npm run db:studio
   # Opens visual database editor
   ```

3. **Check API responses**:
   ```typescript
   const response = await fetch('/api/endpoint')
   console.log('Status:', response.status)
   console.log('Body:', await response.json())
   ```

4. **React Query DevTools**:
   ```typescript
   // Already configured in QueryProvider
   // Open browser, look for React Query icon in bottom right
   ```

5. **Network tab**: Use browser DevTools Network tab to inspect requests/responses

---

## Additional Resources

### Documentation Links

- **Next.js**: https://nextjs.org/docs
- **Drizzle ORM**: https://orm.drizzle.team/docs
- **Neynar API**: https://docs.neynar.com
- **Farcaster Protocol**: https://docs.farcaster.xyz
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Radix UI**: https://www.radix-ui.com/docs
- **Vitest**: https://vitest.dev
- **Playwright**: https://playwright.dev

### Environment Variables Reference

```bash
# Database
DATABASE_URL="file:local.db"                    # SQLite file path
DATABASE_AUTH_TOKEN=""                          # Turso auth token (prod)

# Authentication
SESSION_SECRET=""                               # Min 32 chars, required in prod

# Farcaster
NEYNAR_API_KEY=""                               # Neynar API key
FARCASTER_DEVELOPER_MNEMONIC=""                 # For signer creation

# AI
GEMINI_API_KEY=""                               # Google Gemini API

# Media
CLOUDFLARE_ACCOUNT_ID=""                        # Cloudflare account
CLOUDFLARE_IMAGES_API_KEY=""                    # Images API key
CLOUDFLARE_STREAM_API_KEY=""                    # Stream API key
LIVEPEER_API_KEY=""                             # Alternative video

# Rate Limiting
UPSTASH_REDIS_REST_URL=""                       # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN=""                     # Upstash token

# Security
CRON_SECRET=""                                  # Protect cron endpoints
ALLOWED_FIDS=""                                 # Beta access (comma-separated)

# Development
LOG_LEVEL="info"                                # debug|info|warn|error
DISABLE_RATE_LIMIT="false"                      # Disable rate limiting
```

### Performance Optimization Tips

1. **Use Server Components** for data fetching
2. **Implement pagination** for large lists
3. **Use React Query** for caching server state
4. **Optimize images** with Next.js Image component
5. **Lazy load** heavy components with `dynamic()`
6. **Virtualize** long lists with `react-virtuoso`
7. **Prefetch** critical data with `queryClient.prefetchQuery()`
8. **Debounce** search inputs and auto-save operations

### Code Quality Checklist

Before submitting changes:

- [ ] TypeScript compilation passes (`npm run build`)
- [ ] Linter passes (`npm run lint`)
- [ ] Tests pass (`npm run test`)
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] Input validation with Zod schemas
- [ ] Rate limiting applied to API routes
- [ ] Authentication/authorization checks
- [ ] Database queries use indexes
- [ ] Transactions for multi-table operations
- [ ] Loading and error states in UI
- [ ] Responsive design tested
- [ ] Accessibility considered (ARIA labels, keyboard navigation)

---

## Conclusion

This guide covers the essential patterns, conventions, and workflows for contributing to Castor. When in doubt:

1. **Read existing code** - Follow established patterns
2. **Check this guide** - Refer to examples and conventions
3. **Ask questions** - Better to clarify than guess
4. **Test thoroughly** - Write tests, check edge cases
5. **Keep it simple** - Don't over-engineer solutions

Happy coding!
