import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, Inbox, Link as LinkIcon, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  approveTherapistContactRequest,
  archiveTherapistContactRequest,
  declineTherapistContactRequest,
  type TherapistContactRequest,
} from '../../services/profiles';
import { queryKeys, therapistContactRequestsQueryOptions } from '../../queries/appQueries';

const funnelTabs = [
  { key: 'all', label: 'Tất cả' },
  { key: 'new', label: 'Lead mới' },
  { key: 'replied', label: 'Đã phản hồi' },
  { key: 'approved', label: 'Đã gửi mã' },
  { key: 'paired', label: 'Đã pair' },
  { key: 'lost', label: 'Đã mất' },
] as const;

function getFunnelLabel(value: string) {
  switch (value) {
    case 'new':
      return 'Lead mới';
    case 'replied':
      return 'Đã phản hồi';
    case 'approved':
      return 'Đã gửi mã';
    case 'paired':
      return 'Đã pair';
    case 'lost':
      return 'Đã mất';
    default:
      return value;
  }
}

function getSourceLabel(value?: string | null) {
  switch (value) {
    case 'profile_direct_link':
      return 'Link hồ sơ';
    case 'therapist_invite':
      return 'Therapist invite';
    case 'referral':
      return 'Giới thiệu';
    default:
      return 'Danh bạ';
  }
}

function getNormalizedSourceLabel(value?: string | null) {
  const legacyLabel = getSourceLabel(value);
  switch (value) {
    case 'article':
      return 'Bài viết Community';
    case 'profile_direct_link':
      return 'Hồ sơ therapist';
    case 'therapist_invite':
      return 'Therapist invite';
    case 'referral':
      return 'Giới thiệu';
    default:
      return legacyLabel;
  }
}

function getIntentLabel(value?: string | null) {
  return value === 'message' ? 'Nhắn riêng' : 'Đăng ký trị liệu';
}

function formatLatency(item: TherapistContactRequest) {
  if (typeof item.response_time_hours === 'number') {
    return `Đã phản hồi sau ${item.response_time_hours} giờ`;
  }
  if (!item.created_at) {
    return 'Chưa có mốc thời gian';
  }
  const createdAt = new Date(item.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return 'Chưa có mốc thời gian';
  }
  const diffHours = Math.max((Date.now() - createdAt.getTime()) / 3_600_000, 0);
  if (diffHours < 1) {
    return 'Vừa vào inbox';
  }
  if (diffHours < 24) {
    return `Đang chờ phản hồi ${diffHours.toFixed(1)} giờ`;
  }
  return `Đang chờ phản hồi ${Math.round(diffHours / 24)} ngày`;
}

function defaultApproveReply(item: TherapistContactRequest) {
  if (item.service_interest === 'paid') {
    return 'Mình đã nhận yêu cầu. Nếu phù hợp, mình sẽ trao đổi thêm về lịch làm việc và mức phí trước khi bắt đầu.';
  }
  return 'Mình đã nhận yêu cầu. Chúng ta có thể bắt đầu bằng một buổi trao đổi ngắn để hiểu rõ nhu cầu của bạn.';
}

function defaultDeclineReply() {
  return 'Hiện tại mình chưa thể nhận ca này. Bạn có thể tiếp tục tìm therapist phù hợp hơn trong danh bạ công khai của Miru.';
}

