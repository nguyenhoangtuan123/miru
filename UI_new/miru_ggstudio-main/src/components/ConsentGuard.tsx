import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConsent } from '../contexts/ConsentContext';

export function ConsentGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { consent, loading } = useConsent();
  const location = useLocation();

  if (user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-miru-bg">
        <div className="w-8 h-8 border-4 border-miru-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!consent?.accepted) {
    return <Navigate to="/consent" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
