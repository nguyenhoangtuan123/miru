# AGENTS.md

## Project Overview

Miru is now a three-surface application:

- Backend: FastAPI app under `src/`
- Miru App: Vite + React + TypeScript under `UI_new/miru_ggstudio-main/`
- Miru Community: Next.js public/community surface under `UI_public/miruai-public-next/`

Use these mental models when working in the repo:

- `Miru App` is the private/action surface:
  - chat
  - therapy
  - therapist portal
  - contact composer
  - profile editing
- `Miru Community` is the canonical public surface:
  - landing
  - article library
  - article detail
  - therapist directory
  - therapist public profile
  - article AI companion
  - public Q&A under articles
- FastAPI is the shared backend for both frontends.

This repo is no longer "Vite only". Treat it as:

- a Vite SPA for the app experience
- a Next app for the public/community experience

## Main Entry Points

- Backend app: `src/app.py`
- Backend shim: `pwa_server.py`
- App frontend entry: `UI_new/miru_ggstudio-main/src/App.tsx`
- Community frontend entry: `UI_public/miruai-public-next/app/layout.tsx`
- Chat WebSocket route: `src/routers/chat.py`
- Public article routes: `src/article_routes.py`
- Public/community routes: `src/public_content_routes.py`
- Public therapist profile routes: `src/profile_routes.py`
- Therapist contact request routes: `src/contact_request_routes.py`
- Therapist verification routes: `src/therapist_verification_routes.py`
- Assessment routes: `src/assessment_routes.py`
- Therapist sharing routes: `src/therapist_sharing_routes.py`
- Treatment program routes: `src/treatment_program_routes.py`
- Push/Web Push routes: `src/push_routes.py`
- Proactive push scheduler: `src/proactive_push_service.py`

## Local Run Commands

### Backend

```powershell
uvicorn app:app --app-dir src --host 0.0.0.0 --port 8008
```

### Miru App (Vite)

```powershell
cd UI_new\miru_ggstudio-main
npm run dev
```

### Miru Community (Next)

```powershell
cd UI_public\miruai-public-next
npm run dev -- --port 3001
```

## Local URL Expectations

- Miru App URL: `http://localhost:3000`
- Miru Community URL: `http://localhost:3001`
- Backend API URL: `http://localhost:8008`
- WebSocket URL: `ws://localhost:8008`

Google OAuth still redirects to the backend callback endpoint first. From there, the user is returned to the correct frontend route.

## Frontend Notes

### Miru App (Vite)

Important files:

- `UI_new/miru_ggstudio-main/src/App.tsx`
- `UI_new/miru_ggstudio-main/src/contexts/AuthContext.tsx`
- `UI_new/miru_ggstudio-main/src/services/api.ts`
- `UI_new/miru_ggstudio-main/src/services/backend.ts`
- `UI_new/miru_ggstudio-main/src/services/contracts.ts`
- `UI_new/miru_ggstudio-main/src/pages/Login.tsx`
- `UI_new/miru_ggstudio-main/src/pages/PublicReturn.tsx`
- `UI_new/miru_ggstudio-main/src/pages/ConnectTherapist.tsx`
- `UI_new/miru_ggstudio-main/src/pages/therapist/Articles.tsx`
- `UI_new/miru_ggstudio-main/src/pages/therapist/Profile.tsx`
- `UI_new/miru_ggstudio-main/src/pages/therapist/ContactRequests.tsx`
- `UI_new/miru_ggstudio-main/src/components/TherapistLayout.tsx`

Key app responsibilities:

- authenticated client experience
- authenticated therapist experience
- therapist article studio
- therapist profile studio
- therapist inbox/contact requests
- auth callback handling
- public-to-app bridge routes:
  - `/public-return`
  - `/connect/therapist`

### Miru Community (Next)

Important files:

- `UI_public/miruai-public-next/app/layout.tsx`
- `UI_public/miruai-public-next/app/page.tsx`
- `UI_public/miruai-public-next/app/bai-viet/page.tsx`
- `UI_public/miruai-public-next/app/bai-viet/[slug]/page.tsx`
- `UI_public/miruai-public-next/app/therapists/page.tsx`
- `UI_public/miruai-public-next/app/therapists/[therapistId]/page.tsx`
- `UI_public/miruai-public-next/components/public/PublicHeader.tsx`
- `UI_public/miruai-public-next/components/public/ArticleAiCompanion.tsx`
- `UI_public/miruai-public-next/components/public/ArticleCommunityQuestions.tsx`
- `UI_public/miruai-public-next/components/public/PublicLoginUpliftLink.tsx`
- `UI_public/miruai-public-next/components/public/PublicTherapistActionLink.tsx`
- `UI_public/miruai-public-next/lib/api.ts`
- `UI_public/miruai-public-next/lib/public-auth.ts`
- `UI_public/miruai-public-next/lib/public-events.ts`
- `UI_public/miruai-public-next/lib/stage-cta.ts`

Key community responsibilities:

