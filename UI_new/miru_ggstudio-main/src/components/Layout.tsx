import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const isAuthPage = location.pathname.startsWith('/auth');

  return (
    <div className={`min-h-screen bg-miru-bg text-white font-sans ${!isAuthPage ? 'md:pl-24' : ''}`}>
      {children ?? <Outlet />}
      <BottomNav />
    </div>
  );
}
