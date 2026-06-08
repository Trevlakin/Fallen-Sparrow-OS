import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { onData, DATA_EVENTS } from "@/lib/eventBus";

interface StudioSettings {
  confirmRates: boolean;
}

export function useStudioSettings(): {
  confirmRates: boolean | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [confirmRates, setConfirmRates] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const settings = await api.get<StudioSettings>("/api/settings");
      setConfirmRates(settings.confirmRates);
    } catch {
      setConfirmRates(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return onData(DATA_EVENTS.expenses, () => {
      void refresh();
    });
  }, [refresh]);

  return { confirmRates, loading, refresh };
}
