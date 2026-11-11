import { EventEmitter } from 'node:events';

// Live notice of cash changes for the open pages: an administrator hears about every
// staff member, a staff member only about their own cash. Sent after the change is
// committed; the pages reload their data on it, so a lost notice costs only a delay.

export type CashEventType = 'payment_accepted' | 'payment_reversed' | 'handover_sent' | 'handover_confirmed' | 'handover_returned';

export type CashEvent = {
  type: CashEventType;
  /** The staff member whose cash changed. */
  userId: number;
  username?: string;
  handoverId?: number;
  amount?: number;
  by?: string;
  reason?: string | null;
  at: string;
};

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publishCashEvent(event: Omit<CashEvent, 'at'>) {
  bus.emit('cash', { ...event, at: new Date().toISOString() });
}

export function subscribeCashEvents(listener: (event: CashEvent) => void) {
  bus.on('cash', listener);
  return () => {
    bus.off('cash', listener);
  };
}
