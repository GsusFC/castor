# Silver Path: Business Accounts (connect → share → AI context → analytics → publish)

Created: 2025-12-19

Audience:
- Product
- Frontend
- Backend
- QA

This document defines the **silver path** (end-to-end happy path) for an agency/manager workflow in Castor.

---

## 0) Core model assumptions

- A user logs in with their **personal** Farcaster account.
- Personal accounts are **not shared**.
- Users can connect **business** accounts, which **can be shared** with other collaborators using roles/permissions.
- All operations that mutate state (schedule/publish/edit/cancel) are **always executed against an explicit account**.

---

## 1) Entry points

### 1.1 Primary entry points
- `/accounts`:
  - View all connected accounts (owned + invited).
  - CTA: **Connect business account**.

- `/studio`:
  - Operational hub to manage scheduling/publishing.
  - Default focus should be on business operations.

### 1.2 Secondary entry points
- AI Brand Context: `/accounts/:id/context` (today) → (future) `/accounts/:id/ai`.
- Analytics: `/analytics` (today) → (future) `/accounts/:id/analytics`.

---

## 2) Step-by-step silver path

### Step 1 — Connect a business account (Farcaster)
**Goal:** create/attach a business Farcaster identity to the current user.

**User action:**
- From `/accounts` (or `/studio`), click **Add account**.

**System behavior (current code):**
- UI opens `ConnectAccountModal`.
- Backend:
  1) `POST /api/accounts/create-signer`
     - Creates signer request + returns deep link for approval.
  2) `POST /api/accounts/check-signer`
     - Poll signer status.
     - When approved:
       - fetch Farcaster user by FID
       - create or update account in DB

**Data created/updated:**
- `accounts` row created or updated:
  - `fid`, `username`, `pfpUrl`, `signerUuid`, `signerStatus='approved'`

**Decision point (important):**
- Account **must be marked as `type='business'`** for this flow.
  - Today `check-signer` defaults to `type='personal'`.
  - To align with monetization model, the connect modal should ask:
    - “Personal (your own)” vs “Business (shareable)”.
  - Silver path assumes “Business”.

**Success criteria:**
- Business account appears in `/accounts` and can be selected in `/studio`.

---

### Step 2 — Share the business account (team + permissions)
**Goal:** invite collaborators to help operate the business account.

**User action:**
- Navigate to account access management (current location TBD; conceptually `/accounts/:id/team`).

**System behavior:**
- Owner invites a user by username.
- System creates `accountMembers` row with role/permissions.

**Permissions model (current):**
- Access checks exist via `accountMembers` + `canAccess`.
- Context editing also checks membership flags (`canEditContext` / role admin).

**Success criteria:**
- Invited user sees the account in their `/accounts` and can act according to role.

---

### Step 3 — Complete AI Context (Brand Mode)
**Goal:** make AI suggestions consistent with the business brand.

**User action:**
- Go to `/accounts/:id/context`.
- Fill:
  - BrandVoice
  - AlwaysDo / NeverDo
  - Hashtags
  - Default tone/language

**System behavior:**
- `PUT /api/accounts/:id/context` stores into `account_knowledge_base`.
- AI endpoints that receive `accountId` (e.g. `/api/ai/assistant`) load KB via `castor-ai.ts` and include it in prompts.

**Success criteria:**
- Brand Mode gating turns “ON” (brandVoice present).

---

### Step 4 — Analytics (per account)
**Goal:** review performance and inform future publishing.

**User action:**
- Navigate to analytics view.

**Current routing:**
- `/analytics` is global.

**Target routing (recommended):**
- `/accounts/:id/analytics` to keep the mental model: analytics are scoped to a specific business account.

**Data sources:**
- `cast_analytics` table is written on publish.
- Additional analytics sources may come from Neynar API.

**Success criteria:**
- Operator can answer: “What performed best for @brand1?”

---

### Step 5 — Publish / Schedule (always with explicit account)
**Goal:** schedule/publish content safely and predictably.

#### 5.1 Schedule
**User action:**
- In `/studio`, open composer and select an account.
- Schedule cast.

**System behavior:**
- `POST /api/casts/schedule`
  - validates `accountId`
  - validates signerStatus approved
  - writes `scheduled_casts` row (`status='scheduled'`)

**Success criteria:**
- Cast appears in Queue/Calendar for that account.

#### 5.2 Publish (manual)
**User action:**
- Publish now.

**System behavior:**
- `POST /api/casts/publish`
  - validates signer approved
  - calls Farcaster publish via signer
  - writes `cast_analytics` best-effort

#### 5.3 Publish (automatic)
**System behavior:**
- Cron triggers `/api/cron/publish` → `publishDueCasts()`.
- Publisher selects due casts (`scheduled`/`retrying` with `scheduledAt <= now`).

---

## 3) “Publish with account?” — invariants

### Invariant A — Every mutation is account-scoped
- schedule/edit/reschedule/cancel/publish requires `accountId`.

### Invariant B — UI must always show which account you are operating
- In multi-account views (e.g. `/studio`), every cast row must show:
  - account avatar + @username

### Invariant C — No accidental operations on “All accounts”
- “All” views are for browsing.
- Actions that publish or mutate should require selecting/deriving a concrete account from the cast row.

---

## 4) MVP scope vs phase 2

### MVP
- Connect business account
- Share business account
- Fill AI context
- Schedule/publish
- Ops visibility via `/studio` (Needs attention / Queue / Activity)

### Phase 2
- Per-account analytics routes (`/accounts/:id/analytics`)
- BrandVoice warnings in Studio (requires KB join)
- More granular permission model (`canModify`, editor vs viewer)

---

## 5) Appendix: relevant code pointers

- Accounts list:
  - `src/app/(app)/accounts/page.tsx`
  - `src/app/(app)/accounts/add-account-button.tsx`
  - `src/components/accounts/ConnectAccountModal`

- Signer connect:
  - `src/app/api/accounts/create-signer/route.ts`
  - `src/app/api/accounts/check-signer/route.ts`

- AI context:
  - `src/app/(app)/accounts/[id]/context/ContextEditor.tsx`
  - `src/app/api/accounts/[id]/context/route.ts`

- Scheduling:
  - `src/app/(app)/studio/page.tsx`
  - `src/app/(app)/studio/UnifiedDashboard.tsx`
  - `src/app/api/casts/schedule/route.ts`
  - `src/app/api/casts/[id]/route.ts`

- Publisher:
  - `src/lib/publisher.ts`
