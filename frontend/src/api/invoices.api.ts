import { financialPost } from './financialRequest';
import client from './client';

export const createInvoice = async (data: any) => {
  const response = await financialPost('/invoices', data);
  return response.data;
};

export const getInvoiceHistory = async (id: number) => {
  const response = await client.get(`/invoices/${id}/history`);
  return response.data;
};

export const cancelInvoice = async (id: number) => {
  const response = await client.post(`/invoices/${id}/cancel`);
  return response.data;
};
