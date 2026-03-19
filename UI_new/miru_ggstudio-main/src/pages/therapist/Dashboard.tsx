import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Inbox,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  therapistMorningBoardQueryOptions,
  therapistProfileQueryOptions,
} from '../../queries/appQueries';

type GenericRecord = Record<string, unknown>;

function getClientIdentity(payload: GenericRecord | null | undefined) {
  const client = payload?.client;
  if (client && typeof client === 'object') {
    const record = client as GenericRecord;
    return {
      id: typeof record.id === 'string' ? record.id : '',
      name:
        (typeof record.name === 'string' && record.name.trim()) ||
        (typeof record.email === 'string' && record.email.trim()) ||
        (typeof payload?.client_id === 'string' ? payload.client_id : 'Thân chủ'),
      email: typeof record.email === 'string' ? record.email : '',
    };
  }

  return {
    id: typeof payload?.client_id === 'string' ? payload.client_id : '',
    name: typeof payload?.client_id === 'string' ? payload.client_id : 'Thân chủ',
    email: '',
  };
}

function formatDateTime(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return 'Chưa có dữ liệu';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Chưa có dữ liệu';
  }

  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCompactDate(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return 'Chưa hẹn';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Chưa hẹn';
  }

  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAttentionTone(level: unknown) {
  switch (level) {
    case 'high':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200';
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200';
  }
}

function getAttentionLabel(level: unknown) {
  switch (level) {
    case 'high':
      return 'Cần chú ý cao';
    case 'medium':
      return 'Cần theo dõi';
    default:
      return 'Ổn định';
  }
}

function getActionHref(clientId: string, action: unknown) {
  switch (action) {
    case 'Nhắn follow-up':
      return `/therapist/messages?client=${encodeURIComponent(clientId)}`;
    case 'Giao bài tập':
      return `/therapist/clients/${encodeURIComponent(clientId)}`;
    case 'Gửi assessment':
      return `/therapist/clients/${encodeURIComponent(clientId)}/assessments`;
    case 'Mời cập nhật quyền chia sẻ':
      return `/therapist/clients/${encodeURIComponent(clientId)}/context`;
    case 'Xác nhận cảnh báo':
      return `/therapist`;
    default:
      return `/therapist/clients/${encodeURIComponent(clientId)}`;
  }
}

