import { useEffect, useRef } from 'react';

// One live connection per browser tab, shared by every page that wants to hear about cash
// changes. The server sends an administrator every staff member's events and a staff
// member only their own. EventSource reconnects by itself after a network drop.

const API_URL = import.meta.env.VITE_API_URL || '/api';

export type CashEvent = {
  type: 'payment_accepted' | 'payment_reversed' | 'handover_sent' | 'handover_confirmed' | 'handover_returned';
  userId: number;
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

const open = () => {
  if (typeof EventSource === 'undefined') return;
  source = new EventSource(`${API_URL}/cash/events`, { withCredentials: true });
  source.addEventListener('cash', (message) => {
    let event: CashEvent;
    try {
      event = JSON.parse((message as MessageEvent).data);
    } catch {
      return;
    }
    listeners.forEach((listener) => listener(event));
  });
};

export function subscribeCashEvents(listener: Listener) {
  listeners.add(listener);
  if (!source) open();
  return () => {
    listeners.delete(listener);
    if (!listeners.size && source) {
      source.close();
      source = null;
    }
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
