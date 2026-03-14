import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  BookHeart,
  BrainCircuit,
  Compass,
  IdCard,
  LoaderCircle,
  MessageCircle,
  Save,
  Sparkles,
  Stethoscope,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { repairMojibake } from '../lib/text';
import { saveJournalEntry } from '../services/backend';
import type { JournalEntry, MomentItem } from '../services/contracts';
import { TherapistDirectoryCard } from '../components/profiles/TherapistDirectoryCard';
import { type TherapistPublicProfileCard } from '../services/profiles';
import {
  checkinStatusQueryOptions,
  journalEntriesQueryOptions,
  momentsQueryOptions,
  proactiveMessageQueryOptions,
  publicTherapistsQueryOptions,
  queryKeys,
} from '../queries/appQueries';

type MoodPoint = {
  name: string;
  mood: number;
};

function parseMomentScore(moment: MomentItem) {
  const directKeys = ['emotion_score', 'score', 'last_score'];

  for (const key of directKeys) {
    const value = moment[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(10, value)) * 10;
    }
  }

  const textKeys = ['summary_text', 'summary', 'content', 'text'];

  for (const key of textKeys) {
    const value = moment[key];
    if (typeof value !== 'string') {
      continue;
    }

    const match = value.match(/(\d{1,2})\/10/);
    if (match) {
      return Math.max(0, Math.min(10, Number(match[1]))) * 10;
    }
  }

  return null;
}

