# AGENTS.md

## Project Overview

Miru is a split frontend/backend application:

- Backend: FastAPI app under `src/`
- Frontend: Vite + React + TypeScript under `UI_new/miru_ggstudio-main/`

This repo is not Next.js. Treat the frontend as a Vite SPA.

## Main Entry Points

- Backend app: `src/app.py`
- Backend shim: `pwa_server.py`
- Frontend app: `UI_new/miru_ggstudio-main/src/App.tsx`
- Chat WebSocket route: `src/routers/chat.py`
- Push/Web Push routes: `src/push_routes.py`
- Proactive push scheduler: `src/proactive_push_service.py`

## Local Run Commands

### Backend

```powershell
uvicorn app:app --app-dir src --host 0.0.0.0 --port 8008
```

### Frontend

```powershell
cd UI_new\miru_ggstudio-main
npm run dev
```

## Frontend Notes

- Frontend base URL is expected to be `http://localhost:3000`
- Backend API base URL is expected to be `http://localhost:8008`
- WebSocket base URL is expected to be `ws://localhost:8008`
- Auth callback returns to the frontend, but Google redirect must point to the backend callback endpoint

Important files:

- `UI_new/miru_ggstudio-main/src/services/backend.ts`
- `UI_new/miru_ggstudio-main/src/services/contracts.ts`
- `UI_new/miru_ggstudio-main/src/contexts/AuthContext.tsx`
- `UI_new/miru_ggstudio-main/src/contexts/PwaContext.tsx`
- `UI_new/miru_ggstudio-main/src/lib/notifications.ts`
- `UI_new/miru_ggstudio-main/public/sw.js`
- `UI_new/miru_ggstudio-main/src/pages/Chat.tsx`

## Current Frontend Features

- Chat UI supports assistant thinking state and chunked streaming over WebSocket
- The app is packaged as a PWA with manifest + service worker
- Notification permission in settings now also attempts real Web Push subscription sync
- Therapist/client event polling notifications still exist, but real Web Push is now the preferred path for background delivery

## Backend Notes

- Active therapist routes live in `src/therapist_routes.py`
- Active therapist service lives in `src/therapist_service.py`
- AI crisis logging is wired from `src/agent_graph.py`
- Memory features run directly inside the main backend and no longer require a sidecar
- Memory and insight helpers now run directly inside the main backend
- Web Push sending logic lives in `src/push_service.py`
- Push subscription APIs live in `src/push_routes.py`
- Proactive 12-hour push logic lives in `src/proactive_push_service.py`
- Backend chat sends `thinking`, `ai_chunk`, and final `ai_response` events from `src/routers/chat.py`

## Push / PWA Behavior

- Browser push subscriptions are stored in `push_subscriptions`
- Frontend subscribes through `PushManager` after notification permission is granted
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

## Therapist Pairing Behavior

- Therapist generates a pairing code from therapist settings
- Client connects using the code from client settings
- If the database schema does not support pending pairing codes, the backend falls back to `pairing_codes.json` in the repo root

## Current Constraints

- The database schema in real environments may be older than the migrations in this repo
- Some therapist tables may be missing columns like `user_id` or `pairing_code`
- Code should prefer schema-tolerant fallbacks instead of assuming migrations were fully applied
- `push_subscriptions` must exist in the database for Web Push to persist subscriptions
- `pywebpush` is now required by backend push delivery
- Proactive push state is stored locally in `proactive_push_state.json`

## Working Rules

- Prefer editing files in `src/` for backend changes
- Prefer editing files in `UI_new/miru_ggstudio-main/src/` for frontend changes
- Do not reintroduce legacy frontend folders or PWA static mounts
- Keep auth redirects aligned with:
  - backend callback: `/auth/callback`
  - frontend callback route: `/auth/callback`

## Verification

After meaningful changes, run:

```powershell
python -m py_compile src\app.py src\therapist_routes.py src\therapist_service.py src\push_routes.py src\push_service.py src\proactive_push_service.py src\routers\chat.py
cd UI_new\miru_ggstudio-main
npm run lint
npm run build
```

Note: `npm run build` may require elevated execution in restricted environments.

## Practical Test Order

1. Login and enable notifications in client settings or therapist settings
2. Confirm subscription save works through `/api/push/config` and `/api/push/subscribe`
3. Test chat streaming in `/chat`
4. Test therapist message push
5. Test assignment push
6. Test crisis alert push
7. Lower `PROACTIVE_PUSH_INACTIVITY_HOURS` temporarily to validate proactive AI push quickly
