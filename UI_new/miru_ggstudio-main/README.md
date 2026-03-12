# Miru Frontend Integration Guide

This frontend lives in `UI_new/miru_ggstudio-main` and is a `Vite + React + TypeScript` app, not a Next.js app.

The UI is already rebuilt, but the current code still contains old mock flows:

- `src/contexts/AuthContext.tsx` still uses mock tokens.
- `src/pages/Memories.tsx` and `src/pages/Therapy.tsx` still render mock data.

Use the backend in `../src` as the source of truth. The contract below is the safest "OpenAPI draft" for wiring the new UI to the current backend.

## 1. Runtime config

Install Zod first:

```bash
npm i zod
```

Frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:8008
VITE_WS_BASE_URL=ws://localhost:8008
```

Backend `.env` that should match this frontend:

```env
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
FRONTEND_URL=http://localhost:3000
GOOGLE_REDIRECT_URI=http://localhost:8008/auth/callback
```

Important:

- Vite dev server runs on port `3000`.
- Backend currently defaults `ALLOWED_ORIGINS` to port `8008`, so local dev will fail unless you change it.
- Google OAuth callback logic in the backend still comes from the old same-origin PWA flow. If you keep frontend and backend on different origins, patch the redirect logic or reverse-proxy them to the same host.

Recommended OAuth redirect patch in `src/auth_routes.py`:

```py
redirect_path = append_token(return_to, token)
redirect_url = f"{FRONTEND_URL.rstrip('/')}{redirect_path}"
response = RedirectResponse(url=redirect_url, status_code=302)
```

Without that patch, `AuthCallback.tsx` will not receive the `token` correctly in a separate Vite frontend setup.

## 2. What to replace in the new UI

- Replace `src/services/api.ts` with env-based URLs and Zod parsing.
- Replace mock auth inside `src/contexts/AuthContext.tsx` with `/auth/login`, `/auth/me`, `/auth/logout`, and `/api/user/me`.
- Replace direct Gemini chat in `src/pages/Chat.tsx` with:
  - `POST /api/chat/sessions/create-with-message`
  - `GET /api/chat/sessions/{user_id}`
  - `GET /api/chat/sessions/{session_id}/messages`
  - `WS /ws/chat/{user_id}`
- Replace mock memory data in `src/pages/Memories.tsx` with `/api/memories/*` and `/api/insights/timeline/*`.
- Replace mock therapy data in `src/pages/Therapy.tsx` with `/api/therapist/*`, `/api/moment/*`, `/api/journal/*`, and `/api/goals/*`.

Note on audio:

- The current backend chat API does not expose text-to-speech.
- The earlier direct Gemini TTS path has been removed from the main frontend runtime.
- If you want audio later, add a dedicated backend TTS endpoint instead of reintroducing direct browser-side model calls.

## 3. OpenAPI draft

This is a hand-written draft based on the current backend code. It is not generated automatically.

```yaml
openapi: 3.1.0
info:
  title: Miru Backend API
  version: 2026-03-10-draft
  description: Contract used by the rebuilt Vite frontend.
servers:
  - url: http://localhost:8008
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    User:
      type: object
      required: [id, email]
      properties:
        id:
          type: string
        email:
          type: string
        name:
          type: string
          nullable: true
        picture:
          type: string
          nullable: true
    CurrentUser:
      type: object
      required: [user]
      properties:
        user:
          allOf:
            - $ref: '#/components/schemas/User'
            - type: object
              properties:
                role:
                  type: string
                  enum: [client, therapist]
                  nullable: true
    ChatSession:
      type: object
      required: [id, title]
      properties:
        id:
          oneOf:
            - type: integer
            - type: string
        title:
          type: string
        date:
          type: string
        time:
          type: string
    ChatMessage:
      type: object
      required: [role, content]
      properties:
        id:
          oneOf:
            - type: integer
            - type: string
        role:
          type: string
          enum: [user, ai, assistant]
        content:
          type: string
        created_at:
          type: string
          format: date-time
    Goal:
      type: object
      required: [user_id, title]
      properties:
        id:
          type: integer
        user_id:
          type: string
        title:
          type: string
        description:
          type: string
          nullable: true
        due_date:
          type: string
          nullable: true
        completed:
          type: boolean
        created_at:
          type: string
          format: date-time
        completed_at:
          type: string
          format: date-time
          nullable: true
    JournalEntry:
      type: object
      required: [user_id, content]
      properties:
        id:
          type: integer
        user_id:
          type: string
        content:
          type: string
        title:
          type: string
          nullable: true
        mood:
          type: string
          nullable: true
        tags:
          type: array
          items:
            type: string
    DailyMoodCheckin:
      type: object
      required: [user_id, emotion_score]
      properties:
        user_id:
          type: string
        emotion_score:
          type: integer
          minimum: 1
          maximum: 10
        context_tags:
          type: array
          items:
            type: string
        note:
          type: string
          nullable: true
    MemoryItem:
      type: object
      additionalProperties: true
security:
  - bearerAuth: []
paths:
  /api/health:
    get:
      summary: Backend health
      responses:
        '200':
          description: OK

  /auth/login:
    get:
      summary: Start Google OAuth
      parameters:
        - in: query
          name: next
          schema:
            type: string
          description: Relative frontend path such as /auth/callback
      responses:
        '302':
          description: Redirect to Google consent screen

  /auth/callback:
    get:
      summary: Google OAuth callback
      parameters:
        - in: query
          name: code
          required: true
          schema:
            type: string
        - in: query
          name: state
          required: true
          schema:
            type: string
      responses:
        '302':
          description: Redirect with token query parameter

  /auth/me:
    get:
      summary: Current authenticated user
      responses:
        '200':
          description: Authenticated user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '401':
          description: Not authenticated

  /auth/logout:
    post:
      summary: Clear auth cookie
      responses:
        '200':
          description: Logout result

  /api/user/me:
    get:
      summary: Current authenticated user including role
      responses:
        '200':
          description: Current user and role
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CurrentUser'
        '401':
          description: Not authenticated

  /api/user/role:
    post:
      summary: Set role for current user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [role]
              properties:
                role:
                  type: string
                  enum: [client, therapist]
      responses:
        '200':
          description: Role updated

  /api/chat/sessions/{user_id}:
    get:
      summary: List chat sessions
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
        - in: query
          name: limit
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Sessions list
    post:
      summary: Create empty chat session
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
        - in: query
          name: title
          schema:
            type: string
      responses:
        '200':
          description: Created session

  /api/chat/sessions/create-with-message:
    post:
      summary: Create session with first user message
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [user_id, message]
              properties:
                user_id:
                  type: string
                message:
                  type: string
                images:
                  type: array
                  items:
                    type: object
                    additionalProperties: true
      responses:
        '200':
          description: Created session

  /api/chat/sessions/{session_id}/messages:
    get:
      summary: Get messages in one session
      parameters:
        - in: path
          name: session_id
          required: true
          schema:
            type: integer
        - in: query
          name: limit
          schema:
            type: integer
            default: 100
      responses:
        '200':
          description: Messages list

  /api/chat/sessions/{session_id}/title:
    put:
      summary: Rename chat session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title, user_id]
              properties:
                title:
                  type: string
                user_id:
                  type: string
      responses:
        '200':
          description: Rename result

  /api/memories/{user_id}:
    get:
      summary: Get all memories for one user
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Memory list
    delete:
      summary: Delete all memories for one user
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Delete result

  /api/memories/{user_id}/search:
    get:
      summary: Search memories
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
        - in: query
          name: q
          required: true
          schema:
            type: string
        - in: query
          name: limit
          schema:
            type: integer
            default: 5
      responses:
        '200':
          description: Search result

  /api/memories/{user_id}/patterns:
    get:
      summary: Analyze memory patterns
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Pattern analysis

  /api/memories/{user_id}/graph:
    get:
      summary: Knowledge graph for memories
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Graph data

  /api/memories/{user_id}/{memory_id}:
    put:
      summary: Update one memory
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
        - in: path
          name: memory_id
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [new_content]
              properties:
                new_content:
                  type: string
      responses:
        '200':
          description: Update result
    delete:
      summary: Delete one memory
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
        - in: path
          name: memory_id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Delete result

  /api/goals:
    post:
      summary: Create goal
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Goal'
      responses:
        '200':
          description: Goal created

  /api/goals/{user_id}:
    get:
      summary: List goals by user
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
        - in: query
          name: completed
          schema:
            type: boolean
      responses:
        '200':
          description: Goals list

  /api/journal/save:
    post:
      summary: Save journal entry
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/JournalEntry'
      responses:
        '200':
          description: Save result

  /api/journal/{user_id}:
    get:
      summary: List journal entries
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
        - in: query
          name: limit
          schema:
            type: integer
            default: 10
        - in: query
          name: offset
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Journal list

  /api/moment/daily-checkin:
    post:
      summary: Submit daily mood
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DailyMoodCheckin'
      responses:
        '200':
          description: Check-in result

  /api/moment/checkin-status/{user_id}:
    get:
      summary: Get today's check-in status
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Status result

  /api/moment/proactive-message/{user_id}:
    get:
      summary: Get proactive message
      parameters:
        - in: path
          name: user_id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Proactive message result

  /api/therapist:
    get:
      summary: Therapist routes exist under /api/therapist/*
      description: Treat the therapist module as legacy and validate responses with permissive Zod schemas until the router is normalized.
      responses:
        '200':
          description: Placeholder
```

## 4. Zod contracts

Create `src/services/contracts.ts`:

```ts
import { z } from 'zod';

export const IdSchema = z.union([z.string(), z.number()]);

export const ApiErrorSchema = z
  .object({
    detail: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
});

export const AuthMeSchema = UserSchema;

export const CurrentUserSchema = z.object({
  user: UserSchema.extend({
    role: z.enum(['client', 'therapist']).nullable().optional(),
  }),
});

export const SetRolePayloadSchema = z.object({
  role: z.enum(['client', 'therapist']),
});

export const ChatSessionSchema = z.object({
  id: IdSchema,
  title: z.string(),
  date: z.string().optional(),
  time: z.string().optional(),
});

export const ChatSessionsResponseSchema = z.object({
  success: z.boolean(),
  sessions: z.array(ChatSessionSchema),
  count: z.number().optional(),
  error: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  id: IdSchema.optional(),
  role: z.enum(['user', 'assistant', 'ai']),
  content: z.string(),
  created_at: z.string().optional(),
});

export const ChatMessagesResponseSchema = z.object({
  success: z.boolean(),
  messages: z.array(ChatMessageSchema),
  error: z.string().optional(),
});

export const CreateSessionWithMessageSchema = z.object({
  user_id: z.string(),
  message: z.string().min(1),
  images: z
    .array(
      z.object({
        base64: z.string(),
        mime_type: z.string(),
      })
    )
    .optional(),
});

export const CreatedSessionResponseSchema = z.object({
  success: z.boolean(),
  session: z
    .object({
      id: IdSchema,
      title: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export const MemoryItemSchema = z
  .object({
    id: IdSchema.optional(),
    memory: z.string().optional(),
    content: z.string().optional(),
    created_at: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const MemoryListResponseSchema = z.object({
  success: z.boolean(),
  memories: z.array(MemoryItemSchema),
  relations: z.array(z.unknown()).optional(),
});

export const MemoryPatternsResponseSchema = z.object({
  success: z.boolean(),
  patterns: z.record(z.string(), z.unknown()),
});

export const MemoryGraphResponseSchema = z.object({
  success: z.boolean(),
  graph: z.object({
    nodes: z.array(z.record(z.string(), z.unknown())),
    edges: z.array(z.record(z.string(), z.unknown())),
  }),
});

export const UpdateMemoryPayloadSchema = z.object({
  new_content: z.string().min(1),
});

export const GoalSchema = z
  .object({
    id: z.number().optional(),
    user_id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    completed: z.boolean().optional(),
    created_at: z.string().optional(),
    completed_at: z.string().nullable().optional(),
  })
  .passthrough();

export const GoalCreateSchema = z.object({
  user_id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  due_date: z.string().optional(),
});

export const GoalUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  completed: z.boolean().optional(),
});

export const GoalsResponseSchema = z.object({
  success: z.boolean(),
  goals: z.array(GoalSchema),
});

export const GoalMutationResponseSchema = z.object({
  success: z.boolean(),
  goal: GoalSchema.nullable().optional(),
});

export const JournalEntrySchema = z.object({
  user_id: z.string(),
  content: z.string().min(1),
  title: z.string().optional(),
  mood: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const JournalListResponseSchema = z.object({
  success: z.boolean(),
  entries: z.array(z.record(z.string(), z.unknown())),
});

export const SaveJournalResponseSchema = z
  .object({
    success: z.boolean(),
    id: z.number().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const DailyMoodCheckinSchema = z.object({
  user_id: z.string(),
  emotion_score: z.number().int().min(1).max(10),
  context_tags: z.array(z.string()).default([]),
  note: z.string().optional(),
});

export const DailyMoodCheckinResponseSchema = z
  .object({
    success: z.boolean(),
    streak: z.number().optional(),
    insight: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const CheckinStatusResponseSchema = z
  .object({
    success: z.boolean(),
    has_checked_in_today: z.boolean().optional(),
    streak: z.number().optional(),
    last_score: z.number().optional(),
    last_checkin_time: z.string().optional(),
  })
  .passthrough();

export const WsChatRequestSchema = z
  .object({
    message: z.string().optional(),
    session_id: IdSchema.optional(),
    images: z
      .array(
        z.object({
          base64: z.string(),
          mime_type: z.string(),
        })
      )
      .optional(),
    image_base64: z.string().optional(),
    image_mime_type: z.string().optional(),
  })
  .refine(
    (value) => Boolean(value.message?.trim() || value.images?.length || value.image_base64),
    'message or image is required'
  );

export const WsAiResponseSchema = z.object({
  type: z.literal('ai_response'),
  message: z.string(),
  crisis_level: z.string().nullable().optional(),
  timestamp: z.string(),
});

export const WsSaveErrorSchema = z.object({
  type: z.literal('save_error'),
  message: z.string(),
});

export const WsErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export const WsServerEventSchema = z.discriminatedUnion('type', [
  WsAiResponseSchema,
  WsSaveErrorSchema,
  WsErrorSchema,
]);

export const TherapistResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .passthrough();
```

## 5. Replace `src/services/api.ts`

Use env-based URLs and central Zod parsing:

```ts
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { z } from 'zod';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8008';

export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8008';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function parseApi<T>(
  request: Promise<AxiosResponse<unknown>>,
  schema: z.ZodType<T>
): Promise<T> {
  const response = await request;
  return schema.parse(response.data);
}
```

Example usage:

```ts
import { api, parseApi } from './api';
import {
  ChatMessagesResponseSchema,
  ChatSessionsResponseSchema,
  CurrentUserSchema,
} from './contracts';

export async function getCurrentUser() {
  return parseApi(api.get('/api/user/me'), CurrentUserSchema);
}

export async function getSessions(userId: string) {
  return parseApi(
    api.get(`/api/chat/sessions/${userId}`),
    ChatSessionsResponseSchema
  );
}

export async function getMessages(sessionId: string | number) {
  return parseApi(
    api.get(`/api/chat/sessions/${sessionId}/messages`),
    ChatMessagesResponseSchema
  );
}
```

## 6. WebSocket contract for chat

Backend endpoint:

```txt
ws://localhost:8008/ws/chat/{user_id}
```

Client event:

```json
{
  "message": "Hom nay toi thay hoi met",
  "session_id": 123,
  "images": [
    {
      "base64": "....",
      "mime_type": "image/jpeg"
    }
  ]
}
```

Server events:

```json
{
  "type": "ai_response",
  "message": "Minh dang o day voi ban.",
  "crisis_level": "low",
  "timestamp": "2026-03-10T07:20:00+00:00"
}
```

```json
{
  "type": "save_error",
  "message": "Khong the luu tin nhan"
}
```

```json
{
  "type": "error",
  "message": "Loi: ..."
}
```

Recommended socket helper:

```ts
import { WS_BASE_URL } from './api';
import {
  WsChatRequestSchema,
  WsServerEventSchema,
} from './contracts';

export function connectChatSocket(
  userId: string,
  onEvent: (event: ReturnType<typeof WsServerEventSchema.parse>) => void
) {
  const socket = new WebSocket(`${WS_BASE_URL}/ws/chat/${userId}`);

  socket.onmessage = (event) => {
    const parsed = WsServerEventSchema.parse(JSON.parse(event.data));
    onEvent(parsed);
  };

  return {
    socket,
    send(payload: unknown) {
      const parsed = WsChatRequestSchema.parse(payload);
      socket.send(JSON.stringify(parsed));
    },
    close() {
      socket.close();
    },
  };
}
```

## 7. File-by-file integration map

| UI file | Replace with backend contract | Notes |
| --- | --- | --- |
| `src/contexts/AuthContext.tsx` | `GET /auth/me`, `GET /api/user/me`, `POST /auth/logout` | Remove `mock-token-*` branches. |
| `src/pages/Login.tsx` | `window.location.href = \`${API_BASE_URL}/auth/login?next=/auth/callback\`` | Only works cleanly after the backend redirect caveat is solved. |
| `src/pages/AuthCallback.tsx` | Parse `?token=...`, store `access_token`, call `checkAuth()` | Keep this page. It is the correct place to land after OAuth. |
| `src/pages/Chat.tsx` | `GET /api/chat/sessions/{user_id}`, `GET /api/chat/sessions/{session_id}/messages`, `POST /api/chat/sessions/create-with-message`, `WS /ws/chat/{user_id}` | Remove `initChatSession()` and `sendChatMessage()`. |
| `src/pages/Memories.tsx` | `GET /api/memories/{user_id}`, `GET /api/memories/{user_id}/graph`, `GET /api/insights/timeline/{user_id}` | Search box should call `/api/memories/{user_id}/search?q=...`. |
| `src/pages/Therapy.tsx` | `/api/therapist/client/{client_id}/assignments`, `/api/moment/*`, `/api/journal/*`, `/api/goals/*` | The current screen is mock-only. |
| `src/pages/Home.tsx` | `GET /api/moment/checkin-status/{user_id}`, `GET /api/moment/proactive-message/{user_id}`, `GET /api/goals/{user_id}` | Add summary cards from real backend data. |
| `src/pages/Settings.tsx` | `GET /api/user/me`, `POST /api/user/role`, `POST /auth/logout` | Role switcher should use Zod on the response. |
| `src/pages/therapist/*` | `/api/therapist/*` | Validate with permissive schemas until therapist router is normalized. |

## 8. Suggested request wrappers

These helpers are enough for most pages:

```ts
import { api, parseApi } from './api';
import {
  AuthMeSchema,
  CheckinStatusResponseSchema,
  CreateSessionWithMessageSchema,
  ChatMessagesResponseSchema,
  ChatSessionsResponseSchema,
  CreatedSessionResponseSchema,
  CurrentUserSchema,
  DailyMoodCheckinResponseSchema,
  DailyMoodCheckinSchema,
  GoalsResponseSchema,
  GoalCreateSchema,
  GoalMutationResponseSchema,
  JournalEntrySchema,
  JournalListResponseSchema,
  MemoryGraphResponseSchema,
  MemoryListResponseSchema,
  MemoryPatternsResponseSchema,
  SaveJournalResponseSchema,
} from './contracts';

export const authApi = {
  me: () => parseApi(api.get('/auth/me'), AuthMeSchema),
  currentUser: () => parseApi(api.get('/api/user/me'), CurrentUserSchema),
  logout: () => api.post('/auth/logout'),
};

export const chatApi = {
  sessions: (userId: string) =>
    parseApi(api.get(`/api/chat/sessions/${userId}`), ChatSessionsResponseSchema),
  messages: (sessionId: string | number) =>
    parseApi(
      api.get(`/api/chat/sessions/${sessionId}/messages`),
      ChatMessagesResponseSchema
    ),
  createWithMessage: async (payload: unknown) =>
    parseApi(
      api.post(
        '/api/chat/sessions/create-with-message',
        CreateSessionWithMessageSchema.parse(payload)
      ),
      CreatedSessionResponseSchema
    ),
};

export const memoryApi = {
  list: (userId: string) =>
    parseApi(api.get(`/api/memories/${userId}`), MemoryListResponseSchema),
  graph: (userId: string) =>
    parseApi(api.get(`/api/memories/${userId}/graph`), MemoryGraphResponseSchema),
  patterns: (userId: string) =>
    parseApi(
      api.get(`/api/memories/${userId}/patterns`),
      MemoryPatternsResponseSchema
    ),
};

export const goalApi = {
  list: (userId: string) =>
    parseApi(api.get(`/api/goals/${userId}`), GoalsResponseSchema),
  create: async (payload: unknown) =>
    parseApi(
      api.post('/api/goals', GoalCreateSchema.parse(payload)),
      GoalMutationResponseSchema
    ),
};

export const journalApi = {
  list: (userId: string) =>
    parseApi(api.get(`/api/journal/${userId}`), JournalListResponseSchema),
  save: async (payload: unknown) =>
    parseApi(
      api.post('/api/journal/save', JournalEntrySchema.parse(payload)),
      SaveJournalResponseSchema
    ),
};

export const momentApi = {
  status: (userId: string) =>
    parseApi(
      api.get(`/api/moment/checkin-status/${userId}`),
      CheckinStatusResponseSchema
    ),
  dailyCheckin: async (payload: unknown) =>
    parseApi(
      api.post('/api/moment/daily-checkin', DailyMoodCheckinSchema.parse(payload)),
      DailyMoodCheckinResponseSchema
    ),
};
```

## 9. Known backend caveats

- `OAuth redirect` still assumes the older PWA deployment shape. Fix that before enabling real Google login in this Vite app.
- `Therapist API` is still a legacy router. Expect response variations and parse loosely.
- `Memory records` are not perfectly normalized in the database yet, so `MemoryItemSchema` should stay permissive.
- `Chat message roles` may come back as `ai` or `assistant`. Normalize in the UI layer.
- `Backend responses` are not fully uniform across all routers. Always parse with Zod and handle optional `error`, `detail`, and `message`.

## 10. Recommended order to wire the new UI

1. Fix backend CORS and OAuth redirect behavior.
2. Replace `src/services/api.ts` with env-based config.
3. Add `src/services/contracts.ts` and central Zod parsing.
4. Replace mock auth in `src/contexts/AuthContext.tsx`.
5. Replace `Chat.tsx` direct Gemini logic with session APIs plus WebSocket.
6. Replace `Memories.tsx` and `Therapy.tsx` mock data with real endpoints.
7. Wire therapist pages last, because that module is the least normalized right now.

This README is the current backend contract for the rebuilt frontend. If backend routes change, update this file first before touching UI pages.