export function TherapistContactRequestsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<string>('new');
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const allRequestsQuery = useQuery(therapistContactRequestsQueryOptions());
  const requestsQuery = useQuery(
    therapistContactRequestsQueryOptions(tab === 'all' ? undefined : tab)
  );
  const requests = (requestsQuery.data?.requests ?? []) as TherapistContactRequest[];
  const allRequests = (allRequestsQuery.data?.requests ?? []) as TherapistContactRequest[];
  const error = requestsQuery.error instanceof Error ? requestsQuery.error.message : null;

  const stats = useMemo(() => {
    const counts = {
      all: allRequests.length,
      new: 0,
      replied: 0,
      approved: 0,
      paired: 0,
      lost: 0,
    };
    for (const item of allRequests) {
      const key = item.funnel_status ?? 'new';
      if (key in counts) {
        counts[key as keyof typeof counts] += 1;
      }
    }
    return counts;
  }, [allRequests]);

  async function refreshAll() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests.therapistInbox() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests.clientMe() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.profiles.therapistMe() });
  }

  async function handleApprove(item: TherapistContactRequest, sharePairingCode: boolean) {
    try {
      setBusyId(item.id);
      setMessage(null);
      await approveTherapistContactRequest(item.id, {
        therapist_reply: defaultApproveReply(item),
        share_pairing_code: sharePairingCode,
      });
      await refreshAll();
      setMessage(
        sharePairingCode
          ? 'Đã chấp nhận yêu cầu và gửi pairing code.'
          : 'Đã phản hồi tích cực cho lead này.'
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(item: TherapistContactRequest) {
    try {
      setBusyId(item.id);
      setMessage(null);
      await declineTherapistContactRequest(item.id, {
        therapist_reply: defaultDeclineReply(),
        share_pairing_code: false,
      });
      await refreshAll();
      setMessage('Đã đánh dấu lead này là không phù hợp ở thời điểm hiện tại.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(item: TherapistContactRequest) {
    try {
      setBusyId(item.id);
      setMessage(null);
      await archiveTherapistContactRequest(item.id);
      await refreshAll();
      setMessage('Đã lưu trữ yêu cầu liên hệ.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                <Inbox size={14} />
                Lead funnel
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
                Inbox yêu cầu liên hệ
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-white/60">
                Đây là tầng đầu của phễu nhận thân chủ. Phản hồi nhanh, gửi pairing code đúng lúc
                và giữ hồ sơ công khai rõ ràng sẽ giúp tăng tỷ lệ chuyển đổi.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
              Đang đăng nhập: {user?.name || user?.email}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {funnelTabs.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`rounded-[24px] border px-4 py-4 text-left transition-colors ${
                tab === tabItem.key
                  ? 'border-miru-primary/35 bg-miru-primary/12 text-miru-primary'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10'
              }`}
            >
              <div className="text-xs uppercase tracking-[0.25em]">{tabItem.label}</div>
              <div className="mt-2 text-2xl font-bold">
                {stats[tabItem.key as keyof typeof stats] ?? 0}
              </div>
            </button>
          ))}
        </section>

        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {requestsQuery.isLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="glass-panel h-44 animate-pulse rounded-[28px] border border-white/10 bg-white/5"
                />
              ))
            : requests.map((item) => {
                const isPendingLike =
                  item.funnel_status === 'new' || item.funnel_status === 'replied';
                const canSendPairingCode =
                  item.funnel_status === 'replied' ||
                  (item.funnel_status === 'approved' && !item.shared_pairing_code);

                return (
                  <article
                    key={item.id}
                    className="glass-panel rounded-[28px] border border-white/10 p-6"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                            {item.client?.name || item.client?.email || item.client_id}
                          </h2>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                            {getFunnelLabel(item.funnel_status)}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                            Nguồn: {getNormalizedSourceLabel(item.source)}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                            Intent: {getIntentLabel(item.entry_intent)}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                            Nhu cầu: {item.service_interest === 'free' ? 'Miễn phí' : item.service_interest === 'paid' ? 'Có phí' : 'Chưa rõ'}
                          </span>
                          {item.source_article_slug ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                              Bài: /{item.source_article_slug}
                            </span>
                          ) : null}
                        </div>

                        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-white/40">
                          <Clock3 size={14} />
                          {formatLatency(item)}
                        </div>

                        {item.message && (
                          <p className="max-w-3xl text-sm leading-7 text-slate-700 dark:text-white/75">
                            {item.message}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-white/55">
                          {item.preferred_contact_method && (
                            <span>Kênh mong muốn: {item.preferred_contact_method}</span>
                          )}
                          {item.client_contact_phone && <span>Điện thoại: {item.client_contact_phone}</span>}
                          {item.client_contact_zalo && <span>Zalo: {item.client_contact_zalo}</span>}
                        </div>

                        {item.therapist_reply && (
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                            <div className="mb-1 text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-white/35">
                              Phản hồi gần nhất
                            </div>
                            {item.therapist_reply}
                          </div>
                        )}

                        {item.shared_pairing_code && (
                          <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                            <LinkIcon size={16} />
                            Pairing code đã chia sẻ: <strong>{item.shared_pairing_code}</strong>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 lg:w-[340px] lg:justify-end">
                        {isPendingLike && (
                          <>
                            <button
                              onClick={() => void handleApprove(item, false)}
                              disabled={busyId === item.id}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                            >
                              <MessageCircle size={16} />
                              Phản hồi nhanh
                            </button>
                            <button
                              onClick={() => void handleApprove(item, true)}
                              disabled={busyId === item.id}
                              className="inline-flex items-center gap-2 rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              <LinkIcon size={16} />
                              Chấp nhận + gửi mã
                            </button>
                            <button
                              onClick={() => void handleDecline(item)}
                              disabled={busyId === item.id}
                              className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100"
                            >
                              <X size={16} />
                              Từ chối
                            </button>
                          </>
                        )}

                        {canSendPairingCode && (
                          <button
                            onClick={() => void handleApprove(item, true)}
                            disabled={busyId === item.id}
                            className="inline-flex items-center gap-2 rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            <LinkIcon size={16} />
                            Gửi pairing code
                          </button>
                        )}

                        {!isPendingLike && !canSendPairingCode && (
                          <button
                            onClick={() => void handleArchive(item)}
                            disabled={busyId === item.id}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                          >
                            <Check size={16} />
                            Lưu trữ
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
        </div>

        {!requestsQuery.isLoading && requests.length === 0 && (
          <div className="glass-panel rounded-[28px] border border-white/10 px-6 py-12 text-center text-slate-500 dark:text-white/55">
            Chưa có yêu cầu liên hệ nào trong nhóm lọc hiện tại.
          </div>
        )}
      </div>
    </div>
  );
}
