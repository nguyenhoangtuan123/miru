import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConsent } from '../contexts/ConsentContext';
import React, { useEffect, useState } from 'react';
import { ConsentGate } from './ConsentGate';

export function TherapistGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, checkAuth } = useAuth();
  const { consent, loading: consentLoading } = useConsent();
  const [isRechecking, setIsRechecking] = useState(false);
  const [hasRechecked, setHasRechecked] = useState(false);

  // Extract primitive to avoid object reference triggering re-renders
  const userRole = user?.role;
  const hasUser = Boolean(user);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (loading || !token || !hasUser || userRole === 'therapist' || hasRechecked) {
      return;
    }

    let cancelled = false;

    const recheckTherapistRole = async () => {
      try {
        setIsRechecking(true);
        await checkAuth();
      } finally {
        if (!cancelled) {
          setHasRechecked(true);
          setIsRechecking(false);
        }
      }
    };

    void recheckTherapistRole();

    return () => {
      cancelled = true;
    };
  }, [checkAuth, hasRechecked, loading, userRole, hasUser]);

  if (loading || isRechecking || (user && consentLoading)) {
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

  if (user.role !== 'therapist') {
    return <Navigate to="/" replace />;
  }

  if (user.therapist_status === 'pending') {
    return <Navigate to="/therapist/review-status" replace />;
  }

  if (user.therapist_status === 'not_submitted' || user.therapist_status === 'rejected') {
    return <Navigate to="/therapist/apply" replace />;
  }

  if (!user.can_access_therapist_portal) {
    return <Navigate to="/therapist/apply" replace />;
  }

  return <>{children}</>;
}
