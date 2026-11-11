import { useEffect, useRef } from 'react';

// One live connection per browser tab, shared by every page that wants to hear about cash
// changes. The server sends an administrator every staff member's events and a staff
// member only their own. EventSource reconnects by itself after a network drop; after an
// error answer (a 502 while the server restarts) it gives up, so it is reopened here.

const API_URL = import.meta.env.VITE_API_URL || '/api';
const REOPEN_DELAY = 15000;

export type CashEvent = {
  /** resync: the connection came back, notices sent meanwhile may be missed. */
  type: 'payment_accepted' | 'payment_reversed' | 'handover_sent' | 'handover_confirmed' | 'handover_returned' | 'resync';
  userId?: number;
  username?: string;
  handoverId?: number;
  amount?: number;
  by?: string;
  reason?: string | null;
  at: string;
};

type Listener = (event: CashEvent) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let reopenTimer: number | undefined;
let connectedBefore = false;

const notify = (event: CashEvent) => listeners.forEach((listener) => listener(event));

const open = () => {
  if (typeof EventSource === 'undefined') return;
  const current = new EventSource(`${API_URL}/cash/events`, { withCredentials: true });
  source = current;
  current.addEventListener('open', () => {
    if (connectedBefore) notify({ type: 'resync', at: new Date().toISOString() });
    connectedBefore = true;
  });
  current.addEventListener('error', () => {
    if (source !== current || current.readyState !== EventSource.CLOSED) return;
    source = null;
    reopenTimer = window.setTimeout(() => {
      reopenTimer = undefined;
      if (listeners.size && !source) open();
    }, REOPEN_DELAY);
  });
  current.addEventListener('cash', (message) => {
    let event: CashEvent;
    try {
      event = JSON.parse((message as MessageEvent).data);
    } catch {
      return;
    }
    notify(event);
  });
};

export function subscribeCashEvents(listener: Listener) {
  listeners.add(listener);
  if (!source && reopenTimer === undefined) open();
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    source?.close();
    source = null;
    window.clearTimeout(reopenTimer);
    reopenTimer = undefined;
    connectedBefore = false;
  };
}

/** Calls the handler on every cash event while the component is mounted. */
export function useCashEvents(handler: Listener, enabled = true) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeCashEvents((event) => latest.current(event));
  }, [enabled]);
}
