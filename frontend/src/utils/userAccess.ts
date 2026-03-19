import { getStoredUser, getTokenPayload } from './authStorage';

export type AppUser = {
  id?: number;
  username?: string;
  role?: string;
  warehouseId?: number | string | null;
  twoFactorEnabled?: boolean;
  warehouse?: {
    id?: number;
    name?: string;
    city?: string | null;
  } | null;
};

export function getCurrentUser(): AppUser {
  try {
    const storedUser = JSON.parse(getStoredUser() || '{}');
    const tokenPayload = getTokenPayload() || {};

    return {
      ...tokenPayload,
      ...storedUser,
      role: storedUser.role || tokenPayload.role,
      warehouseId: storedUser.warehouseId ?? tokenPayload.warehouseId,
    };
  } catch {
    const tokenPayload = getTokenPayload();
    return tokenPayload && typeof tokenPayload === 'object' ? tokenPayload : {};
  }
}

export function isAdminUser(user: AppUser): boolean {
  const role = String(user.role || '').toUpperCase();
  return role === 'ADMIN';
}

export function getUserWarehouseId(user: AppUser): number | null {
  const value = user.warehouseId;
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function filterWarehousesForUser<T extends { id: number }>(warehouses: T[], user: AppUser): T[] {
  if (isAdminUser(user)) {
    return warehouses;
  }

  const warehouseId = getUserWarehouseId(user);
  if (!warehouseId) {
    return [];
  }

  return warehouses.filter((warehouse) => warehouse.id === warehouseId);
}
