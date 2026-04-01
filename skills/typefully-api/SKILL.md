---
name: typefully-api
description: Use the Typefully API to create, schedule, publish, update, and inspect social drafts/posts with deterministic HTTP workflows and safe validation. Use when a user asks to automate Typefully publishing, sync content, or operate Typefully drafts/posts programmatically.
---

# Typefully API

Use this skill when tasks involve operating Typefully via API, not manual UI clicks.

## Quick Workflow

1. Confirm `TYPEFULLY_API_KEY` is available in environment.
2. Read endpoint details from `references/typefully-api.md`.
3. Use `scripts/typefully_request.sh` for authenticated API calls.
4. Validate response status and payload before reporting success.
5. For mutating requests, echo back IDs, timestamps, and resulting state.

## Required Conventions

- Always send auth via `Authorization: Bearer $TYPEFULLY_API_KEY`.
- Fail fast on non-2xx responses; surface API body in error output.
- For write operations, print a compact result summary:
  - `id`
  - `status` (draft/scheduled/published when available)
  - relevant time fields
- Never claim success without API confirmation.

## Common Operations

- Create draft/post
- Schedule content
- Publish now
- Update an existing draft/post
- Retrieve details by ID
- List/filter drafts/posts

Use endpoint payloads from `references/typefully-api.md` and keep request bodies explicit in the command output.

## Resources

- API reference notes: `references/typefully-api.md`
- Request helper: `scripts/typefully_request.sh`
