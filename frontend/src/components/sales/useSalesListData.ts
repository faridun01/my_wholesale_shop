import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';

type InvoiceSortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

export type SalesStaffOption = {
  id: number;
  username: string;
};

type UseSalesListDataOptions = {
  warehouseId: string;
  search: string;
  statusFilter: 'all' | 'paid' | 'partial' | 'unpaid';
  staffFilter: string;
  dateFrom: string;
  dateTo: string;
  sortConfig: InvoiceSortConfig;
  currentPage: number;
  pageSize: number;
};

// The picker's dates mean the user's local calendar day; the server may run in
// another time zone, so it receives the exact moments that day starts and ends.
const toDayBoundary = (dateKey: string, time: string) => {
  if (!dateKey) return undefined;
  const date = new Date(`${dateKey}T${time}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const useSalesListData = ({
  warehouseId,
  search,
  statusFilter,
  staffFilter,
  dateFrom,
  dateTo,
  sortConfig,
  currentPage,
  pageSize,
}: UseSalesListDataOptions) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [allInvoicesCount, setAllInvoicesCount] = useState(0);
  const [staffOptions, setStaffOptions] = useState<SalesStaffOption[]>([]);

  const params = {
    warehouseId: warehouseId || undefined,
    search: search || undefined,
    paymentStatus: statusFilter === 'all' ? undefined : statusFilter,
    userId: staffFilter === 'all' ? undefined : staffFilter,
    from: toDayBoundary(dateFrom, '00:00:00.000'),
    to: toDayBoundary(dateTo, '23:59:59.999'),
    sort: sortConfig.key,
    order: sortConfig.direction,
    page: currentPage,
    limit: pageSize,
  };
  const paramsKey = JSON.stringify(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const pageRequestRef = useRef<AbortController | null>(null);
  const metaRequestRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(async () => {
    pageRequestRef.current?.abort();
    const controller = new AbortController();
    pageRequestRef.current = controller;
    setIsLoading(true);
    try {
      const res = await client.get('/invoices', { params: paramsRef.current, signal: controller.signal });
      const page = Array.isArray(res.data) ? res.data : [];
      setInvoices(page);
      setTotalItems(Number(res.headers['x-total-count'] ?? page.length));
    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('Ошибка при загрузке накладных');
      }
    } finally {
      if (pageRequestRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  const fetchMeta = useCallback(async () => {
    metaRequestRef.current?.abort();
    const controller = new AbortController();
    metaRequestRef.current = controller;
    try {
      const res = await client.get('/invoices/list-meta', {
        params: { warehouseId: paramsRef.current.warehouseId },
        signal: controller.signal,
      });
      setAllInvoicesCount(Number(res.data?.total || 0));
      setStaffOptions(Array.isArray(res.data?.staff) ? res.data.staff : []);
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.error(err);
      }
    }
  }, []);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage, paramsKey]);

  useEffect(() => {
    void fetchMeta();
  }, [fetchMeta, warehouseId]);

  useEffect(
    () => () => {
      pageRequestRef.current?.abort();
      metaRequestRef.current?.abort();
    },
    [],
  );

  const fetchInvoices = useCallback(async () => {
    await Promise.all([fetchPage(), fetchMeta()]);
  }, [fetchMeta, fetchPage]);

  return {
    invoices,
    setInvoices,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    isLoading,
    allInvoicesCount,
    staffOptions,
    fetchInvoices,
  };
};

export default useSalesListData;
