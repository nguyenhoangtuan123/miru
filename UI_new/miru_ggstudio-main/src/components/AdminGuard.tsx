import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConsent } from '../contexts/ConsentContext';
import { ConsentGate } from './ConsentGate';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { consent, loading: consentLoading } = useConsent();

  if (loading || (user && consentLoading)) {
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
    return <ConsentGate />;
  }

  if (!user.is_admin_reviewer) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
