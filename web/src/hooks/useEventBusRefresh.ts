import { useEffect } from "react";
import { onData, type DataEvent } from "@/lib/eventBus";

export function useEventBusRefresh(
  events: DataEvent[],
  refetch: () => void | Promise<void>,
): void {
  const eventKey = events.join("|");
  useEffect(() => {
    const handler = () => {
      void refetch();
    };
    const unsubs = events.map((event) => onData(event, handler));
    return () => {
      for (const unsub of unsubs) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey, refetch]);
}
