import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity,
  ArrowRight,
  BookHeart,
  BrainCircuit,
  LoaderCircle,
  MessageCircle,
  Save,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { cn } from '../lib/utils';
import { repairMojibake } from '../lib/text';
import {
  getCheckinStatus,
  getJournalEntries,
  getMoments,
  getProactiveMessage,
  saveJournalEntry,
} from '../services/backend';
import type { JournalEntry, MomentItem } from '../services/contracts';

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

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [diaryEntry, setDiaryEntry] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaries, setDiaries] = useState<JournalEntry[]>([]);
  const [moodPoints, setMoodPoints] = useState<MoodPoint[]>([]);
  const [streak, setStreak] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [proactiveMessage, setProactiveMessage] = useState(
    'Miru sẽ gợi ý dựa trên dữ liệu thật của bạn khi backend phản hồi.'
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [journalsResult, momentsResult, statusResult, proactiveResult] =
          await Promise.allSettled([
            getJournalEntries(user.id, 5),
            getMoments(user.id, 7),
            getCheckinStatus(user.id),
            getProactiveMessage(user.id),
          ]);

        if (cancelled) {
          return;
        }

        if (journalsResult.status === 'fulfilled') {
          setDiaries(journalsResult.value.entries);
        }

        if (momentsResult.status === 'fulfilled') {
          setMoodPoints(buildMoodChart(momentsResult.value.moments));
        }

        if (statusResult.status === 'fulfilled') {
          setStreak(statusResult.value.streak ?? 0);
          setLastScore(statusResult.value.last_score ?? null);
          setHasCheckedInToday(Boolean(statusResult.value.has_checked_in_today));
        }

        if (proactiveResult.status === 'fulfilled' && proactiveResult.value.message) {
          setProactiveMessage(repairMojibake(proactiveResult.value.message));
        }

        const firstFailure =
          journalsResult.status === 'rejected'
            ? journalsResult.reason
            : momentsResult.status === 'rejected'
              ? momentsResult.reason
              : statusResult.status === 'rejected'
                ? statusResult.reason
                : proactiveResult.status === 'rejected'
                  ? proactiveResult.reason
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

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

      setDiaries((prev) => [
        {
          id: response.id,
          user_id: user.id,
          title,
          content,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setDiaryEntry('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được nhật ký');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen pt-12 pb-32 px-4 md:px-8 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Chào, {repairMojibake(user?.name || user?.email?.split('@')[0] || 'bạn')}!
        </h1>
        <p className="text-white/60">
          Trang này đang đọc dữ liệu thật từ journal, mood check-in và proactive message.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {repairMojibake(error)}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-3xl"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BookHeart className="text-miru-primary" size={24} />
              Nhật ký hôm nay
            </h2>
            <textarea
              value={diaryEntry}
              onChange={(event) => setDiaryEntry(event.target.value)}
              placeholder="Viết ra những suy nghĩ và cảm xúc của bạn lúc này..."
              className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50 transition-colors resize-none mb-4"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveDiary}
                disabled={!diaryEntry.trim() || isSaving}
                className="glass-button px-6 py-2.5 font-semibold flex items-center gap-2 disabled:opacity-50"
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
            className="glass-panel p-6 rounded-3xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Nhật ký gần đây</h2>
              {isLoading && (
                <span className="text-sm text-white/40 flex items-center gap-2">
                  <LoaderCircle size={14} className="animate-spin" />
                  Đang đồng bộ
                </span>
              )}
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
                    className="p-4 rounded-2xl bg-white/5 border border-white/10"
                  >
                    <p className="text-sm text-miru-primary mb-2">
                      {diary.created_at
                        ? format(new Date(diary.created_at), 'EEEE, dd MMMM yyyy', {
                            locale: vi,
                          })
                        : 'Không rõ thời gian'}
                    </p>
                    <p className="text-white/80 leading-relaxed">
                      {repairMojibake(diary.content)}
                    </p>
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
            className="glass-panel p-6 rounded-3xl"
          >
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <TrendingUp className="text-miru-primary" size={24} />
              Biểu đồ cảm xúc
            </h2>
            <div className="h-64 w-full">
              {moodPoints.length === 0 ? (
                <div className="h-full rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-sm text-white/40 text-center px-4">
                  Chưa đủ dữ liệu mood check-in để vẽ biểu đồ.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={moodPoints}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7f0df2" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#7f0df2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.1)"
                      vertical={false}
                    />
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
            <p className="text-sm text-white/50 text-center mt-4">
              {hasCheckedInToday
                ? `Bạn đã check-in hôm nay. Điểm gần nhất: ${lastScore ?? '--'}/10`
                : 'Bạn chưa check-in hôm nay.'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel p-6 rounded-3xl bg-gradient-to-br from-miru-primary/20 to-transparent border-miru-primary/30"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
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
            <p className="text-sm text-white/70 mb-4 leading-relaxed">
              {repairMojibake(proactiveMessage)}
            </p>
            <button
              onClick={() => navigate('/therapy')}
              className="text-sm font-medium text-miru-primary hover:text-white transition-colors flex items-center gap-1"
            >
              Xem bài tập <ArrowRight size={16} />
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

  if (user) {
    return <Dashboard />;
  }

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
      description:
        'Nhìn lại hành trình cảm xúc để hiểu rõ hơn về bản thân mình.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center pt-20 pb-32 px-6 relative overflow-x-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-miru-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 text-center max-w-3xl mt-10 md:mt-20 mb-24"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel mb-8">
          <Sparkles size={16} className="text-miru-primary" />
          <span className="text-sm font-medium">AI Mental Health Companion</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight">
          Chăm sóc tinh thần cùng{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-miru-primary to-purple-400">
            Miru
          </span>
        </h1>

        <p className="text-lg md:text-xl text-white/70 mb-12 leading-relaxed max-w-2xl mx-auto">
          Người bạn đồng hành AI thấu hiểu cảm xúc của bạn, giúp bạn ghi lại ký ức
          và chăm sóc sức khỏe tinh thần mỗi ngày.
        </p>

        <button
          onClick={() => navigate('/auth/login')}
          className="glass-button px-8 py-4 text-lg font-semibold inline-flex items-center gap-3"
        >
          Bắt đầu ngay
          <ArrowRight size={20} />
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="z-10 grid md:grid-cols-3 gap-6 max-w-5xl w-full"
      >
        {features.map((feature) => (
          <div
            key={feature.title}
            className="glass-panel p-8 flex flex-col items-center text-center hover:bg-white/10 transition-colors"
          >
            <div className="w-14 h-14 rounded-2xl bg-miru-primary/20 flex items-center justify-center mb-6">
              {feature.icon}
            </div>
            <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
            <p className="text-white/60 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
