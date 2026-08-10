import client from './client';
import { getCachedReference, invalidateReferenceCache } from './referenceCache';

const CUSTOMERS_CACHE_KEY = 'customers';

export const getCustomers = async (options?: { force?: boolean; warehouseId?: number | string | null }) => {
  const warehouseId = options?.warehouseId ? String(options.warehouseId) : undefined;
  const cacheKey = warehouseId ? `${CUSTOMERS_CACHE_KEY}_wh_${warehouseId}` : CUSTOMERS_CACHE_KEY;

  return getCachedReference(
    cacheKey,
    async () => {
      const response = await client.get('/customers', {
        params: {
          warehouseId: warehouseId || undefined,
        },
      });
      return response.data;
    },
    options,
  );
};

export const createCustomer = async (data: any) => {
  const response = await client.post('/customers', data);
  invalidateReferenceCache(CUSTOMERS_CACHE_KEY);
  return response.data;
};

export const updateCustomer = async (id: number, data: any) => {
  const response = await client.put(`/customers/${id}`, data);
  invalidateReferenceCache(CUSTOMERS_CACHE_KEY);
  return response.data;
};

export const deleteCustomer = async (id: number) => {
  const response = await client.delete(`/customers/${id}`);
  invalidateReferenceCache(CUSTOMERS_CACHE_KEY);
  return response.data;
};

export const getCustomerHistory = async (id: number) => {
  const response = await client.get(`/customers/${id}/history`);
  return response.data;
};