function parseMomentDate(moment: MomentItem) {
  const dateKeys = ['date', 'created_at', 'timestamp', 'analyzed_at'];

  for (const key of dateKeys) {
    const value = moment[key];
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return null;
}

function buildMoodChart(moments: MomentItem[]): MoodPoint[] {
  return moments
    .map((moment, index) => {
      const score = parseMomentScore(moment);
      const date = parseMomentDate(moment);

      if (score === null) {
        return null;
      }

      return {
        name: date ? format(date, 'dd/MM') : `M${index + 1}`,
        mood: score,
      };
    })
    .filter((item): item is MoodPoint => Boolean(item))
    .slice(-7);
}

function DashboardActionCards() {
  const navigate = useNavigate();

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-2">
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate('/therapists')}
        className="glass-panel relative overflow-hidden p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:bg-white/10"
      >
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(127,13,242,0.22),transparent_65%)]" />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-miru-primary/18 text-miru-primary">
            <Compass size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold">Tìm therapist</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/62">
            Xem danh bạ therapist công khai, hồ sơ giới thiệu và cách liên hệ ngoài app trước khi
            pairing.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-miru-primary">
            Xem danh bạ
            <ArrowRight size={16} />
          </span>
        </div>
      </motion.button>

      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onClick={() => navigate('/profile')}
        className="glass-panel relative overflow-hidden p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:bg-white/10"
      >
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_65%)]" />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/14 text-sky-200">
            <IdCard size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold">Hồ sơ của tôi</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/62">
            Viết giới thiệu ngắn và thêm ảnh tùy chọn để therapist đã pairing hiểu bạn nhanh hơn.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-sky-200">
            Cập nhật hồ sơ
            <ArrowRight size={16} />
          </span>
        </div>
      </motion.button>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [diaryEntry, setDiaryEntry] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? '';
  const journalsQuery = useQuery({
    ...journalEntriesQueryOptions(userId, 5),
    enabled: Boolean(user?.id),
  });
  const momentsQuery = useQuery({
    ...momentsQueryOptions(userId, 7),
    enabled: Boolean(user?.id),
  });
  const checkinQuery = useQuery({
    ...checkinStatusQueryOptions(userId),
    enabled: Boolean(user?.id),
  });
  const proactiveQuery = useQuery({
    ...proactiveMessageQueryOptions(userId),
    enabled: Boolean(user?.id),
  });

  const diaries = journalsQuery.data?.entries ?? [];
  const moodPoints = useMemo(
    () => buildMoodChart(momentsQuery.data?.moments ?? []),
    [momentsQuery.data?.moments]
  );
  const streak = checkinQuery.data?.streak ?? 0;
  const lastScore = checkinQuery.data?.last_score ?? null;
  const hasCheckedInToday = Boolean(checkinQuery.data?.has_checked_in_today);
  const proactiveMessage = repairMojibake(
    proactiveQuery.data?.message ??
      'Miru sẽ gợi ý dựa trên dữ liệu thật của bạn khi backend phản hồi.'
  );
  const isLoading =
    journalsQuery.isLoading ||
    momentsQuery.isLoading ||
    checkinQuery.isLoading ||
    proactiveQuery.isLoading;
  const queryError =
    journalsQuery.error ??
    momentsQuery.error ??
    checkinQuery.error ??
    proactiveQuery.error;

  const handleSaveDiary = async () => {
    if (!user?.id || !diaryEntry.trim()) {
      return;
    }

    const content = diaryEntry.trim();

    try {
      setIsSaving(true);
      setError(null);

      const title = content.length <= 48 ? content : `${content.slice(0, 45)}...`;
      const response = await saveJournalEntry({
        user_id: user.id,
        content,
        title,
      });

      if (!response.success) {
        throw new Error(response.error ?? 'Không lưu được nhật ký');
      }

      const nextEntry: JournalEntry = {
        id: response.id,
        user_id: user.id,
        title,
        content,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData(
        journalEntriesQueryOptions(user.id, 5).queryKey,
        (current: { success?: boolean; entries?: JournalEntry[] } | undefined) => ({
          success: true,
          entries: [nextEntry, ...(current?.entries ?? [])].slice(0, 5),
        })
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all(user.id) });
      setDiaryEntry('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được nhật ký');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-32 pt-12 md:px-8">
      <header className="mb-10">
        <h1 className="mb-2 text-3xl font-bold md:text-4xl">
          Chào, {repairMojibake(user?.name || user?.email?.split('@')[0] || 'bạn')}!
        </h1>
        <p className="text-white/60">
          Trang này đang đọc dữ liệu thật từ journal, mood check-in và proactive message.
        </p>
      </header>

      {error || queryError ? (
        <div role="alert" className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {repairMojibake(
            error ?? (queryError instanceof Error ? queryError.message : 'Không tải được dữ liệu trang chủ')
          )}
        </div>
      ) : null}

      <DashboardActionCards />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-6"
          >
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <BookHeart className="text-miru-primary" size={24} />
              Nhật ký hôm nay
            </h2>
            <textarea
              value={diaryEntry}
              onChange={(event) => setDiaryEntry(event.target.value)}
              placeholder="Viết ra những suy nghĩ và cảm xúc của bạn lúc này..."
              className="mb-4 h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-4 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveDiary}
                disabled={!diaryEntry.trim() || isSaving}
                className="glass-button flex items-center gap-2 px-6 py-2.5 font-semibold disabled:opacity-50"
              >
                {isSaving ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {isSaving ? 'Đang lưu...' : 'Lưu nhật ký'}
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel rounded-3xl p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Nhật ký gần đây</h2>
              {isLoading ? (
                <span className="flex items-center gap-2 text-sm text-white/40">
                  <LoaderCircle size={14} className="animate-spin" />
                  Đang đồng bộ
                </span>
              ) : null}
            </div>
            <div className="space-y-4">
              {diaries.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                  Chưa có nhật ký nào được lưu.
                </div>
              ) : (
                diaries.map((diary) => (
                  <div
                    key={String(diary.id ?? diary.created_at)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <p className="mb-2 text-sm text-miru-primary">
                      {diary.created_at
                        ? format(new Date(diary.created_at), 'EEEE, dd MMMM yyyy', {
                            locale: vi,
                          })
                        : 'Không rõ thời gian'}
                    </p>
                    <p className="leading-relaxed text-white/80">{repairMojibake(diary.content)}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel rounded-3xl p-6"
          >
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
              <TrendingUp className="text-miru-primary" size={24} />
              Biểu đồ cảm xúc
            </h2>
            <div className="h-64 w-full">
              {moodPoints.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-sm text-white/40">
                  Chưa đủ dữ liệu mood check-in để vẽ biểu đồ.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={moodPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7f0df2" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#7f0df2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="rgba(255,255,255,0.5)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.5)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(20,20,20,0.9)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                      }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="mood"
                      stroke="#7f0df2"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorMood)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="mt-4 text-center text-sm text-white/50">
              {hasCheckedInToday
                ? `Bạn đã check-in hôm nay. Điểm gần nhất: ${lastScore ?? '--'}/10`
                : 'Bạn chưa check-in hôm nay.'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel rounded-3xl border-miru-primary/30 bg-gradient-to-br from-miru-primary/20 to-transparent p-6"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Gợi ý hôm nay</h3>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  streak > 0 ? 'bg-white/10 text-white/80' : 'bg-white/5 text-white/50'
                )}
              >
                Streak {streak} ngày
              </span>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-white/70">
              {repairMojibake(proactiveMessage)}
            </p>
            <button
              onClick={() => navigate('/therapists')}
              className="flex items-center gap-1 text-sm font-medium text-miru-primary transition-colors hover:text-white"
            >
              Tìm therapist <ArrowRight size={16} />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const publicTherapistsQuery = useQuery({
    ...publicTherapistsQueryOptions(3),
    enabled: !user,
  });

  if (user) {
    return <Dashboard />;
  }

  const publicTherapists: TherapistPublicProfileCard[] = publicTherapistsQuery.data?.therapists ?? [];
  const loadingPublicTherapists = publicTherapistsQuery.isLoading;

  const features = [
    {
      icon: <MessageCircle className="text-miru-primary" size={24} />,
      title: 'Trò chuyện AI',
      description:
        'Tâm sự mọi lúc mọi nơi với Miru, người bạn luôn lắng nghe và thấu hiểu.',
    },
    {
      icon: <BrainCircuit className="text-miru-primary" size={24} />,
      title: 'Bản đồ ký ức',
      description:
        'Ghi lại và kết nối những khoảnh khắc quan trọng trong cuộc sống của bạn.',
    },
    {
      icon: <Activity className="text-miru-primary" size={24} />,
      title: 'Theo dõi cảm xúc',
      description: 'Nhìn lại hành trình cảm xúc để hiểu rõ hơn về bản thân mình.',
    },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-x-hidden px-6 pb-32 pt-20">
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[50vw] w-[50vw] rounded-full bg-miru-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[60vw] w-[60vw] rounded-full bg-blue-500/10 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 mb-24 mt-10 max-w-3xl text-center md:mt-20"
      >
        <div className="glass-panel mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2">
          <Sparkles size={16} className="text-miru-primary" />
          <span className="text-sm font-medium">AI Mental Health Companion</span>
        </div>

        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Chăm sóc tinh thần cùng{' '}
          <span className="bg-gradient-to-r from-miru-primary to-purple-400 bg-clip-text text-transparent">
            Miru
          </span>
        </h1>

        <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
          Người bạn đồng hành AI thấu hiểu cảm xúc của bạn, giúp bạn ghi lại ký ức
          và chăm sóc sức khỏe tinh thần mỗi ngày.
        </p>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => navigate('/auth/login')}
            className="glass-button inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold"
          >
            Bắt đầu ngay
            <ArrowRight size={20} />
          </button>

          <button
            onClick={() => navigate('/therapists')}
            className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Stethoscope size={18} className="text-miru-primary" />
            Xem therapist công khai
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="z-10 grid w-full max-w-5xl gap-6 md:grid-cols-3"
      >
        {features.map((feature) => (
          <div
            key={feature.title}
            className="glass-panel flex flex-col items-center p-8 text-center transition-colors hover:bg-white/10"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-miru-primary/20">
              {feature.icon}
            </div>
            <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
            <p className="leading-relaxed text-white/60">{feature.description}</p>
          </div>
        ))}
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.28 }}
        className="z-10 mt-16 w-full max-w-6xl"
      >
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/72">
              <Sparkles size={16} className="text-miru-primary" />
              Therapist đang công khai
            </div>
            <h2 className="mt-4 text-3xl font-semibold">Xem trước danh bạ therapist</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62">
              Khám phá hồ sơ, chuyên môn, cách làm việc và các kênh liên hệ ngoài app trước khi bạn
              quyết định kết nối.
            </p>
          </div>

          <button
            onClick={() => navigate('/therapists')}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Mở toàn bộ danh bạ
            <ArrowRight size={16} className="text-miru-primary" />
          </button>
        </div>

        {loadingPublicTherapists ? (
          <div className="glass-panel flex min-h-56 items-center justify-center gap-3 text-white/60">
            <LoaderCircle size={18} className="animate-spin text-miru-primary" />
            Đang tải therapist...
          </div>
        ) : publicTherapists.length === 0 ? (
          <div className="glass-panel px-6 py-12 text-center text-sm text-white/55">
            Chưa có therapist công khai nào xuất hiện ở thời điểm này.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {publicTherapists.map((therapist, index) => (
              <motion.div
                key={therapist.therapist_id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 + index * 0.04 }}
              >
                <TherapistDirectoryCard therapist={therapist} featured={index === 0} />
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
