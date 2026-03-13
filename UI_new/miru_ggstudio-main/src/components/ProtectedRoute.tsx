import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConsent } from '../contexts/ConsentContext';
import { ConsentGate } from './ConsentGate';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { consent, loading: consentLoading } = useConsent();
  const location = useLocation();

  if (loading || (user && consentLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-miru-bg">
        <div className="w-8 h-8 border-4 border-miru-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (location.pathname === '/consent') {
    return <>{children}</>;
  }

  if (!consent?.accepted) {
    return <ConsentGate />;
  }

  return <>{children}</>;
}
