# Miru - Kiến Trúc Hệ Thống

> **Tài liệu mô tả kiến trúc tổng thể của dự án Miru**  
> Cập nhật: 2026-02-06

---

## 📋 Tổng Quan

**Miru** là một ứng dụng AI Mental Health Assistant, được xây dựng theo mô hình **Modular Monolith** - một ứng dụng monolith được tổ chức theo các module chức năng rõ ràng.

### Tại sao là Modular Monolith?

| Tiêu chí | Miru | Monolith thuần | Microservices |
|----------|------|----------------|---------------|
| Deployment | Single process | Single process | Multiple processes |
| Database | Shared (Supabase) | Shared | Separate per service |
| Module boundaries | Rõ ràng (folders) | Không rõ | Cực kỳ rõ |
| Inter-module comms | Direct imports | Direct imports | HTTP/gRPC/Message Queue |

Miru có module boundaries rõ ràng (đặc biệt `therapist/`) nhưng tất cả chạy trong cùng process và chia sẻ database → **Modular Monolith**.

---

## 🏗️ Sơ Đồ Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ pwa/                        │  therapist_UI/                 │   │
│  │ ├── chat.html               │  ├── dashboard.html            │   │
│  │ ├── home.html               │  ├── patients.html             │   │
│  │ ├── insights.html           │  └── styles.css                │   │
│  │ ├── memories.html           │                                │   │
│  │ ├── js/  (JavaScript)       │                                │   │
│  │ └── css/ (Styling)          │                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                         │                    │                      │
│                   HTTP/WebSocket          HTTP                      │
│                         ▼                    ▼                      │
├─────────────────────────────────────────────────────────────────────┤
│                    API GATEWAY LAYER                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ pwa_server.py                                                │   │
│  │ ├── FastAPI application                                      │   │
│  │ ├── CORS middleware                                          │   │
│  │ ├── Static file serving                                      │   │
│  │ └── Router mounting (all *_router)                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
├──────────────────────────────┼──────────────────────────────────────┤
│                        ROUTER LAYER                                 │
│  ┌────────────┐  ┌─────────────┐  ┌───────────────┐                 │
│  │ routers/   │  │ *_routes.py │  │ therapist/    │                 │
│  │ ├─ chat.py │  │ ├─ auth     │  │ └─ routes/    │                 │
│  │ ├─ journal │  │ ├─ memory   │  │    ├─ main.py │                 │
│  │ ├─ insights│  │ ├─ proactive│  │    └─ ...     │                 │
│  │ ├─ goals   │  │ ├─ user     │  │               │                 │
│  │ └─ pages   │  │ └─ therapist│  │               │                 │
│  └────────────┘  └─────────────┘  └───────────────┘                 │
│         │                │                 │                        │
├─────────┼────────────────┼─────────────────┼────────────────────────┤
│         ▼                ▼                 ▼                        │
│                    SERVICE LAYER                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Core Services:                                               │   │
│  │ ├── chat_manager.py      → Chat session management           │   │
│  │ ├── ai_service.py        → Gemini/Google AI integration      │   │
│  │ ├── memory_service.py    → Mem0 memory management            │   │
│  │ ├── user_service.py      → User profile management           │   │
│  │ ├── crisis_detector.py   → Crisis level detection            │   │
│  │ ├── notification_service → Push notifications                │   │
│  │ └── proactive_service.py → Proactive AI interactions         │   │
│  │                                                              │   │
│  │ AI Orchestration:                                            │   │
│  │ └── agent_graph.py       → LangGraph Multi-Agent System      │   │
│  │     ├── crisis_check_node                                    │   │
│  │     ├── memory_retrieval_node                                │   │
│  │     ├── empathy_response_node                                │   │
│  │     └── action_node                                          │   │
│  │                                                              │   │
│  │ Therapist Module (Bounded Context):                          │   │
│  │ └── therapist/                                               │   │
│  │     ├── service.py        → Business logic                   │   │
│  │     ├── models.py         → Data models                      │   │
│  │     └── security.py       → Auth & permissions               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
├──────────────────────────────┼──────────────────────────────────────┤
│                      DATA ACCESS LAYER                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ database.py        → DatabaseManager (Singleton)             │   │
│  │ auth_db.py         → Authentication DB operations            │   │
│  │ journal_db.py      → Journal entries DB operations           │   │
│  │ analyzer_db.py     → Analytics data DB operations            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
├──────────────────────────────┼──────────────────────────────────────┤
│                      EXTERNAL SERVICES                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │    Supabase     │  │   Mem0 AI       │  │  Google Gemini  │      │
│  │  (PostgreSQL)   │  │ (Vector Store)  │  │  (LLM API)      │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Chi Tiết Từng Thành Phần

### 1. CLIENT LAYER

#### `pwa/` - Progressive Web App
Frontend chính của ứng dụng, phục vụ cho end-users (clients).

