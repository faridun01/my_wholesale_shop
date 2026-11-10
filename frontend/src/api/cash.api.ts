import client from './client';
import { financialPost } from './financialRequest';

export const getMyCash = async () => (await client.get('/cash/me')).data;

export const getDebtors = async (search: string) => (await client.get('/cash/debtors', { params: { search: search || undefined } })).data;

export const acceptPayment = async (data: { invoice_id: number; customer_id: number; amount: number }) =>
  (await financialPost('/payments', data)).data;

export const sendCashHandover = async (paymentIds: number[]) => (await financialPost('/cash/handovers', { paymentIds })).data;

export const getPendingHandoversCount = async () => Number((await client.get('/cash/pending-count')).data?.count || 0);

export const getHandovers = async (status?: 'pending' | 'confirmed') => (await client.get('/cash/handovers', { params: { status } })).data;

// A repeated confirmation returns the one already made.
export const confirmHandover = async (id: number) => (await client.post(`/cash/handovers/${id}/confirm`)).data;

export const getCashStaff = async () => (await client.get('/cash/staff')).data;
