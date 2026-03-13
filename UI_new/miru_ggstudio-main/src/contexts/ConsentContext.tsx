import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { acceptConsent, getConsentStatus } from '../services/backend';
import type { ConsentStatus } from '../services/contracts';
import { useAuth } from './AuthContext';

type ConsentContextValue = {
  consent: ConsentStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
  accept: (allowProactiveSupport: boolean) => Promise<void>;
};

const ConsentContext = createContext<ConsentContextValue | undefined>(undefined);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setConsent(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getConsentStatus();
      setConsent(response.consent);
    } catch (error) {
      console.error('Failed to load consent status:', error);
      setConsent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void refresh();
  }, [authLoading, user?.id]);

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      loading,
      refresh,
      accept: async (allowProactiveSupport: boolean) => {
        const response = await acceptConsent({
          processing_consent: true,
          crisis_notice_acknowledged: true,
          allow_proactive_support: allowProactiveSupport,
        });
        setConsent(response.consent);
      },
    }),
    [consent, loading]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}
