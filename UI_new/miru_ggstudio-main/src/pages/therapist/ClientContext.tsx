import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Brain, ClipboardList, NotebookPen, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  therapistSharedActivitiesQueryOptions,
  therapistSharedAssessmentsQueryOptions,
  therapistSharedChatQueryOptions,
  therapistSharedContextOverviewQueryOptions,
  therapistSharedInsightsQueryOptions,
} from '../../queries/appQueries';
import type { SharedContextResponse, SharedContextOverview, SharingAccessLevel } from '../../services/therapistSharing';

function SummaryBlock({
  title,
  response,
  isLoading,
}: {
  title: string;
  response?: SharedContextResponse;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
        Đang tải {title.toLowerCase()}...
      </div>
    );
  }

  if (!response) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
        Chưa có dữ liệu để hiển thị.
      </div>
    );
  }

  if (response.data && 'summary' in response.data) {
    const highlights = Array.isArray(response.data.highlights)
      ? response.data.highlights.filter((item): item is string => typeof item === 'string')
      : [];
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="mb-2 flex items-center gap-2 text-sm text-miru-primary">
          <Sparkles size={16} />
          Báo cáo AI tổng quát
        </div>
        <p className="text-sm text-white/80">{response.data.summary}</p>
        {highlights.length > 0 && (
          <div className="mt-4 space-y-2">
            {highlights.map((item) => (
              <div key={item} className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-white/65">
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 text-sm text-emerald-300">Đang xem dữ liệu trực tiếp</div>
      <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950/50 p-4 text-xs text-slate-200">
        {JSON.stringify(response.data, null, 2)}
      </pre>
    </div>
  );
}

function AccessBadge({ level }: { level: SharingAccessLevel }) {
  const styles = {
    none: 'bg-white/8 text-white/45',
    ai_report: 'bg-amber-400/15 text-amber-200',
    direct: 'bg-emerald-400/15 text-emerald-200',
  } as const;

  const labels = {
    none: 'Không chia sẻ',
    ai_report: 'Chỉ báo cáo AI',
    direct: 'Chia sẻ trực tiếp',
  } as const;

  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[level]}`}>{labels[level]}</span>;
}

export function TherapistClientContextPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const overviewQuery = useQuery({
    ...therapistSharedContextOverviewQueryOptions(id ?? ''),
    enabled: Boolean(id),
  });

  const overview = overviewQuery.data as SharedContextOverview | undefined;
  const accessMap = {
    ai_chat: overview?.consent.ai_chat_access ?? 'none',
    web_activity: overview?.consent.web_activity_access ?? 'none',
    assessment_results: overview?.consent.assessment_access ?? 'none',
    ai_insights: overview?.consent.insights_access ?? 'none',
  } as const;

  const chatQuery = useQuery({
    ...therapistSharedChatQueryOptions(id ?? '', accessMap.ai_chat === 'ai_report'),
    enabled: Boolean(id && accessMap.ai_chat !== 'none'),
  });
  const activitiesQuery = useQuery({
    ...therapistSharedActivitiesQueryOptions(id ?? '', accessMap.web_activity === 'ai_report'),
    enabled: Boolean(id && accessMap.web_activity !== 'none'),
  });
  const assessmentsQuery = useQuery({
    ...therapistSharedAssessmentsQueryOptions(id ?? '', accessMap.assessment_results === 'ai_report'),
    enabled: Boolean(id && accessMap.assessment_results !== 'none'),
  });
  const insightsQuery = useQuery({
    ...therapistSharedInsightsQueryOptions(id ?? '', accessMap.ai_insights === 'ai_report'),
    enabled: Boolean(id && accessMap.ai_insights !== 'none'),
  });

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <button
        onClick={() => navigate(`/therapist/clients/${id}`)}
        className="mb-6 flex items-center gap-2 text-white/60 transition-colors hover:text-white"
      >
        <ArrowLeft size={18} />
        Quay lại hồ sơ thân chủ
      </button>

      <div className="glass-panel mb-8 p-8">
        <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/45">
          Bối cảnh AI và hoạt động
        </div>
        <h1 className="text-3xl font-bold text-white">
          {overview?.client_name || 'Thân chủ'}: dữ liệu chia sẻ cho therapist
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-white/60">
          Màn này chỉ hiển thị những nhóm dữ liệu mà thân chủ đã cho phép chia sẻ. Với mức “Chỉ báo cáo AI”, bạn sẽ chỉ thấy bản tóm tắt mức cao.
        </p>
      </div>

      {overviewQuery.error instanceof Error && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {overviewQuery.error.message}
        </div>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { key: 'ai_chat', label: 'Chat với AI', icon: Brain, level: accessMap.ai_chat },
          { key: 'web_activity', label: 'Hoạt động web', icon: NotebookPen, level: accessMap.web_activity },
          { key: 'assessment_results', label: 'Thang đo', icon: ClipboardList, level: accessMap.assessment_results },
          { key: 'ai_insights', label: 'AI insights', icon: Sparkles, level: accessMap.ai_insights },
        ].map((item) => (
          <div key={item.key} className="glass-panel p-5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-miru-primary/15 text-miru-primary">
              <item.icon size={20} />
            </div>
            <div className="mb-2 font-semibold text-white">{item.label}</div>
            <AccessBadge level={item.level} />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass-panel p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Chat với AI</h2>
            <AccessBadge level={accessMap.ai_chat} />
          </div>
          {accessMap.ai_chat === 'none' ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
              Thân chủ chưa chia sẻ nhóm dữ liệu này.
            </div>
          ) : (
            <SummaryBlock title="chat với AI" response={chatQuery.data} isLoading={chatQuery.isLoading} />
          )}
        </div>

        <div className="glass-panel p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Hoạt động trên web</h2>
            <AccessBadge level={accessMap.web_activity} />
          </div>
          {accessMap.web_activity === 'none' ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
              Thân chủ chưa chia sẻ nhóm dữ liệu này.
            </div>
          ) : (
            <SummaryBlock title="hoạt động trên web" response={activitiesQuery.data} isLoading={activitiesQuery.isLoading} />
          )}
        </div>

        <div className="glass-panel p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Kết quả thang đo</h2>
            <AccessBadge level={accessMap.assessment_results} />
          </div>
          {accessMap.assessment_results === 'none' ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
              Thân chủ chưa chia sẻ nhóm dữ liệu này.
            </div>
          ) : (
            <SummaryBlock title="kết quả thang đo" response={assessmentsQuery.data} isLoading={assessmentsQuery.isLoading} />
          )}
        </div>

        <div className="glass-panel p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">AI insights</h2>
            <AccessBadge level={accessMap.ai_insights} />
          </div>
          {accessMap.ai_insights === 'none' ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
              Thân chủ chưa chia sẻ nhóm dữ liệu này.
            </div>
          ) : (
            <SummaryBlock title="AI insights" response={insightsQuery.data} isLoading={insightsQuery.isLoading} />
          )}
        </div>
      </div>
    </div>
  );
}