| File | Mục đích |
|------|----------|
| `chat.html` | Giao diện chat với AI |
| `home.html` | Trang chủ |
| `insights.html` | Phân tích tâm lý |
| `memories.html` | Quản lý ký ức |
| `patterns.html` | Mẫu hành vi |
| `settings.html` | Cài đặt người dùng |
| `js/` | Logic JavaScript |
| `css/` | Styling |

#### `therapist_UI/` - Therapist Dashboard
Frontend riêng cho therapists (nhà trị liệu).

| File | Mục đích |
|------|----------|
| `dashboard.html` | Dashboard tổng quan |
| `patients.html` | Quản lý bệnh nhân |
| `appointments.html` | Lịch hẹn |

---

### 2. API GATEWAY LAYER

#### `pwa_server.py` - Entry Point
File chính khởi tạo FastAPI application và mount tất cả routers.

```python
# Router registration
app.include_router(auth_router)
app.include_router(therapist_router)
app.include_router(memory_router)
app.include_router(proactive_router)
app.include_router(journal_router)
app.include_router(goals_router)
app.include_router(chat_router)
app.include_router(insights_router)
app.include_router(pages_router)
```

**Trách nhiệm:**
- CORS configuration
- Static file serving (`pwa/`, `therapist_UI/`)
- Middleware setup
- Health check endpoint
- User role management

---

### 3. ROUTER LAYER

#### `routers/` - Core API Routers

| File | Prefix | Mục đích |
|------|--------|----------|
| `chat.py` | `/api/chat` | WebSocket chat, message handling |
| `journal.py` | `/api/journal` | Journal entries CRUD |
| `insights.py` | `/api/insights` | AI-powered insights |
| `goals.py` | `/api/goals` | Goal tracking |
| `pages.py` | `/` | HTML page serving |

#### Root-level Routes (`*_routes.py`)

| File | Mục đích |
|------|----------|
| `auth_routes.py` | Authentication (login, register, OTP) |
| `memory_routes.py` | Memory management endpoints |
| `proactive_routes.py` | Proactive AI triggers |
| `user_routes.py` | User profile management |
| `therapist_routes.py` | Therapist-related endpoints |
| `therapist_routes_*.py` | Specialized therapist routes |

---

### 4. SERVICE LAYER

#### Core Services

| File | Singleton | Mục đích |
|------|-----------|----------|
| `chat_manager.py` | No | Quản lý chat sessions, message processing |
| `ai_service.py` | Yes | Tích hợp Google Gemini API |
| `memory_service.py` | Yes | Quản lý Mem0 vector memory |
| `user_service.py` | No | User profile, preferences |
| `crisis_detector.py` | Yes | Phát hiện khủng hoảng từ messages |
| `notification_service.py` | No | Push notifications |
| `proactive_service.py` | No | Proactive AI interactions |
| `analyzer.py` | No | Pattern analysis |

#### `agent_graph.py` - LangGraph Multi-Agent System

Đây là **trái tim AI** của Miru, sử dụng LangGraph để điều phối các agents.

```
┌─────────────────────────────────────────────────────────────┐
│                    LangGraph Workflow                       │
│                                                             │
│  ┌─────────────┐      ┌──────────────────┐                  │
│  │   START     │─────▶│ parallel_init    │                  │
│  └─────────────┘      │ (runs in parallel)│                  │
│                       └────────┬─────────┘                  │
│                                │                            │
│            ┌───────────────────┼───────────────────┐        │
│            ▼                                       ▼        │
│  ┌─────────────────┐                  ┌─────────────────┐   │
│  │ crisis_check    │                  │ memory_retrieval│   │
│  │ (crisis_detector│                  │ (Mem0 search)   │   │
│  └────────┬────────┘                  └────────┬────────┘   │
│           │                                    │            │
│           └────────────────┬───────────────────┘            │
│                            ▼                                │
│                  ┌─────────────────┐                        │
│                  │ empathy_response│                        │
│                  │ (Gemini LLM)    │                        │
│                  └────────┬────────┘                        │
│                           │                                 │
│                           ▼                                 │
│                  ┌─────────────────┐                        │
│                  │  action_node    │                        │
│                  │ (notify, log)   │                        │
│                  └────────┬────────┘                        │
│                           │                                 │
│                           ▼                                 │
│                  ┌─────────────────┐                        │
│                  │      END        │                        │
│                  └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

**Agents:**
- **crisis_check_node**: Phân loại mức độ khủng hoảng (NONE, LOW, MEDIUM, HIGH, CRITICAL)
- **memory_retrieval_node**: Lấy ký ức liên quan từ Mem0
- **empathy_response_node**: Tạo phản hồi đồng cảm bằng Gemini
- **action_node**: Thực hiện actions (notify therapist, log crisis)

---

### 5. THERAPIST MODULE (Bounded Context)

`therapist/` là một **bounded context** độc lập với cấu trúc riêng:

```
therapist/
├── __init__.py           # Module exports
├── models.py             # Data models (Patient, Appointment, etc.)
├── service.py            # Business logic
├── security.py           # Authentication & authorization
├── routes/
│   └── main.py           # API endpoints
├── services/
│   ├── appointment_service.py
│   ├── group_service.py
│   ├── medical_service.py
│   └── messaging_service.py
```

**Đặc điểm:**
- Có models riêng, không dùng chung với core
- Có security layer riêng
- Có thể tách thành microservice trong tương lai

---

### 6. DATA ACCESS LAYER

#### `database.py` - DatabaseManager

**Pattern:** Singleton

```python
class DatabaseManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