- canonical public landing and content surface
- article browsing and reading
- therapist public discovery
- article AI companion
- article-level public Q&A
- stage-aware CTA rendering
- public auth token capture and return-from-login behavior

## Current Frontend Features

### Shared product features

- Therapist public discovery exists before pairing
- Therapist contact request flow is separate from pairing
- Therapists can publish public-facing profile data
- Assessments support therapist assignment and client submission
- Treatment plans support therapist edit and client read-only published view

### Miru App features

- Chat UI supports assistant thinking state and chunked streaming over WebSocket
- The app is packaged as a PWA with manifest + service worker
- Notification permission in settings attempts real Web Push subscription sync
- Therapist/client event polling notifications still exist, but Web Push is preferred
- Therapist onboarding has separate apply/review-status flow before full portal access
- Therapist portal contains:
  - dashboard
  - clients
  - messages
  - appointments
  - profile studio
  - community article studio
  - contact requests inbox
- App routes now include public/community bridge routes:
  - `/public-return`
  - `/connect/therapist`

### Miru Community features

- Community landing page runs in Next
- Public article library runs in Next
- Public article detail runs in Next
- Public therapist directory runs in Next
- Public therapist profile runs in Next
- Article detail includes:
  - AI companion
  - related content / flywheel sections
  - author card
  - public Q&A under the article
- Community CTA surfaces can route users into:
  - app login
  - therapist connect composer
  - therapist article studio
  - therapist profile editing

## Backend Notes

- Active therapist routes live in `src/therapist_routes.py`
- Active therapist service lives in `src/therapist_service.py`
- Public therapist profile logic lives in `src/profile_service.py`
- Therapist contact request creation is exposed from `src/contact_request_routes.py`
- Therapist inbox handling for contact requests lives in `src/therapist_routes.py` and `src/profile_service.py`
- Therapist verification logic lives in `src/therapist_verification_service.py`
- Assessment logic lives in `src/assessment_service.py` and `src/assessment_definitions.py`
- Therapist data sharing logic lives in `src/therapist_sharing_service.py`
- Treatment plan logic lives in `src/treatment_program_service.py`
- Public article CRUD + review flow lives in `src/article_routes.py` and `src/article_service.py`
- Public community/event/article-AI/Q&A logic lives in:
  - `src/public_content_routes.py`
  - `src/public_content_service.py`
- AI crisis logging is wired from `src/agent_graph.py`
- Memory features run directly inside the main backend
- Memory and insight helpers run directly inside the main backend
- Web Push sending logic lives in `src/push_service.py`
- Push subscription APIs live in `src/push_routes.py`
- Proactive 12-hour push logic lives in `src/proactive_push_service.py`
- Backend chat sends `thinking`, `ai_chunk`, and final `ai_response` events from `src/routers/chat.py`

## Community / Article Backend Behavior

- Therapist article flow:
  - create draft
  - update draft
  - submit for review
  - approve / reject
  - archive
- Public articles are only visible once published
- Public event logging supports anonymous and authenticated readers
- Public identity aliasing links anonymous reader history to authenticated users after login
- Article AI supports:
  - anonymous monthly quota
  - signed-in monthly quota
  - article-aware prompting
  - Q&A-aware prompting
- Public Q&A under articles supports:
  - submit question
  - pending review
  - publish
  - answer
  - hide
- Therapist sees article analytics and community question inbox in the app portal

## Auth / Stage Bridge Notes

- App auth state is managed in `UI_new/miru_ggstudio-main/src/contexts/AuthContext.tsx`
- The app uses `pending_role` to preserve login intent across OAuth
- `PublicReturn.tsx` bridges from app auth back to Community
- `ConnectTherapist.tsx` is the private/action composer reached from Community CTA
- Community captures `miru_token` from the URL and stores public auth state client-side
- Community CTA behavior is stage-aware and should distinguish:
  - anonymous
  - client
  - therapist
- `GET /api/user/me` is the backend source of truth for resolved user role and therapist access state

## Push / PWA Behavior

- Browser push subscriptions are stored in `push_subscriptions`
- The Vite app subscribes through `PushManager` after notification permission is granted
- Service worker handles `push` and `notificationclick`
- Backend can push for:
  - AI chat response
  - therapist message to client
  - client message to therapist
  - assignment created
  - AI crisis alert
  - proactive 12-hour inactivity check-in

## Proactive AI Behavior

- The old proactive API still exists for on-demand UI fetches
- Real proactive push now runs in the backend as a background scheduler
- Default inactivity threshold is controlled by env:
  - `PROACTIVE_PUSH_INACTIVITY_HOURS`
  - `PROACTIVE_PUSH_POLL_MINUTES`
- The scheduler builds messages using:
  - short-term memory from session `facts.txt`
  - long-term memory from Mem0 via `memory_service.get_all_memories`

