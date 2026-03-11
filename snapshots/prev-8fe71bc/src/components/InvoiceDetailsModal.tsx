import React, { useState, useEffect } from 'react';
import { X, Printer, RefreshCw, DollarSign, Undo2, Trash2, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '../components/UI';

interface InvoiceDetailsModalProps {
  invoiceId: number;
  onClose: () => void;
  user: any;
  onActionSuccess: () => void;
}

export const InvoiceDetailsModal = ({ invoiceId, onClose, user, onActionSuccess }: InvoiceDetailsModalProps) => {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetails = async () => {
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoiceId}`);
    const data = await res.json();
    setInvoice(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDetails();
  }, [invoiceId]);

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium">Загрузка чека...</p>
      </div>
    </div>
  );

  const total = (invoice.total_amount - (invoice.total_amount * invoice.discount / 100) + invoice.tax);
  const debt = total - (invoice.total_paid || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Чек #{invoice.id}</h3>
            <p className="text-sm text-slate-500">{new Date(invoice.created_at).toLocaleString('ru-RU')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Клиент</p>
              <p className="font-bold text-slate-900 text-lg">{invoice.customer_name}</p>
              <p className="text-sm text-slate-500">{invoice.customer_phone}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Статус</p>
              {invoice.cancelled ? (
                <Badge variant="danger">ОТМЕНЕНО</Badge>
              ) : (
                <Badge variant={invoice.status === 'paid' ? 'success' : invoice.status === 'partial' ? 'warning' : 'danger'}>
                  {invoice.status === 'paid' ? 'ОПЛАЧЕНО' : invoice.status === 'partial' ? 'ЧАСТИЧНО' : 'ДОЛГ'}
                </Badge>
              )}
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 font-semibold text-slate-600">Товар</th>
                  <th className="px-4 py-2 font-semibold text-slate-600 text-center">Кол-во</th>
                  <th className="px-4 py-2 font-semibold text-slate-600 text-right">Цена</th>
                  <th className="px-4 py-2 font-semibold text-slate-600 text-right">Итого</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoice.items.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item.product_name}</p>
                      {item.returned_quantity > 0 && (
                        <p className="text-xs text-rose-500 font-medium">Возвращено: {item.returned_quantity} {item.unit}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{item.selling_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{(item.quantity * item.selling_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex justify-between text-slate-600">
              <span>Подытог</span>
              <span>{invoice.total_amount.toFixed(2)} сомони</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Скидка ({invoice.discount}%)</span>
                <span>-{(invoice.total_amount * invoice.discount / 100).toFixed(2)} сомони</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-black text-slate-900 pt-2">
              <span>Итого</span>
              <span>{total.toFixed(2)} сомони</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Оплачено</span>
              <span>{(invoice.total_paid || 0).toFixed(2)} сомони</span>
            </div>
            {debt > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>Остаток (Долг)</span>
                <span>{debt.toFixed(2)} сомони</span>
              </div>
            )}
          </div>

          {invoice.payments && invoice.payments.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">История платежей</p>
              <div className="space-y-2">
                {invoice.payments.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-sm">
                    <span className="text-slate-500">{new Date(p.created_at).toLocaleDateString('ru-RU')}</span>
                    <span className="font-bold text-emerald-600">{p.amount.toFixed(2)} сомони</span>
                    <span className="text-slate-400 capitalize">{p.method === 'cash' ? 'Наличные' : p.method === 'card' ? 'Карта' : 'Перевод'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <div className="flex space-x-2">
            <button className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
              <Printer size={20} />
            </button>
          </div>
          <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors">
            Закрыть
          </button>
        </div>
      </motion.div>
    </div>
  );
};