export function TherapistDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const therapistId = user?.id ?? '';
  const canUseTherapistQueries = Boolean(user?.id && user.can_access_therapist_portal);

  const boardQuery = useQuery({
    ...therapistMorningBoardQueryOptions(therapistId),
    enabled: canUseTherapistQueries,
  });
  const profileQuery = useQuery({
    ...therapistProfileQueryOptions(),
    enabled: canUseTherapistQueries,
  });

  const board = boardQuery.data?.board;
  const stats = board?.stats ?? {};
  const attentionClients = (board?.attention_clients ?? []) as GenericRecord[];
  const contactRequests = (board?.new_contact_requests ?? []) as GenericRecord[];
  const todayAppointments = (board?.today_appointments ?? []) as GenericRecord[];
  const pendingAssignments = (board?.pending_assignments ?? []) as GenericRecord[];
  const pendingAssessments = (board?.pending_assessments ?? []) as GenericRecord[];
  const openCrises = (board?.open_crises ?? []) as GenericRecord[];
  const profile = profileQuery.data?.profile ?? null;

  const profileChecklist = useMemo(() => {
    if (!profile) {
      return [];
    }
    return [
      {
        label: 'Có ảnh đại diện công khai',
        done: Boolean(profile.avatar_image?.url),
      },
      {
        label: 'Có headline rõ ràng',
        done: Boolean(profile.headline?.trim()),
      },
      {
        label: 'Có phần giới thiệu chi tiết',
        done: Boolean(profile.bio?.trim()),
      },
      {
        label: 'Có chuyên môn nổi bật',
        done: Array.isArray(profile.specializations) && profile.specializations.length > 0,
      },
      {
        label: 'Có lộ trình làm việc công khai',
        done:
          Array.isArray(profile.public_workflow_steps) &&
          profile.public_workflow_steps.filter(Boolean).length >= 3,
      },
      {
        label: 'Có ít nhất một kênh liên hệ',
        done: Boolean(
          profile.contact_phone ||
            profile.contact_email ||
            profile.contact_zalo_url ||
            profile.contact_facebook_url ||
            profile.contact_website_url
        ),
      },
    ];
  }, [profile]);

  const checklistDone = profileChecklist.filter((item) => item.done).length;
  const isLoading = boardQuery.isLoading || profileQuery.isLoading;
  const error =
    boardQuery.error instanceof Error
      ? boardQuery.error.message
      : profileQuery.error instanceof Error
        ? profileQuery.error.message
        : null;

  const heroStats = [
    {
      label: 'Ca cần chú ý',
      value: Number(stats.attention_clients ?? attentionClients.length ?? 0),
      icon: TrendingUp,
      tone: 'text-amber-500',
      surface: 'bg-amber-500/12',
    },
    {
      label: 'Lead đang mở',
      value: Number(stats.new_contact_requests ?? contactRequests.length ?? 0),
      icon: Inbox,
      tone: 'text-sky-500',
      surface: 'bg-sky-500/12',
    },
    {
      label: 'Lịch hôm nay',
      value: Number(stats.today_appointments ?? todayAppointments.length ?? 0),
      icon: CalendarDays,
      tone: 'text-violet-500',
      surface: 'bg-violet-500/12',
    },
    {
      label: 'Cảnh báo mở',
      value: Number(stats.open_crises ?? openCrises.length ?? 0),
      icon: AlertTriangle,
      tone: 'text-red-500',
      surface: 'bg-red-500/12',
    },
  ];

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                <Sparkles size={14} />
                Morning Caseload Board
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
                Hôm nay tôi cần làm gì?
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-white/60">
                Miru gom các tín hiệu giữa các buổi để bạn thấy ngay ca nào cần chú ý,
                lead nào cần phản hồi và bước tiếp theo nào đáng làm trước.
              </p>
            </div>

            {isLoading && (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                <LoaderCircle size={16} className="animate-spin" />
                Đang tải bảng theo dõi ca sáng
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {heroStats.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className="glass-panel rounded-[28px] border border-white/10 p-5"
              >
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${item.surface} ${item.tone}`}
                >
                  <Icon size={22} />
                </div>
                <div className="mt-5 text-3xl font-bold text-slate-900 dark:text-white">{item.value}</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-white/60">{item.label}</div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                  Việc cần xử lý hôm nay
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                  Ca cần ưu tiên trước
                </h2>
              </div>
              <Link
                to="/therapist/clients"
                className="inline-flex items-center gap-2 text-sm font-medium text-miru-primary"
              >
                Xem toàn bộ thân chủ
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              {attentionClients.length === 0 ? (
                <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Chưa có ca nào nổi bật sáng nay. Đây là thời điểm tốt để cập nhật hồ sơ công khai
                  hoặc phản hồi các lead mới.
                </div>
              ) : (
                attentionClients.slice(0, 6).map((item) => {
                  const client = getClientIdentity(item);
                  const actionLabel =
                    typeof item.suggested_next_action === 'string' && item.suggested_next_action
                      ? item.suggested_next_action
                      : 'Xem summary ca';

                  return (
                    <article
                      key={client.id || String(item.client_id)}
                      className="rounded-[28px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                              {client.name}
                            </h3>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAttentionTone(
                                item.attention_level
                              )}`}
                            >
                              {getAttentionLabel(item.attention_level)}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                              {typeof item.trajectory_state === 'string'
                                ? item.trajectory_state
                                : 'Đang theo dõi'}
                            </span>
                          </div>

                          <p className="text-sm leading-7 text-slate-700 dark:text-white/75">
                            {typeof item.attention_reason === 'string'
                              ? item.attention_reason
                              : 'Miru chưa ghi nhận tín hiệu nổi bật.'}
                          </p>

                          {typeof item.trend_summary === 'string' && item.trend_summary.trim() && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/6 dark:text-white/70">
                              {item.trend_summary}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-white/40">
                            <span>Hoạt động gần nhất: {formatDateTime(item.last_client_activity_at)}</span>
                            <span>Mục chờ xử lý: {Number(item.pending_items_count ?? 0)}</span>
                            <span>Tin nhắn chưa đọc: {Number(item.unread_client_messages ?? 0)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 lg:w-[260px] lg:justify-end">
                          <button
                            onClick={() => navigate(getActionHref(client.id, actionLabel))}
                            className="inline-flex items-center justify-center rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-miru-primary/85"
                          >
                            {actionLabel}
                          </button>
                          <button
                            onClick={() => navigate(`/therapist/clients/${encodeURIComponent(client.id)}`)}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                          >
                            Xem summary ca
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                    Giá trị kinh doanh
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                    Hồ sơ công khai của bạn
                  </h2>
                </div>
                {profile?.is_verified && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <ShieldCheck size={14} />
                    Đã xác minh
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center dark:border-white/10 dark:bg-white/5">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {profile?.profile_view_count ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-white/60">Lượt xem hồ sơ</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center dark:border-white/10 dark:bg-white/5">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {profile?.contact_request_count ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-white/60">Yêu cầu liên hệ</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center dark:border-white/10 dark:bg-white/5">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {profile?.pair_conversion_count ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-white/60">Đã chuyển thành pair</div>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Độ hoàn thiện hồ sơ
                  </div>
                  <div className="text-sm text-miru-primary">
                    {checklistDone}/{profileChecklist.length}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {profileChecklist.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/6"
                    >
                      <span className="text-slate-700 dark:text-white/75">{item.label}</span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.done
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
                        }`}
                      >
                        {item.done ? 'Đã có' : 'Cần bổ sung'}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/therapist/profile"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-miru-primary"
                >
                  Cập nhật hồ sơ để tăng chuyển đổi
                  <ArrowRight size={16} />
                </Link>
              </div>
            </section>

            <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                    Lead / contact requests
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                    Cần phản hồi sớm
                  </h2>
                </div>
                <Link
                  to="/therapist/contact-requests"
                  className="inline-flex items-center gap-2 text-sm font-medium text-miru-primary"
                >
                  Mở inbox
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {contactRequests.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                    Hiện chưa có lead nào đang mở. Hồ sơ công khai và tốc độ phản hồi sẽ là hai
                    đòn bẩy chính để tăng chuyển đổi.
                  </div>
                ) : (
                  contactRequests.slice(0, 4).map((item) => {
                    const client = getClientIdentity(item);
                    return (
                      <div
                        key={String(item.id)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {client.name}
                          </div>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-white/60">
                            {typeof item.funnel_status === 'string' ? item.funnel_status : 'new'}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-600 dark:text-white/65">
                          Nguồn: {typeof item.source === 'string' ? item.source : 'directory'}
                        </div>
                        {typeof item.message === 'string' && item.message.trim() && (
                          <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-700 dark:text-white/75">
                            {item.message}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
          <article className="glass-panel rounded-[32px] border border-white/10 p-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="text-violet-500" size={20} />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Lịch hôm nay</h3>
            </div>
            <div className="mt-4 space-y-3">
              {todayAppointments.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Không có lịch hẹn nào trong hôm nay.
                </div>
              ) : (
                todayAppointments.slice(0, 4).map((item, index) => {
                  const client = getClientIdentity(item);
                  return (
                    <div
                      key={String(item.id ?? `${client.id}-${index}`)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="font-semibold text-slate-900 dark:text-white">{client.name}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-white/65">
                        {formatCompactDate(item.appointment_date)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="glass-panel rounded-[32px] border border-white/10 p-6">
            <div className="flex items-center gap-3">
              <ClipboardList className="text-amber-500" size={20} />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Bài tập cần theo dõi</h3>
            </div>
            <div className="mt-4 space-y-3">
              {pendingAssignments.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Chưa có bài tập nào đang chờ theo dõi.
                </div>
              ) : (
                pendingAssignments.slice(0, 4).map((item, index) => {
                  const client = getClientIdentity(item);
                  return (
                    <div
                      key={String(item.id ?? `${client.id}-${index}`)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {typeof item.title === 'string' && item.title ? item.title : 'Bài tập'}
                      </div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-white/65">{client.name}</div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="glass-panel rounded-[32px] border border-white/10 p-6">
            <div className="flex items-center gap-3">
              <Users className="text-sky-500" size={20} />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Thang đo chưa nộp</h3>
            </div>
            <div className="mt-4 space-y-3">
              {pendingAssessments.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Chưa có thang đo nào đang chờ thân chủ nộp.
                </div>
              ) : (
                pendingAssessments.slice(0, 4).map((item, index) => {
                  const client = getClientIdentity(item);
                  return (
                    <div
                      key={String(item.id ?? `${client.id}-${index}`)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {typeof item.template_id === 'string' ? item.template_id.toUpperCase() : 'Assessment'}
                      </div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-white/65">{client.name}</div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="glass-panel rounded-[32px] border border-white/10 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-500" size={20} />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Cảnh báo mở</h3>
            </div>
            <div className="mt-4 space-y-3">
              {openCrises.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Hiện chưa có cảnh báo mở nào.
                </div>
              ) : (
                openCrises.slice(0, 4).map((item, index) => {
                  const client = getClientIdentity(item);
                  return (
                    <div
                      key={String(item.id ?? `${client.id}-${index}`)}
                      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 dark:border-red-400/20 dark:bg-red-500/10"
                    >
                      <div className="font-semibold text-red-700 dark:text-red-200">{client.name}</div>
                      <div className="mt-1 text-sm text-red-700/80 dark:text-red-100/75">
                        {typeof item.message_snippet === 'string' && item.message_snippet
                          ? item.message_snippet
                          : 'Miru phát hiện một tín hiệu cần được therapist chú ý.'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
