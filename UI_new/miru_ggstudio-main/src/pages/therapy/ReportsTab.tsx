import { BookHeart, Sparkles } from 'lucide-react';
import { vi } from './helpers';

type ReportsTabProps = {
  proactiveMessage: string;
  streak: number;
  lastScore: number | null;
  journalsCount: number;
  openGoalsCount: number;
  completedGoalsCount: number;
};

export function ReportsTab({
  proactiveMessage,
  streak,
  lastScore,
  journalsCount,
  openGoalsCount,
  completedGoalsCount,
}: ReportsTabProps) {
  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-3xl p-6 md:p-8">
        <div className="flex flex-col items-start gap-8 md:flex-row">
          <div className="flex-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300">
              <Sparkles size={14} />
              AI Summary
            </div>
            <h2 className="mb-4 text-2xl font-bold">Tổng hợp chăm sóc gần đây</h2>
            <p className="mb-6 leading-relaxed text-white/70">{vi(proactiveMessage)}</p>
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h4 className="mb-2 font-medium text-blue-300">Mood check-in</h4>
                <p className="text-sm text-white/70">
                  Streak hiện tại: <strong>{streak}</strong> ngày. Điểm gần nhất:{' '}
                  <strong>{lastScore ?? '--'}/10</strong>.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h4 className="mb-2 font-medium text-orange-300">Nhật ký gần đây</h4>
                <p className="text-sm text-white/70">
                  Đã lưu <strong>{journalsCount}</strong> entry gần nhất để tạo thêm insight.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 md:w-[320px]">
            <h3 className="mb-4 flex items-center gap-2 font-medium">
              <BookHeart size={20} className="text-miru-primary" />
              Snapshot
            </h3>
            <div className="space-y-3 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span>Mục tiêu đang mở</span>
                <strong>{openGoalsCount}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Mục tiêu hoàn thành</span>
                <strong>{completedGoalsCount}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Nhật ký gần nhất</span>
                <strong>{journalsCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
