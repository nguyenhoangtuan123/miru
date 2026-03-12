import { Users, Calendar, MessageCircle, LayoutDashboard, Settings } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

export function TherapistLayout() {
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', path: '/therapist' },
    { icon: Users, label: 'Thân chủ', path: '/therapist/clients' },
    { icon: Calendar, label: 'Lịch hẹn', path: '/therapist/appointments' },
    { icon: MessageCircle, label: 'Tin nhắn', path: '/therapist/messages' },
    { icon: Settings, label: 'Cài đặt', path: '/therapist/settings' },
  ];

  return (
    <div className="min-h-screen bg-miru-bg text-white font-sans md:pl-24">
      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
        <div className="glass-panel mx-4 mb-4 px-6 py-3 flex justify-between items-center rounded-full shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
                            (item.path !== '/therapist' && location.pathname.startsWith(item.path));
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300",
                  isActive ? "text-miru-primary" : "text-white/50 hover:text-white/80"
                )}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex fixed top-0 left-0 bottom-0 w-24 flex-col items-center py-8 z-50 glass-panel border-r border-white/10">
        <div className="w-12 h-12 bg-miru-primary/20 rounded-2xl flex items-center justify-center mb-12 shadow-[0_0_20px_rgba(127,13,242,0.3)]">
          <span className="text-miru-primary font-bold text-xl">M</span>
        </div>
        
        <div className="flex flex-col gap-6 w-full px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
                            (item.path !== '/therapist' && location.pathname.startsWith(item.path));
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 group",
                  isActive ? "bg-miru-primary/20 text-miru-primary" : "text-white/50 hover:text-white/80 hover:bg-white/5"
                )}
                title={item.label}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-medium text-center">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="pb-24 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
