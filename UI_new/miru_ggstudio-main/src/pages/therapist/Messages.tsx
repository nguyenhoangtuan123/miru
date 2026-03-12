import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  LoaderCircle,
  MessageCircle,
  Search,
  Send,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  acknowledgeTherapistCrisis,
  getTherapistClients,
  getTherapistConversations,
  getTherapistCrises,
  getTherapistMessages,
  markTherapistMessagesRead,
  sendTherapistMessage,
} from '../../services/backend';

type TherapistClientRow = Record<string, unknown>;
type TherapistConversationRow = Record<string, unknown>;
type TherapistMessageRow = Record<string, unknown>;
type TherapistCrisisRow = Record<string, unknown>;

function getClientId(client: TherapistClientRow) {
  if (typeof client.client_id === 'string' && client.client_id.trim()) {
    return client.client_id;
  }
  if (typeof client.id === 'string' && client.id.trim()) {
    return client.id;
  }
  return '';
}

function getClientName(client: TherapistClientRow | null) {
  if (!client) {
    return 'Than chu';
  }
  const nested = client.users;
  if (nested && typeof nested === 'object') {
    const user = nested as Record<string, unknown>;
    if (typeof user.name === 'string' && user.name.trim()) {
      return user.name;
    }
  }
  if (typeof client.client_id === 'string' && client.client_id.trim()) {
    return client.client_id;
  }
  return 'Than chu';
}

function getClientEmail(client: TherapistClientRow | null) {
  if (!client) {
    return '';
  }
  const nested = client.users;
  if (nested && typeof nested === 'object') {
    const user = nested as Record<string, unknown>;
    if (typeof user.email === 'string' && user.email.trim()) {
      return user.email;
    }
  }
  return '';
}

function getConversationClientId(conversation: TherapistConversationRow) {
  return typeof conversation.client_id === 'string' ? conversation.client_id : '';
}

function getConversationPreview(conversation: TherapistConversationRow) {
  return typeof conversation.last_message === 'string' && conversation.last_message.trim()
    ? conversation.last_message
    : 'Chua co tin nhan';
}

function getConversationUnread(conversation: TherapistConversationRow) {
  return typeof conversation.unread_count === 'number' ? conversation.unread_count : 0;
}

function getCrisisText(crisis: TherapistCrisisRow) {
  if (typeof crisis.description === 'string' && crisis.description.trim()) {
    return crisis.description;
  }
  if (typeof crisis.message_snippet === 'string' && crisis.message_snippet.trim()) {
    return crisis.message_snippet;
  }
  return 'Can xem lai noi dung trao doi gan day.';
}

function getCrisisSeverity(crisis: TherapistCrisisRow) {
  if (typeof crisis.severity === 'string' && crisis.severity.trim()) {
    return crisis.severity;
  }
  if (typeof crisis.crisis_level === 'string' && crisis.crisis_level.trim()) {
    return crisis.crisis_level;
  }
  return 'alert';
}

