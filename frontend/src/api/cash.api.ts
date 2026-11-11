import client from './client';
import { financialPost } from './financialRequest';

export const getMyCash = async () => (await client.get('/cash/me')).data;

export type DebtorSort = 'name' | 'debt' | 'oldest';

export const getDebtors = async (search: string, sort: DebtorSort = 'name') =>
  (await client.get('/cash/debtors', { params: { search: search || undefined, sort } })).data;

export const acceptPayment = async (data: { invoice_id: number; customer_id: number; amount: number }) =>
  (await financialPost('/payments', data)).data;

export const sendCashHandover = async (paymentIds: number[]) => (await financialPost('/cash/handovers', { paymentIds })).data;

/** The staff member takes back their waiting handover; an administrator returns any, with a reason. */
export const returnCashHandover = async (id: number, reason?: string) =>
  (await client.post(`/cash/handovers/${id}/return`, { reason: reason || undefined })).data;

export const getPendingHandoversCount = async () => Number((await client.get('/cash/pending-count')).data?.count || 0);

/** from/to are calendar days (YYYY-MM-DD), inclusive; they filter by when the handover was confirmed or returned. */
export const getHandovers = async (status?: 'pending' | 'confirmed' | 'returned', period?: { from: string; to: string }) =>
  (await client.get('/cash/handovers', { params: { status, ...period } })).data;

// A repeated confirmation returns the one already made.
export const confirmHandover = async (id: number) => (await client.post(`/cash/handovers/${id}/confirm`)).data;

export const getCashStaff = async () => (await client.get('/cash/staff')).data;
