import { useEffect, useRef } from 'react';
import { subscribeToSessionUpdates } from '../realtime';

// Events that arrive close together (a burst of joins) are handled as one batch.
const BATCH_MS = 300;

// Calls onUpdate(events) while the screen is mounted, whenever sessions change
// on the server. See realtime.js for the event shapes.
export function useSessionUpdates(onUpdate, { enabled = true } = {}) {
  const callback = useRef(onUpdate);
  useEffect(() => { callback.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    let pending = [];
    const unsubscribe = subscribeToSessionUpdates((event) => {
      pending.push(event);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const events = pending;
        pending = [];
        callback.current(events);
      }, BATCH_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled]);
}

// True when the batch touches one of these sessions, or asks for a full refetch.
export function affectsSessions(events, sessionIds) {
  const ids = new Set(sessionIds);
  return events.some((event) => event.resync || ids.has(event.sessionId));
}