## Required Environment For Real Push

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_CLAIMS_SUBJECT`
- `ENABLE_PROACTIVE_PUSH=true`
- Optional tuning:
  - `PROACTIVE_PUSH_INACTIVITY_HOURS=12`
  - `PROACTIVE_PUSH_POLL_MINUTES=15`

If these are missing, push APIs should fail gracefully and proactive push will not deliver.

## Therapist Pairing / Contact Behavior

- Therapist generates a pairing code from therapist settings
- Client connects using the code from client settings
- If the database schema does not support pending pairing codes, the backend falls back to `pairing_codes.json` in the repo root
- Public therapist discovery can happen before pairing through Community profiles and article CTA flows
- Client-side contact requests are separate from pairing
- Community can route into app-side contact composer before any pairing exists
- Therapist-only flows must continue to check active therapist-client relationships before exposing client context, assessments, or treatment-plan editing

## Profile / Verification / Treatment Features

- Public therapist profile media is split from therapist verification evidence
- Public therapist profiles support:
  - service mode
  - starting price
  - public workflow steps
  - contact request availability
- Therapist verification requires an approved reviewer before full portal access
- Therapist sharing consent is stored separately from general app consent and can expose `none`, `ai_report`, or `direct` access levels
- Assessment templates are seeded and scored in-app; wording should remain screening-oriented rather than diagnostic
- Treatment plans are per-client, therapist-authored, and only become client-visible after publish

## Migrations To Know About

- `018_add_profile_features.sql`
- `019_add_push_subscriptions.sql`
- `020_add_contact_requests_and_public_offering.sql`
- `020_add_therapist_verification.sql`
- `021_backfill_existing_public_therapists_as_approved.sql`
- `022_add_assessments.sql`
- `023_add_therapist_sharing_preferences.sql`
- `024_add_treatment_programs.sql`
- `028_add_therapist_articles.sql`
- `029_add_public_content_flywheel.sql`
- `030_add_public_article_questions.sql`
- `031_add_contact_request_entry_intent.sql`

Note: there are currently two migrations with the `020_` prefix. Treat both as required when syncing a fresh environment.

## Current Constraints

- Real environments may lag behind repo migrations
- Some therapist tables may be missing columns like `user_id` or `pairing_code`
- Code should prefer schema-tolerant fallbacks instead of assuming migrations were fully applied
- `push_subscriptions` must exist in the database for Web Push to persist subscriptions
- `pywebpush` is required by backend push delivery
- Proactive push state is stored locally in `proactive_push_state.json`
- Community features depend on article/public-content tables from migrations `028` to `031`

## Working Rules

- Prefer editing files in `src/` for backend changes
- Prefer editing files in `UI_new/miru_ggstudio-main/src/` for app changes
- Prefer editing files in `UI_public/miruai-public-next/` for community changes
- If a file grows too long, too dense, or too hard to reason about, split it into smaller files/components instead of continuing to pile more logic into one place
- Do not reintroduce legacy frontend folders or old public surface ownership
- Canonical public surface is the Next Community app
- Vite public therapist routes are no longer the primary public surface and should not become canonical again
- Vercel deploys:
  - app SPA deploys should run from `UI_new/miru_ggstudio-main/`
  - Community deploys should run from `UI_public/miruai-public-next/`
- SPA rewrites for the Vite app are defined in `UI_new/miru_ggstudio-main/vercel.json`
- Keep auth redirects aligned with:
  - backend callback: `/auth/callback`
  - app callback route: `/auth/callback`
  - community return bridge: `/public-return`

## Verification

After meaningful backend changes, run:

```powershell
python -m py_compile src\app.py src\article_routes.py src\article_service.py src\public_content_routes.py src\public_content_service.py src\profile_routes.py src\profile_service.py src\therapist_routes.py src\therapist_service.py src\therapist_verification_routes.py src\therapist_verification_service.py src\assessment_routes.py src\assessment_service.py src\assessment_definitions.py src\therapist_sharing_routes.py src\therapist_sharing_service.py src\treatment_program_routes.py src\treatment_program_service.py src\contact_request_routes.py src\push_routes.py src\push_service.py src\proactive_push_service.py src\routers\chat.py
```

After meaningful app changes, run:

```powershell
cd UI_new\miru_ggstudio-main
npm run lint
npm run build
```

After meaningful Community changes, run:

```powershell
cd UI_public\miruai-public-next
npm run build
```

Note: frontend build commands may require elevated execution in restricted environments.

## Practical Test Order

1. Login through the app and confirm `/api/user/me` resolves the correct role
2. Test Community -> login -> `/public-return` -> Community restore flow
3. Test Community article AI on a published article
4. Test article Q&A submission and therapist moderation flow
5. Test Community therapist CTA -> `/connect/therapist` -> therapist inbox flow
6. Test therapist article create -> submit -> admin approve -> public visibility
7. Test therapist profile public rendering on Community
8. Test app chat streaming in `/chat`
9. Confirm push subscription save works through `/api/push/config` and `/api/push/subscribe`
10. Test therapist/client message push and assignment push
11. Lower `PROACTIVE_PUSH_INACTIVITY_HOURS` temporarily to validate proactive AI push quickly
