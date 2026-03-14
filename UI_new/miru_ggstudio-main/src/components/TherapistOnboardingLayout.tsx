import { Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export function TherapistOnboardingLayout() {
  return (
    <div className="min-h-screen overflow-hidden bg-miru-bg text-white">
      <div className="pointer-events-none absolute left-[-12%] top-[-10%] h-[45vw] w-[45vw] rounded-full bg-miru-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-12%] right-[-8%] h-[55vw] w-[55vw] rounded-full bg-cyan-400/10 blur-[140px]" />

      <div className="relative min-h-screen px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-miru-primary/20 text-miru-primary">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="font-semibold text-white">Therapist onboarding</div>
              <div className="text-xs text-white/45">Xác minh và mở quyền therapist portal</div>
            </div>
          </div>
        </div>

        <main className="relative pt-6 md:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
