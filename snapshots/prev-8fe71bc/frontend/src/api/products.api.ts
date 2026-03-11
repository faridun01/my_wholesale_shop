import client from './client';

export const getProducts = async (warehouseId?: number) => {
  const response = await client.get('/products', {
    params: { warehouseId }
  });
  return response.data;
};

export const createProduct = async (data: any) => {
  const response = await client.post('/products', data);
  return response.data;
};

export const restockProduct = async (id: number, data: any) => {
  const response = await client.post(`/products/${id}/restock`, data);
  return response.data;
};

export const updateProduct = async (id: number, data: any) => {
  const response = await client.put(`/products/${id}`, data);
  return response.data;
};

export const deleteProduct = async (id: number) => {
  const response = await client.delete(`/products/${id}`);
  return response.data;
};

export const getProductHistory = async (id: number) => {
  const response = await client.get(`/products/${id}/history`);
  return response.data;
};

export const getProductPriceHistory = async (id: number) => {
  const response = await client.get(`/products/${id}/price-history`);
  return response.data;
};

export const getProductBatches = async (id: number) => {
  const response = await client.get(`/products/${id}/batches`);
  return response.data;
};
