export type AppUser = {
  role?: string;
  warehouseId?: number | string | null;
};

export function getCurrentUser(): AppUser {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
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
