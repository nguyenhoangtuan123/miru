import { Clock, FileText, CheckCircle2, XCircle, Archive, Send, Eye } from 'lucide-react';
import type { Article } from '../../../services/articles';
import { formatArticleDate, getArticleStatusMeta } from '../../articles/articleUtils';

type ArticleHistoryPanelProps = {
    articles: Article[];
    onSelect: (article: Article) => void;
};

type HistoryEvent = {
    article: Article;
    date: string;
    type: 'created' | 'submitted' | 'published' | 'rejected' | 'archived' | 'updated';
    label: string;
};

function getStatusIcon(type: HistoryEvent['type']) {
    switch (type) {
        case 'published':
            return <Eye size={14} className="text-emerald-400" />;
        case 'submitted':
            return <Send size={14} className="text-amber-400" />;
        case 'rejected':
            return <XCircle size={14} className="text-rose-400" />;
        case 'archived':
            return <Archive size={14} className="text-white/40" />;
        case 'created':
            return <FileText size={14} className="text-miru-primary" />;
        default:
            return <Clock size={14} className="text-white/40" />;
    }
}

function getStatusDotClass(type: HistoryEvent['type']) {
    switch (type) {
        case 'published':
            return 'bg-emerald-400';
        case 'submitted':
            return 'bg-amber-400';
        case 'rejected':
            return 'bg-rose-400';
        case 'archived':
            return 'bg-white/20';
        case 'created':
            return 'bg-miru-primary';
        default:
            return 'bg-white/30';
    }
}

function buildTimeline(articles: Article[]): HistoryEvent[] {
    const events: HistoryEvent[] = [];

    for (const article of articles) {
        // Created event
        if (article.created_at) {
            events.push({
                article,
                date: article.created_at,
                type: 'created',
                label: 'Tạo bản nháp',
            });
        }

        // Submitted event
        if (article.review_requested_at) {
            events.push({
                article,
                date: article.review_requested_at,
                type: 'submitted',
                label: 'Gửi duyệt',
            });
        }

        // Published event
        if (article.published_at) {
            events.push({
                article,
                date: article.published_at,
                type: 'published',
                label: 'Đã đăng',
            });
        }

        // Rejected event
        if (article.rejection_reason && article.reviewed_at) {
            events.push({
                article,
                date: article.reviewed_at,
                type: 'rejected',
                label: 'Bị từ chối',
            });
        }

        // Archived event
        if (article.archived_at) {
            events.push({
                article,
                date: article.archived_at,
                type: 'archived',
                label: 'Lưu trữ',
            });
        }
    }

    // Sort by date descending (newest first)
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return events;
}

export function ArticleHistoryPanel({ articles, onSelect }: ArticleHistoryPanelProps) {
    const events = buildTimeline(articles);

    if (events.length === 0) {
        return null;
    }

    return (
        <section className="glass-panel rounded-[24px] border border-white/10 px-5 py-5">
            <div className="flex items-center gap-2">
                <Clock size={14} className="text-white/35" />
                <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">
                    Lịch sử hoạt động
                </div>
            </div>

            <div className="relative mt-4 space-y-0">
                {/* Timeline line */}
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/8" />

                {events.slice(0, 15).map((event, i) => {
                    const meta = getArticleStatusMeta(event.article.status);
                    return (
                        <button
                            key={`${event.article.id}-${event.type}-${i}`}
                            type="button"
                            onClick={() => onSelect(event.article)}
                            className="relative flex w-full items-start gap-3 rounded-xl px-0 py-2.5 text-left transition hover:bg-white/5 group"
                        >
                            {/* Dot */}
                            <div className={`relative z-10 mt-1.5 h-[15px] w-[15px] flex-shrink-0 rounded-full border-2 border-[#0f0f1e] ${getStatusDotClass(event.type)}`} />

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(event.type)}
                                    <span className="text-xs font-semibold text-white/70 group-hover:text-white transition">{event.label}</span>
                                </div>
                                <div className="mt-0.5 truncate text-[11px] text-white/40 group-hover:text-white/60 transition">
                                    {event.article.title || 'Bài chưa đặt tiêu đề'}
                                </div>
                                <div className="mt-0.5 text-[10px] text-white/25">
                                    {formatArticleDate(event.date)}
                                </div>
                            </div>
                        </button>
                    );
                })}

                {events.length > 15 && (
                    <div className="pl-7 pt-1 text-[10px] text-white/25">
                        +{events.length - 15} sự kiện khác
                    </div>
                )}
            </div>
        </section>
    );
}
