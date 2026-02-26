# Release Guardrails (PR2)

This repo enforces a strict release path:

1. PR must include a **Release Message (Required)** section.
2. PR must pass Netlify Preview and smoke checks (`/api/health`, `/api/cron/publish`).
3. After merge to `main`, production smoke checks run automatically.
4. If production smoke checks fail, rollback is triggered automatically.

## Required GitHub Secrets

- `CRON_SECRET`
- `NETLIFY_SITE_ID`
- `NETLIFY_AUTH_TOKEN`
- `DISCORD_WEBHOOK_URL` (optional but recommended for rollback notifications)

## Workflows

- `.github/workflows/pr-release-gate.yml`
  - validates PR release message
  - waits for `netlify/castorapp/deploy-preview`
  - runs smoke checks against preview URL

- `.github/workflows/main-production-guard.yml`
  - runs production smoke checks after push to `main`
  - retries for up to ~2 minutes
  - triggers Netlify rollback on failure
  - sends Discord notification when rollback is triggered

## Local equivalents

```bash
npm run ci:smoke -- --base-url https://castorapp.xyz --cron-secret "$CRON_SECRET"
npm run ci:rollback
```
