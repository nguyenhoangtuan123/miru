import { useEffect, useRef, useState } from 'react';
import { ClipboardList, BrainCircuit, Home, MessageCircle, Settings, Stethoscope } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { prefetchClientRouteData } from '../queries/appQueries';

type GestureMode = 'open' | 'close';

export function BottomNav() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const gestureStartY = useRef<number | null>(null);
  const gestureCurrentY = useRef<number | null>(null);
  const isChatRoute = location.pathname.startsWith('/chat');

  useEffect(() => {
    setIsMobileExpanded(false);
  }, [location.pathname]);

  if (location.pathname.startsWith('/auth')) {
    return null;
  }

  const navItems = [
    { icon: Home, label: 'Trang chủ', path: '/' },
    { icon: MessageCircle, label: 'Trò chuyện', path: '/chat' },
    { icon: ClipboardList, label: 'Đánh giá', path: '/assessments' },
    { icon: BrainCircuit, label: 'Ký ức', path: '/memories' },
    { icon: Stethoscope, label: 'Trị liệu', path: '/therapy' },
    { icon: Settings, label: 'Cài đặt', path: '/settings' },
  ];

  function handlePrefetch(path: string) {
    void prefetchClientRouteData(queryClient, path, user?.id);
  }

  function beginGesture(y: number) {
    gestureStartY.current = y;
    gestureCurrentY.current = y;
  }

  function updateGesture(y: number) {
    gestureCurrentY.current = y;
  }

  function finishGesture(mode: GestureMode) {
    const startY = gestureStartY.current;
    const currentY = gestureCurrentY.current;
    gestureStartY.current = null;
    gestureCurrentY.current = null;

    if (startY === null || currentY === null) {
      return;
    }

    const deltaY = currentY - startY;
    if (mode === 'open' && deltaY < -30) {
      setIsMobileExpanded(true);
    }
    if (mode === 'close' && deltaY > 30) {
      setIsMobileExpanded(false);
    }
  }

  return (
    <>
      <div className="md:hidden">
        {isMobileExpanded ? (
          <>
            <button
              type="button"
              aria-label="Đóng điều hướng"
              onClick={() => setIsMobileExpanded(false)}
              className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]"
            />

            <div
              className="fixed inset-x-0 bottom-0 z-50 pb-safe"
              onTouchStart={(event) => beginGesture(event.touches[0].clientY)}
              onTouchMove={(event) => updateGesture(event.touches[0].clientY)}
              onTouchEnd={() => finishGesture('close')}
            >
              <div className="glass-panel mx-3 mb-3 rounded-[28px] border border-white/10 px-5 pb-5 pt-3 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setIsMobileExpanded(false)}
                  className="mx-auto mb-3 flex w-full flex-col items-center gap-2 rounded-2xl px-2 py-1 text-white/55"
                >
                  <span className="h-1.5 w-14 rounded-full bg-white/20" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.24em]">
                    Vuốt xuống để ẩn
                  </span>
                </button>

                <div className="grid grid-cols-3 gap-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      location.pathname === item.path ||
                      (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileExpanded(false)}
                        onMouseEnter={() => handlePrefetch(item.path)}
                        onFocus={() => handlePrefetch(item.path)}
                        className={cn(
                          'flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center transition-all duration-300',
                          isActive
                            ? 'bg-miru-primary/18 text-miru-primary'
                            : 'text-white/60 hover:bg-white/6 hover:text-white/90'
                        )}
                      >
                        <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[11px] font-medium leading-4">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div
            className={cn(
              'fixed inset-x-0 bottom-0 z-40 flex justify-center',
              isChatRoute ? 'pb-[max(env(safe-area-inset-bottom),0.15rem)]' : 'pb-[max(env(safe-area-inset-bottom),0.5rem)]'
            )}
          >
            <button
              type="button"
              aria-label="Mở điều hướng nhanh"
              onClick={() => setIsMobileExpanded(true)}
              onTouchStart={(event) => beginGesture(event.touches[0].clientY)}
              onTouchMove={(event) => updateGesture(event.touches[0].clientY)}
              onTouchEnd={() => finishGesture('open')}
              className={cn(
                'flex items-center justify-center rounded-full border border-white/10 bg-slate-950/65 shadow-lg backdrop-blur-xl transition-all',
                isChatRoute ? 'h-4 w-20' : 'h-6 w-24'
              )}
            >
              <span className="sr-only">Vuốt lên để mở điều hướng</span>
              <span className={cn('rounded-full bg-white/35', isChatRoute ? 'h-1 w-10' : 'h-1.5 w-12')} />
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 top-0 hidden w-24 flex-col items-center border-r border-white/10 py-8 z-50 glass-panel md:flex">
        <div className="flex flex-1 flex-col gap-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onMouseEnter={() => handlePrefetch(item.path)}
                onFocus={() => handlePrefetch(item.path)}
                className={cn(
                  'group flex flex-col items-center gap-2 rounded-2xl p-3 transition-all duration-300',
                  isActive
                    ? 'bg-miru-primary/20 text-miru-primary'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                )}
                title={item.label}
              >
                <Icon
                  size={28}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="transition-transform group-hover:scale-110"
                />
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </>
  );
}
