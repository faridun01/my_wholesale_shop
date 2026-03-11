import client from './client';

export const login = async (data: { username: string; password: string }) => {
  const response = await client.post('/auth/login', data);
  return response.data;
};

export const register = async (data: { username: string; password: string; role?: string; warehouseId?: number }) => {
  const response = await client.post('/auth/register', data);
  return response.data;
};

export const publicRegister = async (data: { username: string; password: string; phone?: string }) => {
  const response = await client.post('/auth/public-register', data);
  return response.data;
};

export const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
  const response = await client.post('/auth/change-password', data);
  return response.data;
};
