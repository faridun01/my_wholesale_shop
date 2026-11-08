import { financialPost } from './financialRequest';
import client from './client';

export const getCustomerOrders = async (status?: string) => {
  const response = await client.get('/customer-orders', {
    params: status ? { status } : undefined,
  });
  return response.data;
};

export const getPendingCustomerOrdersCount = async () => {
  const response = await client.get('/customer-orders/pending-count');
  return Number(response.data?.count || 0);
};

export const createCustomerOrder = async (data: any) => {
  const response = await financialPost('/customer-orders', data);
  return response.data;
};

export const approveCustomerOrder = async (id: number) => {
  const response = await client.post(`/customer-orders/${id}/approve`);
  return response.data;
};

export const rejectCustomerOrder = async (id: number) => {
  const response = await client.post(`/customer-orders/${id}/reject`);
  return response.data;
};
