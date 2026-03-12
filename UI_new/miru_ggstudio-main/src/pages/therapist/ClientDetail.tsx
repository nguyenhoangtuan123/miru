import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  CalendarPlus,
  ClipboardList,
  LoaderCircle,
  MessageCircle,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createTherapistAssignment,
  getClientAssignments,
  getClientSummary,
  getTherapistClients,
} from '../../services/backend';

type TherapistClientRow = Record<string, unknown>;
type TherapistAssignmentRow = Record<string, unknown>;

function getClientName(client: TherapistClientRow | null, fallbackId: string) {
  if (client) {
    const nested = client.users;
    if (nested && typeof nested === 'object') {
      const user = nested as Record<string, unknown>;
      if (typeof user.name === 'string' && user.name.trim()) {
        return user.name;
      }
    }
  }
  return fallbackId;
}

function getClientEmail(client: TherapistClientRow | null) {
  if (client) {
    const nested = client.users;
    if (nested && typeof nested === 'object') {
      const user = nested as Record<string, unknown>;
      if (typeof user.email === 'string' && user.email.trim()) {
        return user.email;
      }
    }
  }
  return 'Chua co email';
}

export function TherapistClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<TherapistClientRow | null>(null);
  const [assignments, setAssignments] = useState<TherapistAssignmentRow[]>([]);
  const [summary, setSummary] = useState<{
    total_sessions?: number;
    completed_assignments?: number;
    pending_assignments?: number;
    crisis_events?: number;
  } | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !id) {
      return;
    }

    let cancelled = false;

    const loadClientDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [clientsResult, summaryResult, assignmentsResult] =
          await Promise.allSettled([
            getTherapistClients(user.id),
            getClientSummary(user.id, id),
            getClientAssignments(id),
          ]);

        if (cancelled) {
          return;
        }

        if (clientsResult.status === 'fulfilled') {
          const matchedClient =
            clientsResult.value.clients.find((item) => {
              if (typeof item.client_id === 'string') {
                return item.client_id === id;
              }
              if (typeof item.id === 'string') {
                return item.id === id;
              }
              return false;
            }) ?? null;

          setClient(matchedClient);
        }

        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value.summary ?? null);
        }

        if (assignmentsResult.status === 'fulfilled') {
          setAssignments(assignmentsResult.value.assignments);
        }

        const firstFailure =
          clientsResult.status === 'rejected'
            ? clientsResult.reason
            : summaryResult.status === 'rejected'
              ? summaryResult.reason
              : assignmentsResult.status === 'rejected'
                ? assignmentsResult.reason
                : null;

        if (firstFailure instanceof Error) {
          setError(firstFailure.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadClientDetail();

    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  async function handleCreateAssignment() {
    if (!user?.id || !id || !title.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await createTherapistAssignment(user.id, {
        client_id: id,
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate || undefined,
      });

      if (response.assignment) {
        setAssignments((prev) => [response.assignment, ...prev]);
        setSummary((prev) => ({
          ...prev,
          pending_assignments: (prev?.pending_assignments ?? 0) + 1,
        }));
      }

      setTitle('');
      setDescription('');
      setDueDate('');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Khong tao duoc bai tap');
    } finally {
      setIsSubmitting(false);
    }
  }

  const clientName = getClientName(client, id ?? 'Than chu');
  const clientEmail = getClientEmail(client);
  const clientStatus =
    client && typeof client.status === 'string' ? client.status : 'active';

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <button
        onClick={() => navigate('/therapist/clients')}
        className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Quay lai danh sach
      </button>

      <div className="glass-panel p-8 mb-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-miru-primary/20 flex items-center justify-center text-3xl font-bold text-miru-primary border-2 border-white/10">
            {clientName.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">{clientName}</h1>
            <p className="text-white/60 mb-2">
              {clientEmail} | ID: {id}
            </p>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
              {clientStatus}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/therapist/messages?client=${id}`)}
            className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-white hover:bg-white/12 transition-colors flex items-center gap-2"
          >
            <MessageCircle size={16} />
            Nhan tin
          </button>
          <button
            onClick={() => navigate(`/therapist/appointments?client=${id}`)}
            className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-white hover:bg-white/12 transition-colors flex items-center gap-2"
          >
            <CalendarPlus size={16} />
            Tao lich hen
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="mb-6 text-sm text-white/40 flex items-center gap-2">
          <LoaderCircle size={16} className="animate-spin" />
          Dang tai du lieu than chu
        </div>
      )}

      <div className="grid xl:grid-cols-[1.15fr,0.85fr] gap-6">
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { label: 'Tong so phien', value: summary?.total_sessions ?? 0, icon: Activity },
              {
                label: 'Bai tap hoan thanh',
                value: summary?.completed_assignments ?? 0,
                icon: ClipboardList,
              },
              {
                label: 'Bai tap dang cho',
                value: summary?.pending_assignments ?? 0,
                icon: ClipboardList,
              },
              {
                label: 'Canh bao AI',
                value: summary?.crisis_events ?? 0,
                icon: Activity,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="glass-panel p-6 rounded-2xl">
                  <div className="w-10 h-10 rounded-2xl bg-white/8 flex items-center justify-center mb-4">
                    <Icon size={18} className="text-miru-primary" />
                  </div>
                  <p className="text-sm text-white/50 mb-2">{item.label}</p>
                  <p className="text-3xl font-bold">{item.value}</p>
                </div>
              );
            })}
          </div>

          <div className="glass-panel p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Assignments</h2>
              <span className="text-sm text-white/40">{assignments.length} muc</span>
            </div>
            <div className="space-y-4">
              {assignments.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                  Chua co bai tap nao cho than chu nay.
                </div>
              ) : (
                assignments.map((assignment) => (
                  <div
                    key={String(assignment.id ?? assignment.title)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-medium">
                          {String(assignment.title ?? 'Bai tap')}
                        </h4>
                        {typeof assignment.description === 'string' &&
                          assignment.description && (
                            <p className="text-sm text-white/60 mt-2">
                              {assignment.description}
                            </p>
                          )}
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                        {String(assignment.status ?? 'pending')}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-white/45">
                      Han: {typeof assignment.due_date === 'string' ? assignment.due_date : 'Khong co'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl h-fit">
          <h2 className="text-xl font-semibold mb-5">Giao bai tap moi</h2>
          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tieu de bai tap"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Mo ta huong dan..."
              rows={5}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50 resize-none"
            />
            <div>
              <label className="text-sm text-white/60 mb-2 block">Han hoan thanh</label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-miru-primary/50"
              />
            </div>
            <button
              onClick={handleCreateAssignment}
              disabled={!title.trim() || isSubmitting}
              className="w-full glass-button py-3 rounded-2xl font-medium disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              Tao assignment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
