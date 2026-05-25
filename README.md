# 🧠 Memory App Project

An AI Chatbot system with **Long-term Memory** powered by **MCP (Model Context Protocol)**, **Supabase**, and **Google Gemini**.

---

# 🚀 Getting Started

You need to open **two separate terminals** to run the system.

## Terminal 1: Run the Server

The server handles:

* API processing
* Chat functionality
* Memory management
* Database connections

```powershell
.venv\Scripts\activate
uvicorn app:app --app-dir src --host 0.0.0.0 --port 8008
```

Wait until the backend is running at:

```text
http://127.0.0.1:8008
```

---

## Terminal 2: Run the Client

The client provides the chat interface for interacting with the AI.

```powershell
cd UI_new\miru_ggstudio-main
npm run dev
```

---

# 📂 Project Structure

* `src/app.py`
  Main FastAPI server.

* `UI_new/miru_ggstudio-main/`
  Frontend built with Vite + React.

* `database.py`
  Handles Supabase connections and vector search functionality.

* `.env`
  Stores API keys and database configuration.

---

# 📱 Mobile Application Download

You can download the chatbot mobile application here:

[Reflection Project Mobile App](https://drive.google.com/file/d/1iydGBtXzq8XzbhuF3DdLHFxROtP-z2wB/view?usp=sharing&utm_source=chatgpt.com)

---

# 📌 Project Name

**Reflection Project**