export function TherapistMessages() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<TherapistClientRow[]>([]);
  const [conversations, setConversations] = useState<TherapistConversationRow[]>([]);
  const [crises, setCrises] = useState<TherapistCrisisRow[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TherapistMessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadInbox = async () => {
      try {
        setIsLoadingList(true);
        setError(null);

        const [clientsResult, conversationsResult, crisesResult] = await Promise.allSettled([
          getTherapistClients(user.id),
          getTherapistConversations(user.id),
          getTherapistCrises(user.id),
        ]);

        if (cancelled) {
          return;
        }

        const nextClients =
          clientsResult.status === 'fulfilled' ? clientsResult.value.clients : [];
        const nextConversations =
          conversationsResult.status === 'fulfilled'
            ? conversationsResult.value.conversations
            : [];
        const nextCrises =
          crisesResult.status === 'fulfilled' ? crisesResult.value.crises : [];

        setClients(nextClients);
        setConversations(nextConversations);
        setCrises(nextCrises);

        const clientFromUrl = searchParams.get('client');
        const fallbackClientId =
          clientFromUrl ||
          getConversationClientId(nextConversations[0] ?? {}) ||
          getClientId(nextClients[0] ?? {});
        setActiveClientId(fallbackClientId || null);

        const firstFailure =
          clientsResult.status === 'rejected'
            ? clientsResult.reason
            : conversationsResult.status === 'rejected'
              ? conversationsResult.reason
              : crisesResult.status === 'rejected'
                ? crisesResult.reason
                : null;

        if (firstFailure instanceof Error) {
          setError(firstFailure.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingList(false);
        }
      }
    };

    void loadInbox();

    return () => {
      cancelled = true;
    };
  }, [searchParams, user?.id]);

  useEffect(() => {
    if (!user?.id || !activeClientId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const response = await getTherapistMessages(user.id, activeClientId);
        if (cancelled) {
          return;
        }
        setMessages(response.messages);
        await markTherapistMessagesRead(user.id, activeClientId);
        if (!cancelled) {
          setConversations((prev) =>
            prev.map((conversation) =>
              getConversationClientId(conversation) === activeClientId
                ? { ...conversation, unread_count: 0 }
                : conversation
            )
          );
        }
      } catch (messageError) {
        if (!cancelled) {
          setError(
            messageError instanceof Error
              ? messageError.message
              : 'Khong tai duoc tin nhan'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMessages(false);
        }
      }
    };

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeClientId, user?.id]);

  const conversationMap = useMemo(() => {
    const map = new Map<string, TherapistConversationRow>();
    conversations.forEach((conversation) => {
      const clientId = getConversationClientId(conversation);
      if (clientId) {
        map.set(clientId, conversation);
      }
    });
    return map;
  }, [conversations]);

  const filteredClients = clients.filter((client) => {
    const name = getClientName(client).toLowerCase();
    const email = getClientEmail(client).toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    return !query || name.includes(query) || email.includes(query);
  });

  const activeClient =
    clients.find((client) => getClientId(client) === activeClientId) ?? null;

  const activeClientCrises = crises.filter(
    (crisis) =>
      typeof crisis.client_id === 'string' && crisis.client_id === activeClientId
  );

  async function handleSendMessage() {
    if (!user?.id || !activeClientId || !draft.trim()) {
      return;
    }

    const content = draft.trim();
    const optimisticMessage = {
      id: `draft-${Date.now()}`,
      client_id: activeClientId,
      sender_type: 'therapist',
      message_content: content,
      created_at: new Date().toISOString(),
    };

    try {
      setIsSending(true);
      setDraft('');
      setMessages((prev) => [...prev, optimisticMessage]);

      const response = await sendTherapistMessage(user.id, activeClientId, content);
      if (response.message) {
        setMessages((prev) => [
          ...prev.filter((message) => message.id !== optimisticMessage.id),
          response.message,
        ]);
        setConversations((prev) => {
          const nextConversation = {
            client_id: activeClientId,
            last_message: content,
            last_sender: 'therapist',
            last_time: new Date().toISOString(),
            unread_count: 0,
            client: activeClient ?? undefined,
          };
          const rest = prev.filter(
            (conversation) => getConversationClientId(conversation) !== activeClientId
          );
          return [nextConversation, ...rest];
        });
      }
    } catch (sendError) {
      setMessages((prev) =>
        prev.filter((message) => message.id !== optimisticMessage.id)
      );
      setDraft(content);
      setError(sendError instanceof Error ? sendError.message : 'Khong gui duoc tin nhan');
    } finally {
      setIsSending(false);
    }
  }

  async function handleAcknowledgeCrisis(crisisId: number) {
    try {
      setAcknowledgingId(crisisId);
      await acknowledgeTherapistCrisis(crisisId);
      setCrises((prev) => prev.filter((crisis) => Number(crisis.id) !== crisisId));
    } catch (acknowledgeError) {
      setError(
        acknowledgeError instanceof Error
          ? acknowledgeError.message
          : 'Khong cap nhat duoc crisis'
      );
    } finally {
      setAcknowledgingId(null);
    }
  }

  return (
    <div className="h-screen md:h-screen p-0 md:p-6 max-w-7xl mx-auto flex flex-col">
      <header className="hidden md:flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Tin nhan therapist</h1>
          <p className="text-white/60">
            Theo doi hoi thoai voi than chu va xu ly canh bao rui ro tu AI.
          </p>
        </div>
        {isLoadingList && (
          <div className="text-sm text-white/40 flex items-center gap-2">
            <LoaderCircle size={16} className="animate-spin" />
            Dang tai
          </div>
        )}
      </header>

      {error && (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      <div className="flex-1 glass-panel overflow-hidden flex flex-col md:flex-row rounded-none md:rounded-3xl border-x-0 md:border-x">
        <div
          className={`w-full md:w-96 border-r border-white/10 flex flex-col ${
            activeClientId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                size={18}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tim than chu..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-miru-primary/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="p-4 text-sm text-white/40">
                Chua co than chu nao duoc ket noi.
              </div>
            ) : (
              filteredClients.map((client) => {
                const clientId = getClientId(client);
                const conversation = conversationMap.get(clientId);
                const unreadCount = conversation ? getConversationUnread(conversation) : 0;
                const crisisCount = activeClientId
                  ? crises.filter(
                      (crisis) =>
                        typeof crisis.client_id === 'string' &&
                        crisis.client_id === clientId
                    ).length
                  : crises.filter(
                      (crisis) =>
                        typeof crisis.client_id === 'string' &&
                        crisis.client_id === clientId
                    ).length;

                return (
                  <button
                    key={clientId}
                    onClick={() => setActiveClientId(clientId)}
                    className={`w-full p-4 border-b border-white/5 text-left hover:bg-white/5 transition-colors ${
                      activeClientId === clientId ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-miru-primary/20 flex items-center justify-center text-miru-primary font-bold shrink-0 relative">
                        {getClientName(client).charAt(0)}
                        {(unreadCount > 0 || crisisCount > 0) && (
                          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 rounded-full border-2 border-[#050A1F] flex items-center justify-center text-[10px] font-bold text-white">
                            {unreadCount + crisisCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-semibold truncate">{getClientName(client)}</h4>
                          {unreadCount > 0 && (
                            <span className="rounded-full bg-miru-primary/20 px-2 py-0.5 text-[11px] text-miru-primary">
                              {unreadCount} moi
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/50 truncate">
                          {conversation ? getConversationPreview(conversation) : 'Chua co tin nhan'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {activeClient ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-6 bg-white/5">
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden p-2 -ml-2 hover:bg-white/10 rounded-xl text-white/60"
                  onClick={() => setActiveClientId(null)}
                >
                  &larr;
                </button>
                <div className="w-10 h-10 rounded-full bg-miru-primary/20 flex items-center justify-center text-miru-primary font-bold">
                  {getClientName(activeClient).charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold">{getClientName(activeClient)}</h3>
                  <span className="text-xs text-white/40">
                    {getClientEmail(activeClient) || 'Khong co email'}
                  </span>
                </div>
              </div>
              {isLoadingMessages && (
                <div className="text-xs text-white/40 flex items-center gap-2">
                  <LoaderCircle size={14} className="animate-spin" />
                  Dong bo
                </div>
              )}
            </div>

            <div className="border-b border-white/10 px-4 md:px-6 py-4 space-y-3 bg-white/5">
              {activeClientCrises.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/50">
                  Khong co canh bao AI dang mo cho than chu nay.
                </div>
              ) : (
                activeClientCrises.map((crisis) => (
                  <div
                    key={String(crisis.id)}
                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-red-300 mb-2">
                          <AlertTriangle size={16} />
                          <span className="font-medium uppercase">
                            {getCrisisSeverity(crisis)}
                          </span>
                        </div>
                        <p className="text-sm text-white/80">{getCrisisText(crisis)}</p>
                      </div>
                      <button
                        onClick={() => handleAcknowledgeCrisis(Number(crisis.id))}
                        disabled={acknowledgingId === Number(crisis.id)}
                        className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-500/25 disabled:opacity-50"
                      >
                        {acknowledgingId === Number(crisis.id) ? 'Dang xu ly...' : 'Da xem'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-white/40 h-full gap-4">
                  <MessageCircle size={48} className="opacity-20" />
                  <p>Chua co tin nhan nao voi than chu nay.</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.sender_type === 'therapist';
                  return (
                    <div
                      key={String(message.id ?? `${message.sender_type}-${message.created_at}`)}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                          isMine
                            ? 'bg-miru-primary text-white'
                            : 'bg-white/8 text-white/85'
                        }`}
                      >
                        <div>{String(message.message_content ?? '')}</div>
                        <div
                          className={`text-[11px] mt-2 ${
                            isMine ? 'text-white/70' : 'text-white/40'
                          }`}
                        >
                          {typeof message.created_at === 'string'
                            ? new Date(message.created_at).toLocaleString('vi-VN')
                            : ''}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-white/10 p-4 md:p-6 flex gap-3">
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Gui tin nhan cho than chu..."
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50 transition-colors"
              />
              <button
                onClick={handleSendMessage}
                disabled={!draft.trim() || isSending}
                className="glass-button px-5 py-3 rounded-2xl font-medium disabled:opacity-60 flex items-center gap-2"
              >
                {isSending ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                Gui
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-white/40 flex-col gap-4">
            <MessageCircle size={48} className="opacity-20" />
            <p>Chon mot than chu de mo hoi thoai.</p>
          </div>
        )}
      </div>
    </div>
  );
}
