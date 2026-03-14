import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, Link as LinkIcon, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  approveTherapistContactRequest,
  archiveTherapistContactRequest,
  declineTherapistContactRequest,
  type TherapistContactRequest,
} from '../../services/profiles';
import { queryKeys, therapistContactRequestsQueryOptions } from '../../queries/appQueries';

const statusLabels: Record<string, string> = {
  all: 'Tất cả',
  pending: 'Đang chờ',
  approved: 'Đã chấp nhận',
  declined: 'Đã từ chối',
  archived: 'Đã lưu trữ',
};

export function TherapistContactRequestsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('pending');
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestsQuery = useQuery(therapistContactRequestsQueryOptions(status === 'all' ? undefined : status));
  const requests = (requestsQuery.data?.requests ?? []) as TherapistContactRequest[];
  const error = requestsQuery.error instanceof Error ? requestsQuery.error.message : null;

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === 'pending').length,
    [requests]
  );

  async function refreshAll() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests.therapistInbox() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests.clientMe() });
  }

  async function handleApprove(item: TherapistContactRequest, sharePairingCode: boolean) {
    try {
      setBusyId(item.id);
      setMessage(null);
      await approveTherapistContactRequest(item.id, {
        therapist_reply: item.service_interest === 'paid'
          ? 'Tôi đã nhận yêu cầu. Nếu bạn phù hợp, tôi sẽ trao đổi thêm về lịch và chi phí.'
          : 'Tôi đã nhận yêu cầu. Mình có thể bắt đầu bằng buổi trao đổi đầu tiên để hiểu nhu cầu của bạn.',
        share_pairing_code: sharePairingCode,
      });
      await refreshAll();
      setMessage(sharePairingCode ? 'Đã chấp nhận và gửi kèm pairing code.' : 'Đã chấp nhận yêu cầu liên hệ.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(item: TherapistContactRequest) {
    try {
      setBusyId(item.id);
      setMessage(null);
      await declineTherapistContactRequest(item.id, {
        therapist_reply: 'Hiện tại tôi chưa thể tiếp nhận ca này. Bạn có thể tìm therapist khác phù hợp hơn trong danh bạ.',
        share_pairing_code: false,
      });
      await refreshAll();
      setMessage('Đã từ chối yêu cầu liên hệ.');
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
        <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                <Inbox size={14} />
                Inbox liên hệ
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">Yêu cầu liên hệ từ danh bạ công khai</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-white/60">
                Bạn có {pendingCount} yêu cầu đang chờ xử lý. Sau khi chấp nhận, bạn có thể gửi pairing code
                để thân chủ tiếp tục đi vào luồng kết nối nội bộ.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
              Đăng nhập: {user?.name || user?.email}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {Object.entries(statusLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                status === key
                  ? 'border-miru-primary/40 bg-miru-primary/15 text-miru-primary'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

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
                <div key={index} className="glass-panel h-40 animate-pulse rounded-[28px] border border-white/10 bg-white/5" />
              ))
            : requests.map((item) => (
                <article
                  key={item.id}
                  className="glass-panel rounded-[28px] border border-white/10 p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                          {item.client?.name || item.client?.email || item.client_id}
                        </h2>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                          {statusLabels[item.status] || item.status}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                          Nhu cầu: {item.service_interest === 'free' ? 'Miễn phí' : item.service_interest === 'paid' ? 'Có phí' : 'Chưa rõ'}
                        </span>
                      </div>

                      {item.message && <p className="max-w-3xl text-sm leading-7 text-slate-700 dark:text-white/75">{item.message}</p>}

                      <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-white/55">
                        {item.preferred_contact_method && <span>Kênh mong muốn: {item.preferred_contact_method}</span>}
                        {item.client_contact_phone && <span>Điện thoại: {item.client_contact_phone}</span>}
                        {item.client_contact_zalo && <span>Zalo: {item.client_contact_zalo}</span>}
                      </div>

                      {item.therapist_reply && (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                          <div className="mb-1 text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-white/35">Phản hồi của bạn</div>
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

                    <div className="flex flex-wrap gap-3 lg:w-[320px] lg:justify-end">
                      {item.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => void handleApprove(item, false)}
                            disabled={busyId === item.id}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                          >
                            <Check size={16} />
                            Chấp nhận
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
                      ) : (
                        <button
                          onClick={() => void handleArchive(item)}
                          disabled={busyId === item.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                        >
                          Lưu trữ
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
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
