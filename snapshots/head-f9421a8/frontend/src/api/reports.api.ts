import client from './client';

export const getAnalytics = async () => {
  const response = await client.get('/reports/analytics');
  return response.data;
};
