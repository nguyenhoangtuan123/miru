import { Home, MessageCircle, BrainCircuit, Settings, Stethoscope } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';

export function BottomNav() {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // If scrolling down, hide the nav. If scrolling up, show it.
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Hide on auth pages
  if (location.pathname.startsWith('/auth')) {
    return null;
  }

  const navItems = [
    { icon: Home, label: 'Trang chủ', path: '/' },
    { icon: MessageCircle, label: 'Trò chuyện', path: '/chat' },
    { icon: BrainCircuit, label: 'Ký ức', path: '/memories' },
    { icon: Stethoscope, label: 'Trị liệu', path: '/therapy' },
    { icon: Settings, label: 'Cài đặt', path: '/settings' },
  ];

  return (
    <>
      {/* Mobile Bottom Nav */}
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe transition-transform duration-300 ease-in-out",
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="glass-panel mx-4 mb-4 px-6 py-3 flex justify-between items-center rounded-full shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
                            (item.path !== '/' && location.pathname.startsWith(item.path));
            
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
        <div className="flex-1 flex flex-col gap-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
                            (item.path !== '/' && location.pathname.startsWith(item.path));
            
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
                <Icon size={28} strokeWidth={isActive ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </>
  );
}
