import client from './client';

export const getWarehouses = async () => {
  const response = await client.get('/warehouses');
  return response.data;
};

export const createWarehouse = async (data: any) => {
  const response = await client.post('/warehouses', data);
  return response.data;
};

export const updateWarehouse = async (id: number, data: any) => {
  const response = await client.put(`/warehouses/${id}`, data);
  return response.data;
};

export const deleteWarehouse = async (id: number) => {
  const response = await client.delete(`/warehouses/${id}`);
  return response.data;
};
