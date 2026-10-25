import client from './client';

export type StaffInvoiceStatus = 'paid' | 'partial' | 'unpaid';

export type StaffStatusBucket = {
  count: number;
  amount: number;
  paid: number;
  debt: number;
};

export type StaffMetrics = {
  invoicesCount: number;
  soldAmount: number;
  paidAmount: number;
  debtAmount: number;
  returnedAmount: number;
  averageCheck: number;
  /** 0..1 — share of sold amount already paid. */
  collectionRate: number;
  byStatus: Record<StaffInvoiceStatus, StaffStatusBucket>;
};

export type StaffUser = {
  id: number;
  username: string;
  role: string;
  active: boolean;
  warehouse: { id: number; name: string } | null;
};

export type StaffStatsRow = StaffUser & StaffMetrics;

export type StaffStatsResponse = {
  totals: StaffMetrics;
  staff: StaffStatsRow[];
};

export type StaffSummary = StaffMetrics & {
  user: StaffUser;
  period: { start: string | null; end: string | null };
  /** Admin only. */
  profit?: number;
};

export type StaffPeriodParams = {
  start?: string;
  end?: string;
  warehouseId?: number | null;
};

const toPeriodQuery = (params: StaffPeriodParams) => ({
  start: params.start || undefined,
  end: params.end || undefined,
  warehouseId: params.warehouseId || undefined,
});

export const getStaffStats = async (params: StaffPeriodParams) => {
  const response = await client.get<StaffStatsResponse>('/staff/stats', { params: toPeriodQuery(params) });
  return response.data;
};

export const getStaffSummary = async (userId: number, params: StaffPeriodParams) => {
  const response = await client.get<StaffSummary>(`/staff/${userId}/summary`, { params: toPeriodQuery(params) });
  return response.data;
};

export const getStaffInvoices = async (params: StaffPeriodParams & {
  userId: number;
  status?: StaffInvoiceStatus;
  page: number;
  limit: number;
}) => {
  const response = await client.get<any[]>('/invoices', {
    params: {
      ...toPeriodQuery(params),
      userId: params.userId,
      status: params.status || undefined,
      page: params.page,
      limit: params.limit,
    },
  });

  const items = Array.isArray(response.data) ? response.data : [];
  const hasMoreHeader = response.headers?.['x-has-more'];
  // The header is only readable when the API is same-origin (or exposes it);
  // otherwise a full page means there may be more to load.
  const hasMore = hasMoreHeader !== undefined ? String(hasMoreHeader) === 'true' : items.length === params.limit;

  return { items, hasMore };
};