**Chức năng:**
- Kết nối Supabase client
- CRUD operations cho users, sessions, memories
- Embedding generation với Google text-embedding-004
- Semantic search

#### Specialized DB Modules

| File | Mục đích |
|------|----------|
| `auth_db.py` | User authentication, tokens |
| `journal_db.py` | Journal entries |
| `analyzer_db.py` | Analyzed sessions, patterns |

---

### 7. EXTERNAL SERVICES

| Service | Mục đích | SDK/Client |
|---------|----------|------------|
| **Supabase** | PostgreSQL database, Auth | `supabase-py` |
| **Mem0 AI** | Vector memory storage | `mem0ai` |
| **Google Gemini** | LLM responses | `google-generativeai` |

---

## 🔄 Data Flow Diagrams

### Chat Message Flow

```
User types message
        │
        ▼
┌─────────────────┐
│ pwa/chat.html   │ ──WebSocket──▶ ┌─────────────────┐
│ (JavaScript)    │                 │ routers/chat.py │
└─────────────────┘                 │ websocket_chat()│
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ chat_manager.py │
                                    │ process_message │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ agent_graph.py  │
                                    │ run_agent()     │
                                    └────────┬────────┘
                                             │
           ┌─────────────────────────────────┼─────────────────────────────────┐
           │                                 │                                 │
           ▼                                 ▼                                 ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│ crisis_detector │             │ memory_service  │             │ ai_service      │
│ check_crisis()  │             │ search_memories │             │ generate()      │
└────────┬────────┘             └────────┬────────┘             └────────┬────────┘
         │                               │                               │
         │                               │                               │
         ▼                               ▼                               ▼
    Crisis Level                    Memories                      AI Response
         │                               │                               │
         └───────────────────────────────┴───────────────────────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ database.py     │
                                │ save_message()  │
                                └────────┬────────┘
                                         │
                                         ▼
                                    ┌─────────┐
                                    │Supabase │
                                    └─────────┘
```

### Authentication Flow

```
User clicks Login
        │
        ▼
┌─────────────────┐
│ pwa/auth.html   │ ──HTTP POST──▶ ┌─────────────────┐
│                 │                 │ auth_routes.py  │
└─────────────────┘                 │ /api/auth/login │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ auth_manager.py │
                                    │ validate_user() │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ auth_db.py      │
                                    │ get_user()      │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Supabase Auth   │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    JWT Token returned
```

---

## 🔧 Dependency Injection Pattern

Miru sử dụng **Singleton + Factory** pattern thay vì DI framework.

```python
# Singleton via get_* functions
from memory_service import get_memory_service
from ai_service import get_ai_service
from crisis_detector import get_crisis_detector

# Usage
memory_svc = get_memory_service()
memories = await memory_svc.search(user_id, query)
```

---

## 📊 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, JavaScript, CSS (PWA) |
| API Framework | FastAPI 0.109.0 |
| WebSocket | Uvicorn |
| AI Orchestration | LangGraph |
| LLM | Google Gemini |
| Memory | Mem0 AI |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + JWT |
| Deployment | Railway (Backend), Vercel (Frontend) |

---

## 🎯 Điểm Mạnh

1. **Clear module boundaries** - `therapist/` là bounded context độc lập
2. **AI-first architecture** - LangGraph cho multi-agent orchestration
3. **Scalable memory** - Mem0 vector store cho semantic search
4. **PWA-ready** - Progressive Web App với offline support

## ⚠️ Điểm Cần Cải Thiện

1. **File organization** - Nhiều `*_routes.py`, `*_service.py` nằm ở root
2. **No DI framework** - Direct imports thay vì proper DI
3. **Missing API versioning** - Chưa có `/api/v1/` prefix
4. **Mixed responsibilities** - Một số files làm nhiều việc

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PRODUCTION                             │
│                                                             │
│  ┌─────────────────┐          ┌─────────────────┐           │
│  │     Vercel      │◀────────▶│    Railway      │           │
│  │  (PWA Frontend) │   API    │    (Backend)    │           │
│  │  pwa/           │          │  pwa_server.py  │           │
│  └─────────────────┘          └────────┬────────┘           │
│                                        │                    │
│                               ┌────────┴────────┐           │
│                               ▼                 ▼           │
│                      ┌─────────────┐   ┌─────────────┐      │
│                      │  Supabase   │   │  Mem0 API   │      │
│                      └─────────────┘   └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

*Tài liệu này được tạo tự động bởi AI analysis.*
