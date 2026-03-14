import { LoaderCircle } from 'lucide-react';

type TherapyHeaderProps = {
  isLoading: boolean;
  error: string | null;
};

export function TherapyHeader({ isLoading, error }: TherapyHeaderProps) {
  return (
    <>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Trị liệu & mục tiêu</h1>
          <p className="text-white/60">
            Mục tiêu cá nhân, báo cáo AI, bài tập từ nhà trị liệu và trao đổi hỗ trợ
            đều tập trung ở đây.
          </p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-white/40">
            <LoaderCircle size={16} className="animate-spin" />
            Đang tải
          </div>
        )}
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}
    </>
  );
}
