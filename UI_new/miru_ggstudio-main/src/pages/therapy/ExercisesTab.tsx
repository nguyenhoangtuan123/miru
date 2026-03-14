import { BookHeart, CheckCircle2, Circle, LoaderCircle, Plus } from 'lucide-react';
import type { Goal } from '../../services/contracts';
import { vi } from './helpers';

type ExercisesTabProps = {
  goals: Goal[];
  newGoalTitle: string;
  setNewGoalTitle: (value: string) => void;
  isSubmittingGoal: boolean;
  onCreateGoal: () => Promise<void>;
  onToggleGoal: (goal: Goal) => Promise<void>;
};

export function ExercisesTab({
  goals,
  newGoalTitle,
  setNewGoalTitle,
  isSubmittingGoal,
  onCreateGoal,
  onToggleGoal,
}: ExercisesTabProps) {
  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={newGoalTitle}
            onChange={(event) => setNewGoalTitle(event.target.value)}
            placeholder="Thêm mục tiêu cá nhân mới..."
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 transition-colors focus:border-miru-primary/50 focus:outline-none"
          />
          <button
            onClick={() => void onCreateGoal()}
            disabled={!newGoalTitle.trim() || isSubmittingGoal}
            className="glass-button flex items-center justify-center gap-2 px-5 py-3 font-semibold disabled:opacity-50"
          >
            {isSubmittingGoal ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            Thêm nhanh
          </button>
        </div>
      </div>

      <div className="rounded-3xl glass-panel p-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
            <BookHeart size={28} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Kế hoạch của bạn</h2>
            <p className="text-sm text-white/60">
              Hoàn thành từng mục tiêu nhỏ để giữ nhịp chăm sóc tinh thần đều đặn.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {goals.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
              Chưa có mục tiêu nào. Hãy tạo mục tiêu đầu tiên ở ô phía trên.
            </div>
          ) : (
            goals.map((goal) => {
              const isCompleted = Boolean(goal.completed);

              return (
                <button
                  key={goal.id ?? goal.title}
                  type="button"
                  onClick={() => void onToggleGoal(goal)}
                  className={`group rounded-2xl border p-5 text-left transition-all ${
                    isCompleted
                      ? 'border-green-500/30 bg-green-500/10 opacity-85'
                      : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`mt-1 shrink-0 ${
                        isCompleted ? 'text-green-400' : 'text-white/40'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <h3
                          className={`text-lg font-medium ${
                            isCompleted ? 'line-through text-white/50' : 'text-white/90'
                          }`}
                        >
                          {vi(goal.title)}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            isCompleted
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {isCompleted ? 'Đã hoàn thành' : 'Đang thực hiện'}
                        </span>
                      </div>
                      {goal.description && (
                        <p className="text-sm text-white/60">{vi(goal.description)}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
