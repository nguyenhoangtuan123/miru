import {
  Calendar,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { prefetchTherapistRouteData } from '../queries/appQueries';

export function TherapistLayout() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'Tong quan', path: '/therapist' },
    { icon: Users, label: 'Than chu', path: '/therapist/clients' },
    { icon: Sparkles, label: 'Ho so', path: '/therapist/profile' },
    { icon: Calendar, label: 'Lich hen', path: '/therapist/appointments' },
    { icon: MessageCircle, label: 'Tin nhan', path: '/therapist/messages' },
    { icon: Settings, label: 'Cai dat', path: '/therapist/settings' },
  ];

  function handlePrefetch(path: string) {
    void prefetchTherapistRouteData(queryClient, path, user?.id);
  }

  return (
    <div className="min-h-screen bg-miru-bg font-sans text-white md:pl-24">
      <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe md:hidden">
        <div className="glass-panel mx-4 mb-4 flex items-center justify-between rounded-full px-4 py-3 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/therapist' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onMouseEnter={() => handlePrefetch(item.path)}
                onFocus={() => handlePrefetch(item.path)}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1 rounded-xl p-2 text-center transition-all duration-300',
                  isActive ? 'text-miru-primary' : 'text-white/50 hover:text-white/80'
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[9px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <div className="glass-panel fixed bottom-0 left-0 top-0 z-50 hidden w-24 flex-col items-center border-r border-white/10 py-8 md:flex">
        <div className="mb-12 flex h-12 w-12 items-center justify-center rounded-2xl bg-miru-primary/20 shadow-[0_0_20px_rgba(127,13,242,0.3)]">
          <span className="text-xl font-bold text-miru-primary">M</span>
        </div>

        <div className="flex w-full flex-col gap-5 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/therapist' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onMouseEnter={() => handlePrefetch(item.path)}
                onFocus={() => handlePrefetch(item.path)}
                className={cn(
                  'group flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-all duration-300',
                  isActive
                    ? 'bg-miru-primary/20 text-miru-primary'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                )}
                title={item.label}
              >
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="transition-transform group-hover:scale-110"
                />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <main className="pb-24 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
