import { useEffect } from "react";

export function useSSE(url: string, onMessage: (data: any) => void) {
  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    es.onmessage = (e: MessageEvent) => {
      try {
        const json = JSON.parse(e.data);
        onMessage(json);
      } catch (err) {
        // ignore JSON parse errors
      }
    };
    es.onerror = () => {
      // SSE errors are handled here; client will reconnect if you implement reconnection
      es.close();
    };
    return () => {
      es.close();
    };
  }, [url, onMessage]);
}
