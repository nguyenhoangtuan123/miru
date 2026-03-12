import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import React, { useEffect, useState } from 'react';

export function TherapistGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, checkAuth } = useAuth();
  const [isRechecking, setIsRechecking] = useState(false);
  const [hasRechecked, setHasRechecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (loading || !token || !user || user.role === 'therapist' || hasRechecked) {
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
  }, [checkAuth, hasRechecked, loading, user]);

  if (loading || isRechecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-miru-bg">
        <div className="w-8 h-8 border-4 border-miru-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (user.role !== 'therapist') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
