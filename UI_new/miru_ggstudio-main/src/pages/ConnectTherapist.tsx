import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircleHeart, Send, Sparkles, Stethoscope } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { publicTherapistDetailQueryOptions, queryKeys } from '../queries/appQueries';
import { buildPublicSiteUrl, buildPublicTherapistUrl } from '../services/api';
import { aliasPublicIdentity } from '../services/publicContent';
import {
  createTherapistContactRequest,
  type TherapistContactRequestCreate,
} from '../services/profiles';

type EntryIntent = 'message' | 'therapy';
type EntrySource =
  | 'directory'
  | 'profile_direct_link'
  | 'therapist_invite'
  | 'referral'
  | 'article';

function normalizeEntryIntent(value: string | null): EntryIntent {
  return value === 'message' ? 'message' : 'therapy';
}

function normalizeSource(value: string | null): EntrySource {
  switch (value) {
    case 'article':
    case 'profile_direct_link':
    case 'therapist_invite':
    case 'referral':
      return value;
    default:
      return 'profile_direct_link';
  }
}

function normalizeReturnTo(value: string | null, therapistId: string) {
  const fallback = buildPublicTherapistUrl(therapistId);
  if (!value) {
    return fallback;
  }

  try {
    const publicRoot = new URL(buildPublicSiteUrl('/'));
    const candidate = new URL(value, publicRoot);
    if (candidate.origin !== publicRoot.origin) {
      return fallback;
    }
    return candidate.toString();
  } catch {
    return fallback;
  }
}

function buildInitialForm(
  therapistId: string,
  serviceMode: string | null | undefined,
  source: EntrySource,
  sourceArticleSlug: string,
  entryIntent: EntryIntent
): TherapistContactRequestCreate {
  return {
    therapist_id: therapistId,
    message: '',
    preferred_contact_method: 'zalo',
    client_contact_phone: '',
    client_contact_zalo: '',
    service_interest:
      serviceMode === 'free' ? 'free' : serviceMode === 'paid' ? 'paid' : 'unsure',
    source,
    source_article_slug: sourceArticleSlug,
    entry_intent: entryIntent,
  };
}

function sourceLabel(source: EntrySource) {
  switch (source) {
    case 'article':
      return 'Bài viết Community';
    case 'profile_direct_link':
      return 'Hồ sơ therapist';
    case 'therapist_invite':
      return 'Therapist invite';
    case 'referral':
      return 'Giới thiệu';
    default:
      return 'Danh bạ therapist';
  }
}

function intentLabel(intent: EntryIntent) {
  return intent === 'message' ? 'Nhắn riêng therapist' : 'Đăng ký trị liệu';
}

function intentDescription(intent: EntryIntent) {
  return intent === 'message'
    ? 'Giữ tin nhắn ngắn gọn, nói rõ điều bạn muốn hỏi thêm sau khi đọc nội dung công khai.'
    : 'Mô tả ngắn nhu cầu của bạn để therapist đánh giá xem có phù hợp để bắt đầu một hành trình trị liệu hay không.';
}

