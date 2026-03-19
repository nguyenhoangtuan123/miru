import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, LoaderCircle, Menu, Plus, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { shouldShowSystemNotification, showMiruNotification } from '../lib/notifications';
import { cn } from '../lib/utils';
import {
  connectChatSocket,
  createChatSession,
  getChatSessions,
  getSessionMessages,
} from '../services/backend';
import type { ChatMessage, ChatSession } from '../services/contracts';

type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  status?: 'thinking' | 'streaming' | 'done';
};

const STREAMING_MESSAGE_ID = 'assistant-streaming';

function normalizeMessage(message: ChatMessage): LocalMessage {
  return {
    id: String(message.id ?? `${message.role}-${message.created_at ?? Date.now()}`),
    role: message.role === 'ai' ? 'assistant' : message.role,
    content: message.content,
    created_at: message.created_at ?? new Date().toISOString(),
    status: 'done',
  };
}

function buildSessionTitle(input: string) {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Cuoc tro chuyen moi';
  return cleaned.length <= 50 ? cleaned : `${cleaned.slice(0, 47)}...`;
}

export function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeSessionRef = useRef<string | null>(null);

  function upsertStreamingAssistant(updater: (existing?: LocalMessage) => LocalMessage) {
    setMessages((prev) => {
      const existing = prev.find((message) => message.id === STREAMING_MESSAGE_ID);
      const next = updater(existing);
      const withoutStreaming = prev.filter((message) => message.id !== STREAMING_MESSAGE_ID);
      return [...withoutStreaming, next];
    });
  }

  useEffect(() => {
    activeSessionRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const client = connectChatSocket(user.id, (event) => {
      if (event.type === 'thinking') {
        upsertStreamingAssistant((existing) => ({
          id: STREAMING_MESSAGE_ID,
          role: 'assistant',
          content: existing?.content ?? '',
          created_at: event.timestamp,
          status: 'thinking',
        }));
        setIsSending(true);
        setError(null);
        return;
      }

      if (event.type === 'ai_chunk') {
        upsertStreamingAssistant((existing) => ({
          id: STREAMING_MESSAGE_ID,
          role: 'assistant',
          content: `${existing?.content ?? ''}${event.chunk}`,
          created_at: event.timestamp,
          status: 'streaming',
        }));
        setIsSending(true);
        setError(null);
        return;
      }

      if (event.type === 'ai_response') {
        setMessages((prev) => {
          const nextMessage: LocalMessage = {
            id: `ai-${event.timestamp}-${prev.length}`,
            role: 'assistant',
            content: event.message,
            created_at: event.timestamp,
            status: 'done',
          };
          const withoutStreaming = prev.filter((message) => message.id !== STREAMING_MESSAGE_ID);
          return [...withoutStreaming, nextMessage];
        });
        setIsSending(false);
        setError(null);
        if (shouldShowSystemNotification()) {
          void showMiruNotification({
            title: 'Miru phan hoi',
            body: event.message.length > 120 ? `${event.message.slice(0, 117)}...` : event.message,
            tag: 'chat-ai-response',
            url: '/chat',
          });
        }
        return;
      }

      setMessages((prev) => prev.filter((message) => message.id !== STREAMING_MESSAGE_ID));
      setError(event.message);
      setIsSending(false);
    });

    socketRef.current = client;

    return () => {
      client.close();
      socketRef.current = null;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadSessions = async () => {
      try {
        setIsLoadingSessions(true);
        const response = await getChatSessions(user.id);
        if (cancelled) {
          return;
        }

        setSessions(response.sessions);

        if (!activeSessionRef.current && response.sessions.length > 0) {
          setActiveSessionId(String(response.sessions[0].id));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được phiên chat');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSessions(false);
        }
      }
    };

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const response = await getSessionMessages(activeSessionId);
        if (cancelled) {
          return;
        }

        setMessages(response.messages.map(normalizeMessage));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được tin nhắn');
        }
      } finally {
        if (!cancelled) {
          setMessages((prev) => prev.filter((message) => message.id !== STREAMING_MESSAGE_ID));
          setIsLoadingMessages(false);
        }
      }
    };

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  async function ensureSocketOpen() {
    const client = socketRef.current;

    if (!client) {
      throw new Error('Ket noi chat chua san sang');
    }

    if (client.socket.readyState === WebSocket.OPEN) {
      return client;
    }

    await new Promise<void>((resolve, reject) => {
      const handleOpen = () => {
        cleanup();
        resolve();
      };

      const handleError = () => {
        cleanup();
        reject(new Error('Không mở được kết nối chat'));
      };

      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Ket noi chat bi timeout'));
      }, 5000);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        client.socket.removeEventListener('open', handleOpen);
        client.socket.removeEventListener('error', handleError);
      };

      client.socket.addEventListener('open', handleOpen, { once: true });
      client.socket.addEventListener('error', handleError, { once: true });
    });

    return client;
  }

  async function handleCreateSession(initialMessage?: string) {
    if (!user?.id) {
      throw new Error('Thieu user id');
    }

    const response = await createChatSession(
      user.id,
      initialMessage ? buildSessionTitle(initialMessage) : 'Cuoc tro chuyen moi'
    );

    if (!response.success || !response.session) {
      throw new Error(response.error ?? 'Không tạo được phiên chat');
    }

    const nextSession: ChatSession = {
      id: response.session.id,
      title: response.session.title,
      date: new Date().toLocaleDateString('vi-VN'),
      time: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setSessions((prev) => [nextSession, ...prev.filter((item) => String(item.id) !== String(nextSession.id))]);
    setActiveSessionId(String(nextSession.id));
    return String(nextSession.id);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();

    if (!user?.id || !input.trim() || isSending) {
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setError(null);

    try {
      let sessionId = activeSessionRef.current;

      if (!sessionId) {
        sessionId = await handleCreateSession(userMessage);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: userMessage,
          created_at: new Date().toISOString(),
          status: 'done',
        },
      ]);
      setIsSending(true);
      upsertStreamingAssistant(() => ({
        id: STREAMING_MESSAGE_ID,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        status: 'thinking',
      }));

      const client = await ensureSocketOpen();
      client.send({
        message: userMessage,
        session_id: sessionId,
      });
    } catch (sendError) {
      setMessages((prev) => prev.filter((message) => message.id !== STREAMING_MESSAGE_ID));
      setIsSending(false);
      setError(sendError instanceof Error ? sendError.message : 'Không gửi được tin nhắn');
    }
  }

  function handleNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setIsSidebarOpen(false);
    setError(null);
    setIsSending(false);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-miru-bg pt-safe">
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 m-4 flex w-72 transform flex-col glass-panel transition-transform duration-300 ease-in-out',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-[120%] md:translate-x-0',
          'md:relative md:m-4 md:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold">Phien tro chuyen</h2>
          <button
            onClick={handleNewChat}
            className="rounded-xl p-2 transition-colors hover:bg-white/10"
            title="Tao cuoc tro chuyen moi"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {isLoadingSessions ? (
            <div className="flex items-center gap-2 p-4 text-sm text-white/50">
              <LoaderCircle size={16} className="animate-spin" />
              Đang tải phiên...
            </div>
          ) : sessions.length === 0 ? (
            <p className="p-4 text-center text-sm text-white/40">Chua co phien nao</p>
          ) : (
            sessions.map((session) => {
              const selected = String(session.id) === activeSessionId;

              return (
                <button
                  key={String(session.id)}
                  onClick={() => {
                    setActiveSessionId(String(session.id));
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    'w-full rounded-xl p-3 text-left transition-colors',
                    selected ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10'
                  )}
                >
                  <p className="truncate text-sm">{session.title}</p>
                  {(session.date || session.time) && (
                    <p className="mt-1 text-xs text-white/40">
                      {[session.date, session.time].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-white/10 px-4 shrink-0">
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="mr-2 -ml-2 rounded-xl p-2 hover:bg-white/10 md:hidden"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-miru-primary/20">
              <Bot size={18} className="text-miru-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Miru AI</h1>
              <p className="text-xs text-white/40">
                {activeSessionId ? 'Đang kết nối realtime với backend' : 'Bắt đầu một phiên mới'}
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mx-4 mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex-1 space-y-6 overflow-y-auto p-4 pb-24 md:p-6 md:pb-24">
          {isLoadingMessages ? (
            <div className="flex h-full items-center justify-center text-white/40">
              <LoaderCircle size={24} className="animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-white/40">
              <Bot size={48} className="mb-4 opacity-50" />
              <p>
                {activeSessionId
                  ? 'Phien nay chua co tin nhan.'
                  : 'Hay bat dau bang mot cau hoi hoac chia se cam xuc cua ban.'}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex max-w-[85%] md:max-w-[75%]',
                  message.role === 'user' ? 'ml-auto justify-end' : 'mr-auto'
                )}
              >
                <div
                  className={cn(
                    'relative rounded-3xl p-4',
                    message.role === 'user'
                      ? 'rounded-tr-sm bg-miru-primary text-[#ffffff]'
                      : 'rounded-tl-sm glass-panel'
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed md:text-base">
                    {message.content || (message.status === 'thinking' ? 'Miru đang suy nghĩ...' : '')}
                  </p>
                  {message.role === 'assistant' && message.status && message.status !== 'done' && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-white/50">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
                      <span>{message.status === 'thinking' ? 'Miru đang suy nghĩ' : 'Miru đang trả lời'}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-miru-bg via-miru-bg to-transparent p-4 md:pb-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
        >
          <form onSubmit={sendMessage} className="relative mx-auto max-w-4xl">
            <input
              type="text"
              value={input}
              onChange={(nextEvent) => setInput(nextEvent.target.value)}
              placeholder="Nhan tin cho Miru..."
              className="w-full glass-panel py-4 pl-6 pr-14 text-white outline-none transition-colors placeholder:text-white/30 focus:border-miru-primary/50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-miru-primary p-2 text-[#ffffff] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? <LoaderCircle size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
