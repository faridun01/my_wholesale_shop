import client from './client';

export const getDashboardSummary = async () => {
  const response = await client.get('/dashboard/summary');
  return response.data;
};
