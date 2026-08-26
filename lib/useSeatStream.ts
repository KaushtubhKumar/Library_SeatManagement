"use client";

import { useEffect, useRef } from "react";
import type { SeatUpdateEvent } from "@/lib/types";

/**
 * Subscribes to /api/stream (the LISTEN/NOTIFY-backed SSE endpoint)
 * and calls onUpdate for every seat state change pushed by the
 * database. This is the piece that makes the map "live" without
 * polling — the browser just sits with an open connection and reacts.
 */
export function useSeatStream(onUpdate: (event: SeatUpdateEvent) => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SeatUpdateEvent;
        onUpdateRef.current(data);
      } catch {
        // heartbeat comments or malformed payload — ignore
      }
    };

    source.onerror = () => {
      // EventSource auto-reconnects on its own; nothing to do here
      // beyond letting it retry. Logged for visibility during dev.
      console.warn("SSE connection dropped, browser will auto-reconnect");
    };

    return () => source.close();
  }, []);
}
