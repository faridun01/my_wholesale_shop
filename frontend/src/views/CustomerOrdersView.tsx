import { decimal } from '../utils/financial';
import React from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock3, Package, RefreshCw, Trash2 } from 'lucide-react';
import { approveCustomerOrder, getCustomerOrders, rejectCustomerOrder } from '../api/customer-orders.api';
import { formatMoney } from '../utils/format';

const statusTone: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const statusLabel: Record<string, string> = {
  pending: 'На проверке',
  approved: 'Принят',
  rejected: 'Отклонен',
};

export default function CustomerOrdersView() {
  const [orders, setOrders] = React.useState<any[]>([]);
  const [status, setStatus] = React.useState('pending');
  const [isLoading, setIsLoading] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<number | null>(null);

  const fetchOrders = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCustomerOrders(status);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Не удалось загрузить заказы клиентов');
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleApprove = async (order: any) => {
    setProcessingId(Number(order.id));
    try {
      await approveCustomerOrder(Number(order.id));
      toast.success('Заказ принят и добавлен в продажи');
      window.dispatchEvent(new Event('customer-orders-updated'));
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Не удалось принять заказ');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (order: any) => {
    if (!window.confirm(`Отклонить заказ #${order.id}?`)) return;
    setProcessingId(Number(order.id));
    try {
      await rejectCustomerOrder(Number(order.id));
      toast.success('Заказ отклонен');
      window.dispatchEvent(new Event('customer-orders-updated'));
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Не удалось отклонить заказ');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="app-page-shell">
      <div className="w-full space-y-6">
        <div className="app-surface app-surface-header">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-medium tracking-tight text-slate-900">Заказы клиентов</h1>
              <p className="mt-1 text-slate-500">Заявки от клиентов сначала проверяются, затем становятся обычными продажами.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              >
                <option value="pending">На проверке</option>
                <option value="approved">Принятые</option>
                <option value="rejected">Отклоненные</option>
              </select>
              <button
                type="button"
                onClick={fetchOrders}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                Обновить
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {orders.map((order) => (
            <div key={order.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">Заказ #{order.id}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[order.status] || 'bg-slate-100 text-slate-600'}`}>
                      {statusLabel[order.status] || order.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {order.customer_name} · {order.warehouse?.name || 'Склад'} · {new Date(order.createdAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                <div className="text-left lg:text-right">
                  <p className="text-2xl font-semibold text-slate-900">{formatMoney(order.totalAmount || 0)}</p>
                  <p className="mt-1 text-xs text-slate-400">Позиций: {Array.isArray(order.items) ? order.items.length : 0}</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {(order.items || []).map((item: any) => (
                  <div key={item.id} className="grid gap-3 p-5 md:grid-cols-[48px_minmax(0,1fr)_120px_120px] md:items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Package size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="wrap-break-word text-sm font-semibold text-slate-900">{item.product?.name || `Товар #${item.productId}`}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.packageName ? `${item.packageQuantity || 0} ${item.packageName}` : `${item.quantity} ${item.baseUnitName || 'шт'}`}
                        {item.extraUnitQuantity ? ` + ${item.extraUnitQuantity} ${item.baseUnitName || 'шт'}` : ''}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600">{formatMoney(item.sellingPrice || 0)}</p>
                    <p className="text-sm font-semibold text-slate-900">{formatMoney(decimal(item.quantity || 0).times(decimal(item.sellingPrice || 0)).toNumber())}</p>
                  </div>
                ))}
              </div>

              {order.status === 'pending' && (
                <div className="flex flex-col gap-3 border-t border-slate-100 bg-white p-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => handleReject(order)}
                    disabled={processingId === Number(order.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={16} />
                    Отклонить
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(order)}
                    disabled={processingId === Number(order.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processingId === Number(order.id) ? <Clock3 size={16} /> : <CheckCircle2 size={16} />}
                    Принять заказ
                  </button>
                </div>
              )}
            </div>
          ))}

          {!orders.length && (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
              {isLoading ? 'Загрузка заказов...' : 'Заказов в этом статусе нет'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
