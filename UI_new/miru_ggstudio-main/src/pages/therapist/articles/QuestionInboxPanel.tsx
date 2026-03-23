import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  EyeOff,
  Inbox,
  MessageSquareQuote,
  RefreshCw,
  Send,
} from 'lucide-react';
import type { ArticleQuestion, ArticleQuestionStatus } from '../../../services/articles';
import {
  ARTICLE_QUESTION_FILTERS,
  ARTICLE_QUESTION_STATUS_META,
  normalizeArticleQuestion,
  summarizeArticleQuestions,
} from './articleQuestions';

type QuestionInboxPanelProps = {
  questions: ArticleQuestion[];
  filter: ArticleQuestionStatus | 'all';
  onFilterChange: (value: ArticleQuestionStatus | 'all') => void;
  onRefresh: () => void;
  onAnswer: (question: ArticleQuestion, answerText: string) => Promise<void> | void;
  onPublish: (question: ArticleQuestion) => Promise<void> | void;
  onHide: (question: ArticleQuestion) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  available?: boolean;
};

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${active
          ? 'bg-miru-primary/15 text-miru-primary'
          : 'border border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
        }`}
    >
      {label}
    </button>
  );
}

export function QuestionInboxPanel({
  questions,
  filter,
  onFilterChange,
  onRefresh,
  onAnswer,
  onPublish,
  onHide,
  loading = false,
  error,
  available = true,
}: QuestionInboxPanelProps) {
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});

  const summary = useMemo(() => summarizeArticleQuestions(questions), [questions]);
  const normalizedQuestions = useMemo(
    () => questions.map((question) => normalizeArticleQuestion(question)),
    [questions]
  );

  const visibleQuestions = useMemo(() => {
    const filtered =
      filter === 'all'
        ? normalizedQuestions
        : normalizedQuestions.filter((question) => question.status === filter);
    const priority: Record<ArticleQuestionStatus, number> = {
      pending_review: 0,
      answered: 1,
      published: 2,
      hidden: 3,
    };

    return [...filtered].sort((left, right) => {
      const statusGap = priority[left.status] - priority[right.status];
      if (statusGap !== 0) {
        return statusGap;
      }
      return (right.updatedAt ?? right.createdAt ?? '').localeCompare(left.updatedAt ?? left.createdAt ?? '');
    });
  }, [filter, normalizedQuestions]);

  async function handleAnswer(question: ArticleQuestion) {
    const normalized = normalizeArticleQuestion(question);
    const draft = (draftAnswers[normalized.id] ?? normalized.answerText ?? '').trim();
    if (!draft) {
      return;
    }
    await onAnswer(question, draft);
    setExpandedQuestionId(null);
  }

  return (
    <section className="glass-panel rounded-[28px] border border-white/10 p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/35">
            <Inbox size={14} />
            Miru Community
          </div>
          <h2 className="mt-2 font-['Plus_Jakarta_Sans'] text-[28px] font-bold tracking-tight text-white">
            Hộp thư cộng đồng
          </h2>
          <p className="mt-2 text-sm leading-7 text-white/50">
            Gom câu hỏi công khai dưới bài viết để bạn duyệt, trả lời hoặc ẩn khi cần.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
          Làm mới
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/35">Tổng</div>
          <div className="mt-2 font-['Plus_Jakarta_Sans'] text-3xl font-bold text-white">{summary.total}</div>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/35">Chờ duyệt</div>
          <div className="mt-2 font-['Plus_Jakarta_Sans'] text-3xl font-bold text-white">
            {summary.pending_review}
          </div>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/35">Đã trả lời</div>
          <div className="mt-2 font-['Plus_Jakarta_Sans'] text-3xl font-bold text-white">
            {summary.answered}
          </div>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/35">Đã ẩn</div>
          <div className="mt-2 font-['Plus_Jakarta_Sans'] text-3xl font-bold text-white">{summary.hidden}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {ARTICLE_QUESTION_FILTERS.map((item) => (
          <div key={item.value}>
            <FilterChip
              label={item.label}
              active={filter === item.value}
              onClick={() => onFilterChange(item.value)}
            />
          </div>
        ))}
      </div>

      {!available ? (
        <div className="mt-5 rounded-[20px] border border-dashed border-white/10 px-4 py-5 text-sm leading-7 text-white/50">
          Backend community Q&amp;A chưa sẵn sàng. Khi moderation API được bật, inbox này sẽ tự hiện câu hỏi theo từng bài viết.
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-[20px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 rounded-[20px] border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/50">
          Đang tải câu hỏi cộng đồng...
        </div>
      ) : null}

      {!loading && visibleQuestions.length === 0 ? (
        <div className="mt-5 rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-center text-sm leading-7 text-white/50">
          Chưa có câu hỏi nào trong bộ lọc này. Khi người đọc để lại câu hỏi, Miru sẽ gom về đây để bạn xử lý.
        </div>
      ) : null}

      <div className="mt-5 space-y-3 xl:max-h-[36rem] xl:overflow-y-auto xl:pr-1">
        {visibleQuestions.map((question) => {
          const meta = ARTICLE_QUESTION_STATUS_META[question.status];
          const isExpanded = expandedQuestionId === question.id;
          const draft = draftAnswers[question.id] ?? question.answerText;
          const hasAnswer = Boolean(question.answerText);

          return (
            <article key={question.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.className}`}>
                    {meta.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
                    {question.pseudonym}
                  </span>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                    {question.articleTitle}
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">{question.questionText}</div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-white/35">
                  <span>Đăng: {question.createdAt ?? '-'}</span>
                  <span>Cập nhật: {question.updatedAt ?? '-'}</span>
                  {question.publishedAt ? <span>Công khai: {question.publishedAt}</span> : null}
                  {question.answeredAt ? <span>Trả lời: {question.answeredAt}</span> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedQuestionId(isExpanded ? null : question.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10"
                  >
                    <MessageSquareQuote size={16} />
                    {isExpanded ? 'Đóng phản hồi' : hasAnswer ? 'Sửa trả lời' : 'Trả lời'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onPublish(question)}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    <CheckCircle2 size={16} />
                    Đăng công khai
                  </button>
                  <button
                    type="button"
                    onClick={() => void onHide(question)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10"
                  >
                    <EyeOff size={16} />
                    Ẩn
                  </button>
                </div>
              </div>

              {hasAnswer ? (
                <div className="mt-4 rounded-[18px] border border-sky-400/20 bg-sky-500/10 px-4 py-4 text-sm leading-7 text-sky-200">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-400">
                    Trả lời hiện có
                  </div>
                  <p className="mt-2">{question.answerText}</p>
                </div>
              ) : null}

              {isExpanded ? (
                <div className="mt-4 rounded-[18px] border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                    Phản hồi của therapist
                  </div>
                  <textarea
                    value={draft}
                    onChange={(event) =>
                      setDraftAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    placeholder="Viết câu trả lời ngắn, rõ và hữu ích cho cộng đồng..."
                    className="mt-3 min-h-[120px] w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-white/80 outline-none placeholder:text-white/20 focus:ring-2 focus:ring-miru-primary/40"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAnswer(question)}
                      className="inline-flex items-center gap-2 rounded-full bg-miru-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(127,13,242,0.25)] transition hover:bg-miru-primary/85"
                    >
                      <Send size={16} />
                      Lưu trả lời
                    </button>
                    <button
                      type="button"
                      onClick={() => void onPublish(question)}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 size={16} />
                      Đăng công khai
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
