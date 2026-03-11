import client from './client';

export const getCustomers = async () => {
  const response = await client.get('/customers');
  return response.data;
};

export const createCustomer = async (data: any) => {
  const response = await client.post('/customers', data);
  return response.data;
};

export const updateCustomer = async (id: number, data: any) => {
  const response = await client.put(`/customers/${id}`, data);
  return response.data;
};

export const deleteCustomer = async (id: number) => {
  const response = await client.delete(`/customers/${id}`);
  return response.data;
};

export const getCustomerHistory = async (id: number) => {
  const response = await client.get(`/customers/${id}/history`);
  return response.data;
};