export function ConnectTherapistPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const therapistId = searchParams.get('therapist_id') ?? '';
  const entryIntent = normalizeEntryIntent(searchParams.get('entry_intent'));
  const source = normalizeSource(searchParams.get('source'));
  const sourceArticleSlug = searchParams.get('source_article_slug') ?? '';
  const anonymousId = searchParams.get('anonymous_id');
  const sessionId = searchParams.get('session_id');
  const aliasAttemptedRef = useRef(false);

  const therapistQuery = useQuery({
    ...publicTherapistDetailQueryOptions(therapistId),
    enabled: Boolean(therapistId),
  });

  const therapist = therapistQuery.data?.profile ?? null;
  const returnTo = useMemo(
    () => normalizeReturnTo(searchParams.get('return_to'), therapistId),
    [searchParams, therapistId]
  );

  const [form, setForm] = useState<TherapistContactRequestCreate>(() =>
    buildInitialForm(therapistId, null, source, sourceArticleSlug, entryIntent)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildInitialForm(therapistId, therapist?.service_mode, source, sourceArticleSlug, entryIntent));
  }, [entryIntent, source, sourceArticleSlug, therapist?.service_mode, therapistId]);

  useEffect(() => {
    if (!user?.id || !anonymousId || aliasAttemptedRef.current) {
      return;
    }
    aliasAttemptedRef.current = true;
    void aliasPublicIdentity({
      anonymous_id: anonymousId,
      session_id: sessionId || undefined,
    }).catch(() => undefined);
  }, [anonymousId, sessionId, user?.id]);

  async function handleSubmit() {
    if (!therapist) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await createTherapistContactRequest({
        ...form,
        therapist_id: therapist.therapist_id,
        source,
        source_article_slug: sourceArticleSlug,
        entry_intent: entryIntent,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests.clientMe() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles.therapistMe() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles.publicTherapistDetail(therapist.therapist_id) });
      setSuccess(
        entryIntent === 'message'
          ? 'Tin nhắn riêng đã được gửi. Therapist sẽ thấy lead này trong inbox Community của họ.'
          : 'Yêu cầu trị liệu đã được gửi. Therapist sẽ thấy đầy đủ context và có thể phản hồi hoặc gửi pairing code cho bạn.'
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Không gửi được yêu cầu tới therapist'
      );
    } finally {
      setSaving(false);
    }
  }

  if (!therapistId) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-8 text-center text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          Thiếu `therapist_id` nên Miru chưa mở được composer phù hợp.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="glass-panel overflow-hidden rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                <Sparkles size={14} />
                Miru Community to App
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
                {intentLabel(entryIntent)}
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/65">
                Bạn đang chuyển từ Community sang không gian riêng tư của Miru. Ngữ cảnh từ {sourceLabel(source).toLowerCase()}
                {sourceArticleSlug ? ` và bài "${sourceArticleSlug}"` : ''} sẽ được giữ lại để therapist hiểu vì sao bạn đang kết nối.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Intent: {intentLabel(entryIntent)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Source: {sourceLabel(source)}
                </span>
                {sourceArticleSlug ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                    Article: /{sourceArticleSlug}
                  </span>
                ) : null}
              </div>
            </div>

            <a
              href={returnTo}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Quay lại Community
            </a>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="mb-5">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-white/35">
                Composer riêng tư
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {entryIntent === 'message' ? 'Nhắn riêng để hỏi thêm' : 'Gửi yêu cầu trị liệu'}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-white/60">
                {intentDescription(entryIntent)}
              </p>
            </div>

            {error ? (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                {success}
              </div>
            ) : null}

            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm text-slate-700 dark:text-white/70">Lời nhắn</span>
                <textarea
                  value={form.message}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, message: event.target.value }))
                  }
                  rows={6}
                  placeholder={
                    entryIntent === 'message'
                      ? 'Ví dụ: Mình vừa đọc bài viết của therapist và muốn hỏi thêm về một bước phù hợp để bắt đầu.'
                      : 'Ví dụ: Mình muốn tìm therapist phù hợp để bắt đầu trị liệu cho vấn đề mình đang gặp phải.'
                  }
                  className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-900 placeholder:text-slate-400 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-slate-700 dark:text-white/70">
                    Kênh liên hệ mong muốn
                  </span>
                  <select
                    value={form.preferred_contact_method}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        preferred_contact_method: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-miru-bg dark:text-white"
                  >
                    <option value="zalo">Zalo</option>
                    <option value="phone">Điện thoại</option>
                    <option value="email">Email</option>
                    <option value="facebook">Facebook</option>
                    <option value="other">Khác</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-700 dark:text-white/70">Nhu cầu dịch vụ</span>
                  <select
                    value={form.service_interest}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        service_interest:
                          event.target.value as TherapistContactRequestCreate['service_interest'],
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-miru-bg dark:text-white"
                  >
                    <option value="free">Ưu tiên miễn phí</option>
                    <option value="paid">Có thể làm việc có phí</option>
                    <option value="unsure">Chưa rõ, muốn được tư vấn thêm</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-slate-700 dark:text-white/70">
                    Số điện thoại
                  </span>
                  <input
                    value={form.client_contact_phone}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        client_contact_phone: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-slate-700 dark:text-white/70">Zalo</span>
                  <input
                    value={form.client_contact_zalo}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        client_contact_zalo: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => void handleSubmit()}
                disabled={saving || !therapist}
                className="inline-flex items-center gap-2 rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Send size={16} />
                {saving ? 'Đang gửi...' : entryIntent === 'message' ? 'Gửi tin nhắn riêng' : 'Gửi yêu cầu trị liệu'}
              </button>
              <a
                href={returnTo}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
              >
                Quay lại Community
              </a>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-white/35">
                Therapist
              </div>

              {therapistQuery.isLoading ? (
                <div className="mt-4 text-sm text-slate-500 dark:text-white/60">
                  Đang tải hồ sơ therapist...
                </div>
              ) : therapist ? (
                <>
                  <div className="mt-4 flex items-center gap-4">
                    {therapist.avatar_image?.url ? (
                      <img
                        src={therapist.avatar_image.url}
                        alt={therapist.display_name}
                        className="h-20 w-20 rounded-[24px] object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-miru-primary/15 text-3xl font-bold text-miru-primary">
                        {therapist.display_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                        {therapist.display_name}
                      </h3>
                      {therapist.headline ? (
                        <p className="mt-1 text-sm text-slate-600 dark:text-white/60">
                          {therapist.headline}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {therapist.bio ? (
                    <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-white/65">
                      {therapist.bio}
                    </p>
                  ) : null}

                  {therapist.specializations.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {therapist.specializations.slice(0, 6).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                      <div className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/35">
                        Surface
                      </div>
                      {sourceLabel(source)}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                      <div className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/35">
                        Handoff
                      </div>
                      {intentLabel(entryIntent)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
                  Không tải được hồ sơ therapist để mở composer.
                </div>
              )}
            </section>

            <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-white/35">
                {entryIntent === 'message' ? <MessageCircleHeart size={14} /> : <Stethoscope size={14} />}
                Private action
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/65">
                Trang này là cầu nối chuẩn giữa Community và Miru App. Therapist sẽ thấy rõ lead này đến từ đâu,
                bài viết nào đã khơi mở cuộc trò chuyện và ý định hiện tại của bạn là gì.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
