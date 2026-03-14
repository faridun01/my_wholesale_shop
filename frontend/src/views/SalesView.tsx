import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { 
  Plus, 
  Search, 
  Filter, 
  Receipt, 
  ChevronUp,
  ChevronDown,
  ChevronRight, 
  Eye, 
  Trash2, 
  X,
  Calendar,
  Banknote,
  User as UserIcon,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { formatMoney, toFixedNumber } from '../utils/format';
import { formatProductName } from '../utils/productName';

export default function SalesView() {
  const PAYMENT_EPSILON = 0.01;
  const [invoices, setInvoices] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);
  const userWarehouseId = getUserWarehouseId(user);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(userWarehouseId ? String(userWarehouseId) : '');
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [isPaying, setIsPaying] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const navigate = useNavigate();

  const escapeHtml = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  useEffect(() => {
    fetchInvoices();
    fetchWarehouses();
  }, [selectedWarehouseId, isAdmin, userWarehouseId]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const effectiveWarehouseId = !isAdmin && userWarehouseId ? String(userWarehouseId) : selectedWarehouseId;
      const query = effectiveWarehouseId ? `?warehouseId=${effectiveWarehouseId}` : '';
      const res = await client.get(`/invoices${query}`);
      setInvoices(res.data);
    } catch (err) {
      toast.error('Ошибка при загрузке накладных');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await client.get('/warehouses');
      const filteredWarehouses = filterWarehousesForUser(Array.isArray(res.data) ? res.data : [], user);
      setWarehouses(filteredWarehouses);
      if (!isAdmin && filteredWarehouses[0]) {
        setSelectedWarehouseId(String(filteredWarehouses[0].id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoiceDetails = async (id: number) => {
    try {
      const res = await client.get(`/invoices/${id}`);
      setSelectedInvoice(res.data);
      setShowDetailsModal(true);
    } catch (err) {
      toast.error('Ошибка при загрузке деталей накладной');
    }
  };

  const handleDeleteInvoice = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту накладную? Это действие нельзя отменить.')) return;
    try {
      await client.delete(`/invoices/${id}`);
      toast.success('Накладная удалена');
      fetchInvoices();
    } catch (err) {
      toast.error('Ошибка при удалении накладной');
    }
  };

  const handlePayment = async () => {
    if (!selectedInvoice || !paymentAmount) return;
    setIsPaying(true);
    try {
      await client.post('/payments', {
        customer_id: selectedInvoice.customerId,
        invoice_id: selectedInvoice.id,
        amount: parseFloat(paymentAmount),
        method: 'cash'
      });
      toast.success('Оплата принята');
      setShowPaymentModal(false);
      setPaymentAmount('');
      fetchInvoices();
    } catch (err) {
      toast.error('Ошибка при приеме оплаты');
    } finally {
      setIsPaying(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedInvoice || returnItems.length === 0) return;
    setIsReturning(true);
    try {
      const itemsToReturn = returnItems
        .filter(item => item.returnQty > 0)
        .map(item => ({
          productId: item.productId,
          quantity: parseFloat(item.returnQty)
        }));

      if (itemsToReturn.length === 0) {
        toast.error('Выберите товары для возврата');
        setIsReturning(false);
        return;
      }

      await client.post(`/invoices/${selectedInvoice.id}/return`, {
        items: itemsToReturn,
        reason: returnReason
      });
      toast.success('Возврат оформлен');
      setShowReturnModal(false);
      setReturnReason('');
      setReturnItems([]);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при оформлении возврата');
    } finally {
      setIsReturning(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.id.toString().includes(search) ||
      inv.customer_name.toLowerCase().includes(search.toLowerCase());

    if (isAdmin || !userWarehouseId) {
      return matchesSearch;
    }

    const invoiceWarehouseId = inv.warehouseId || inv.warehouse?.id;
    return matchesSearch && Number(invoiceWarehouseId) === userWarehouseId;
  });

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getStatusBadge = (status: string, cancelled: boolean) => {
    if (cancelled) return <span className="rounded-full bg-rose-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-rose-500">Отменена</span>;
    switch (status) {
      case 'paid': return <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-500">Оплачено</span>;
      case 'partial': return <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-500">Частично</span>;
      default: return <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Не оплачено</span>;
    }
  };

  const getInvoiceSubtotal = (invoice: any) =>
    Array.isArray(invoice?.items)
      ? invoice.items.reduce((sum: number, item: any) => sum + Number(item.totalPrice || 0), 0)
      : Number(invoice?.totalAmount || 0);

  const getInvoiceDiscountAmount = (invoice: any) => {
    const subtotal = getInvoiceSubtotal(invoice);
    const discount = Number(invoice?.discount || 0);
    return subtotal * (discount / 100);
  };

  const getInvoiceNetAmount = (invoice: any) => {
    const subtotal = getInvoiceSubtotal(invoice);
    const discountAmount = getInvoiceDiscountAmount(invoice);
    const returnedAmount = Number(invoice?.returnedAmount || 0);
    const calculatedNet = subtotal - discountAmount - returnedAmount;
    const storedNet = Number(invoice?.netAmount || 0);

    if (Math.abs(calculatedNet - storedNet) <= PAYMENT_EPSILON) {
      return storedNet;
    }

    return Math.max(0, calculatedNet);
  };

  const getEffectiveStatus = (invoice: any) => {
    if (invoice?.cancelled) {
      return 'cancelled';
    }

    const paidAmount = Number(invoice?.paidAmount || 0);
    const netAmount = getInvoiceNetAmount(invoice);

    if (paidAmount > 0 && paidAmount >= netAmount - PAYMENT_EPSILON) {
      return 'paid';
    }

    if (paidAmount > 0) {
      return 'partial';
    }

    return 'unpaid';
  };

  const getInvoiceBalance = (invoice: any) => {
    const balance = getInvoiceNetAmount(invoice) - Number(invoice?.paidAmount || 0);
    if (balance <= PAYMENT_EPSILON) {
      return 0;
    }

    return balance;
  };

  const getPrintableStatus = (invoice: any) => {
    if (invoice?.cancelled) return 'Отменена';

    const status = getEffectiveStatus(invoice);
    if (status === 'paid') return 'Оплачено';
    if (status === 'partial') return 'Частично оплачено';
    return 'Не оплачено';
  };

  const handlePrintInvoice = (invoice: any) => {
    if (typeof window === 'undefined' || !invoice) {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=980,height=900');
    if (!printWindow) {
      toast.error('Разрешите всплывающие окна для печати накладной');
      return;
    }

    const itemsRows = Array.isArray(invoice.items)
      ? invoice.items
          .map(
            (item: any, index: number) => `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(formatProductName(item.product_name))}</td>
                <td>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</td>
                <td>${escapeHtml(formatMoney(item.sellingPrice))}</td>
                <td>${escapeHtml(formatMoney(item.totalPrice))}</td>
              </tr>
            `
          )
          .join('')
      : '';

    const discountAmount = getInvoiceDiscountAmount(invoice);
    const netAmount = getInvoiceNetAmount(invoice);
    const balanceAmount = getInvoiceBalance(invoice);
    const paymentsBlock = Array.isArray(invoice.payments) && invoice.payments.length > 0
      ? `
        <div class="section">
          <h3>Оплаты</h3>
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сумма</th>
                <th>Сотрудник</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.payments
                .map(
                  (payment: any) => `
                    <tr>
                      <td>${escapeHtml(new Date(payment.createdAt).toLocaleString('ru-RU'))}</td>
                      <td>${escapeHtml(formatMoney(payment.amount))}</td>
                      <td>${escapeHtml(payment.staff_name)}</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : '';

    const returnsBlock = Array.isArray(invoice.returns) && invoice.returns.length > 0
      ? `
        <div class="section">
          <h3>Возвраты</h3>
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сумма</th>
                <th>Причина</th>
                <th>Сотрудник</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.returns
                .map(
                  (itemReturn: any) => `
                    <tr>
                      <td>${escapeHtml(new Date(itemReturn.createdAt).toLocaleString('ru-RU'))}</td>
                      <td>-${escapeHtml(formatMoney(itemReturn.totalValue))}</td>
                      <td>${escapeHtml(itemReturn.reason || '---')}</td>
                      <td>${escapeHtml(itemReturn.staff_name)}</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : '';

    const html = `
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <title>Накладная #${invoice.id}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              font-family: Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
            }
            .sheet {
              max-width: 900px;
              margin: 0 auto;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 24px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 24px;
            }
            .title {
              font-size: 30px;
              font-weight: 700;
              margin: 0 0 8px;
            }
            .muted {
              color: #475569;
              font-size: 14px;
              line-height: 1.6;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 16px;
              margin-bottom: 24px;
            }
            .card {
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 16px;
              background: #f8fafc;
            }
            .label {
              margin: 0 0 8px;
              color: #64748b;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              font-weight: 700;
            }
            .value {
              margin: 0;
              font-size: 18px;
              font-weight: 700;
            }
            .subvalue {
              margin: 8px 0 0;
              color: #475569;
              font-size: 14px;
              line-height: 1.5;
            }
            .section {
              margin-top: 24px;
            }
            .section h3 {
              margin: 0 0 12px;
              font-size: 16px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 12px;
              font-size: 14px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f8fafc;
              font-weight: 700;
            }
            .summary {
              margin-left: auto;
              margin-top: 24px;
              width: 320px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              padding: 8px 0;
              border-bottom: 1px solid #e2e8f0;
              font-size: 14px;
            }
            .summary-row.total {
              font-size: 20px;
              font-weight: 700;
              border-top: 2px solid #cbd5e1;
              margin-top: 8px;
              padding-top: 12px;
            }
            @media print {
              body { padding: 0; }
              .sheet { max-width: none; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div>
                <h1 class="title">Накладная #${invoice.id}</h1>
                <div class="muted">
                  <div>Дата: ${escapeHtml(new Date(invoice.createdAt).toLocaleString('ru-RU'))}</div>
                  <div>Статус: ${escapeHtml(getPrintableStatus(invoice))}</div>
                  <div>Сотрудник: ${escapeHtml(invoice.staff_name || '---')}</div>
                </div>
              </div>
            </div>

            <div class="grid">
              <div class="card">
                <p class="label">Клиент</p>
                <p class="value">${escapeHtml(invoice.customer_name || 'Обычный клиент')}</p>
                <p class="subvalue">${escapeHtml(invoice.customer_phone || 'Нет телефона')}</p>
              </div>
              <div class="card">
                <p class="label">Склад</p>
                <p class="value">${escapeHtml(invoice.warehouse?.name || '---')}</p>
                <p class="subvalue">${escapeHtml(invoice.warehouse?.address || '---')}</p>
              </div>
              <div class="card">
                <p class="label">Оплата</p>
                <p class="value">${escapeHtml(formatMoney(invoice.paidAmount || 0))}</p>
                <p class="subvalue">Остаток: ${escapeHtml(formatMoney(balanceAmount))}</p>
              </div>
            </div>

            <div class="section">
              <h3>Товары</h3>
              <table>
                <thead>
                  <tr>
                    <th style="width: 52px;">№</th>
                    <th>Товар</th>
                    <th style="width: 120px;">Количество</th>
                    <th style="width: 140px;">Цена</th>
                    <th style="width: 140px;">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
            </div>

            <div class="summary">
              <div class="summary-row"><span>Подытог</span><strong>${escapeHtml(formatMoney(getInvoiceSubtotal(invoice)))}</strong></div>
              <div class="summary-row"><span>Скидка (${escapeHtml(invoice.discount || 0)}%)</span><strong>-${escapeHtml(formatMoney(discountAmount))}</strong></div>
              ${Number(invoice.returnedAmount || 0) > 0 ? `<div class="summary-row"><span>Возвращено</span><strong>-${escapeHtml(formatMoney(invoice.returnedAmount || 0))}</strong></div>` : ''}
              <div class="summary-row total"><span>Итого</span><span>${escapeHtml(formatMoney(netAmount))}</span></div>
            </div>

            ${paymentsBlock}
            ${returnsBlock}
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    switch (sortConfig.key) {
      case 'id':
        return (Number(a.id) - Number(b.id)) * direction;
      case 'createdAt':
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
      case 'customer_name':
        return String(a.customer_name || '').localeCompare(String(b.customer_name || '')) * direction;
      case 'netAmount':
        return (getInvoiceNetAmount(a) - getInvoiceNetAmount(b)) * direction;
      case 'paidAmount':
        return (Number(a.paidAmount || 0) - Number(b.paidAmount || 0)) * direction;
      case 'balance':
        return (getInvoiceBalance(a) - getInvoiceBalance(b)) * direction;
      case 'status':
        return String(getEffectiveStatus(a)).localeCompare(String(getEffectiveStatus(b))) * direction;
      case 'staff_name':
        return String(a.staff_name || '').localeCompare(String(b.staff_name || '')) * direction;
      default:
        return 0;
    }
  });

  const renderSortLabel = (label: string, key: string) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="inline-flex items-center gap-1 transition-colors hover:text-slate-600"
    >
      <span>{label}</span>
      {sortConfig.key === key ? (
        sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
      ) : (
        <Filter size={13} className="opacity-40" />
      )}
    </button>
  );

  return (
    <div className="rounded-[30px] border border-white/80 bg-[#f8f9fc] p-4 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.22)] sm:p-6">
      <div className="space-y-6">
        <div className="rounded-[28px] border border-slate-100 bg-white/95 px-5 py-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.18)] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Продажи</h1>
          <p className="mt-1 text-slate-500">Управление накладными и заказами клиентов.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-4 mr-4">
             <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900 leading-none">{user.username}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-slate-400">{user.role}</p>
             </div>
          </div>
          <select 
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            disabled={!isAdmin}
            className="min-w-[200px] rounded-2xl border border-slate-200 bg-[#f7f8fc] px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-slate-400 focus:bg-white"
          >
            <option value="">Все склады</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button 
            onClick={() => navigate('/pos')}
            className="flex items-center space-x-2 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-medium text-white transition-all hover:bg-slate-700"
          >
            <Plus size={18} />
            <span>Новая продажа</span>
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[28px] border border-slate-100 bg-white/95 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-[#fbfcfe] p-5 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Накладные</h2>
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Поиск по ID или клиенту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-600 outline-none transition-all focus:border-slate-300 focus:bg-white"
            />
          </div>
        </div>
      </div>

        <div className="space-y-3 md:hidden">
          {sortedInvoices.map((inv) => (
            <div key={`mobile-invoice-${inv.id}`} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base text-slate-900">{isAdmin ? `Накладная #${inv.id}` : 'Накладная'}</p>
                  <p className="mt-1 text-sm text-slate-500">{new Date(inv.createdAt).toLocaleDateString('ru-RU')}</p>
                  <p className="mt-2 break-words text-sm text-slate-700">{inv.customer_name}</p>
                  <p className="mt-1 text-xs text-slate-400">{inv.staff_name}</p>
                </div>
                <div className="shrink-0">{getStatusBadge(getEffectiveStatus(inv), inv.cancelled)}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Сумма</p>
                  <p className="mt-1 break-words text-sm text-slate-900">{formatMoney(getInvoiceNetAmount(inv))}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Оплачено</p>
                  <p className="mt-1 break-words text-sm text-emerald-600">{formatMoney(inv.paidAmount || 0)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Остаток</p>
                  <p className="mt-1 break-words text-sm text-rose-600">{formatMoney(getInvoiceBalance(inv))}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Склад</p>
                  <p className="mt-1 break-words text-sm text-slate-900">{inv.warehouse?.name || '---'}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {getInvoiceBalance(inv) > 0 && !inv.cancelled && (
                  <button
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setPaymentAmount(toFixedNumber(getInvoiceBalance(inv)));
                      setShowPaymentModal(true);
                    }}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
                  >
                    Оплата
                  </button>
                )}
                {!inv.cancelled && getEffectiveStatus(inv) !== 'paid' && (
                  <button
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setReturnItems(inv.items?.map((item: any) => ({ ...item, returnQty: 0 })) || []);
                      setShowReturnModal(true);
                    }}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
                  >
                    Возврат
                  </button>
                )}
                <button
                  onClick={() => fetchInvoiceDetails(inv.id)}
                  className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700"
                >
                  Детали
                </button>
                <button
                  onClick={() => handleDeleteInvoice(inv.id)}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#fafbfe] text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                {isAdmin && <th className="px-5 py-5">{renderSortLabel('ID', 'id')}</th>}
                <th className="px-5 py-5">{renderSortLabel("Дата", "createdAt")}</th>
                <th className="px-5 py-5">{renderSortLabel("Клиент", "customer_name")}</th>
                <th className="px-5 py-5">{renderSortLabel("Сумма", "netAmount")}</th>
                <th className="px-5 py-5">{renderSortLabel("Оплачено", "paidAmount")}</th>
                <th className="px-5 py-5">{renderSortLabel("Остаток", "balance")}</th>
                <th className="px-5 py-5">{renderSortLabel("Статус", "status")}</th>
                <th className="px-5 py-5">{renderSortLabel("Сотрудник", "staff_name")}</th>
                <th className="px-5 py-5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedInvoices.map((inv) => (
                <tr key={inv.id} className="transition-all duration-300 hover:bg-[#fafbfe]">
                  {isAdmin && <td className="px-5 py-5 text-sm text-slate-400">#{inv.id}</td>}
                  <td className="px-5 py-5 text-sm text-slate-500">
                    {new Date(inv.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-5 py-5 text-sm text-slate-700">{inv.customer_name}</td>
                  <td className="px-5 py-5 text-sm text-slate-700">{formatMoney(getInvoiceNetAmount(inv))}</td>
                  <td className="px-5 py-5 text-sm text-emerald-500">{formatMoney(inv.paidAmount || 0)}</td>
                  <td className="px-5 py-5 text-sm text-rose-500">{formatMoney(getInvoiceBalance(inv))}</td>
                  <td className="px-5 py-5">{getStatusBadge(getEffectiveStatus(inv), inv.cancelled)}</td>
                  <td className="px-5 py-5 text-sm text-slate-500">{inv.staff_name}</td>
                  <td className="px-5 py-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {getInvoiceBalance(inv) > 0 && !inv.cancelled && (
                        <button 
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setPaymentAmount(toFixedNumber(getInvoiceBalance(inv)));
                            setShowPaymentModal(true);
                          }}
                          className="rounded-xl border border-slate-200 bg-white p-2.5 text-emerald-500 transition-all hover:border-emerald-100 hover:bg-emerald-50" 
                          title="Принять оплату"
                        >
                          <Banknote size={18} />
                        </button>
                      )}
                      {!inv.cancelled && getEffectiveStatus(inv) !== 'paid' && (
                        <button 
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setReturnItems(inv.items?.map((item: any) => ({ ...item, returnQty: 0 })) || []);
                            setShowReturnModal(true);
                          }}
                          className="rounded-xl border border-slate-200 bg-white p-2.5 text-amber-500 transition-all hover:border-amber-100 hover:bg-amber-50" 
                          title="Возврат"
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => fetchInvoiceDetails(inv.id)}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 transition-all hover:border-sky-100 hover:bg-sky-50 hover:text-sky-500" 
                        title="Просмотр"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 transition-all hover:border-rose-100 hover:bg-rose-50 hover:text-rose-500" 
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedInvoices.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#f4f5fb] text-slate-300">
                        <Receipt size={48} />
                      </div>
                      <p className="text-slate-400 font-bold">Накладные не найдены</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showDetailsModal && selectedInvoice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl md:rounded-[2.5rem]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4 md:p-8">
                <div className="flex items-center space-x-4">
                  <div className="rounded-2xl bg-indigo-600 p-2.5 text-white md:p-3">
                    <Receipt size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Накладная #{selectedInvoice.id}</h3>
                    <p className="text-slate-500 font-bold">{new Date(selectedInvoice.createdAt).toLocaleString('ru-RU')}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-5 md:p-8 md:space-y-8">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-6">
                  <div className="rounded-[22px] bg-slate-50 p-4 md:rounded-3xl md:p-6">
                    <div className="flex items-center space-x-3 text-slate-400 mb-4">
                      <UserIcon size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Клиент</span>
                    </div>
                    <p className="text-lg font-black text-slate-900">{selectedInvoice.customer_name}</p>
                    <p className="text-sm font-bold text-slate-500 mt-1">{selectedInvoice.customer_phone || 'Нет телефона'}</p>
                  </div>
                  <div className="rounded-[22px] bg-slate-50 p-4 md:rounded-3xl md:p-6">
                    <div className="flex items-center space-x-3 text-slate-400 mb-4">
                      <WarehouseIcon size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Склад</span>
                    </div>
                    <p className="text-lg font-black text-slate-900">{selectedInvoice.warehouse?.name}</p>
                    <p className="text-sm font-bold text-slate-500 mt-1">{selectedInvoice.warehouse?.address || '---'}</p>
                  </div>
                  <div className="rounded-[22px] bg-slate-50 p-4 md:rounded-3xl md:p-6">
                    <div className="flex items-center space-x-3 text-slate-400 mb-4">
                      <Clock size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Статус</span>
                    </div>
                    <div>{getStatusBadge(getEffectiveStatus(selectedInvoice), selectedInvoice.cancelled)}</div>
                    <p className="text-sm font-bold text-slate-500 mt-2">Сотрудник: {selectedInvoice.staff_name}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-2">Товары</h4>
                  <div className="overflow-hidden rounded-[22px] border border-slate-100 bg-white md:rounded-3xl">
                    <div className="space-y-3 p-3 md:hidden">
                      {selectedInvoice.items.map((item: any) => (
                        <div key={`mobile-item-${item.id}`} className="rounded-2xl bg-slate-50 p-3">
                          <p className="break-words text-sm font-black text-slate-900">{formatProductName(item.product_name)}</p>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-xl bg-white px-2.5 py-2">
                              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Кол-во</p>
                              <p className="mt-1 font-bold text-slate-700">{item.quantity} {item.unit}</p>
                            </div>
                            <div className="rounded-xl bg-white px-2.5 py-2">
                              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Цена</p>
                              <p className="mt-1 font-bold text-slate-700">{formatMoney(item.sellingPrice)}</p>
                            </div>
                            <div className="rounded-xl bg-white px-2.5 py-2">
                              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Итого</p>
                              <p className="mt-1 font-black text-slate-900">{formatMoney(item.totalPrice)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <table className="hidden w-full text-left md:table">
                      <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                          <th className="px-6 py-4">Товар</th>
                          <th className="px-6 py-4">Кол-во</th>
                          <th className="px-6 py-4">Цена</th>
                          <th className="px-6 py-4 text-right">Итого</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedInvoice.items.map((item: any) => {
                          return (
                            <tr key={item.id}>
                              <td className="px-6 py-4">
                                <p className="font-black text-slate-900">{formatProductName(item.product_name)}</p>
                                {item.saleAllocations && item.saleAllocations.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {item.saleAllocations.map((sa: any) => (
                                      <span key={sa.id} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] rounded font-black uppercase tracking-tighter">
                                        Партия #{sa.batchId} ({sa.quantity} {item.unit})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-500">{item.quantity} {item.unit}</td>
                              <td className="px-6 py-4 font-bold text-slate-500">{formatMoney(item.sellingPrice)}</td>
                              <td className="px-6 py-4 text-right font-black text-slate-900">{formatMoney(item.totalPrice)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-3">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span className="font-bold">Подытог:</span>
                      <span className="font-black">{formatMoney(getInvoiceSubtotal(selectedInvoice))}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span className="font-bold">Скидка ({selectedInvoice.discount}%):</span>
                      <span className="font-black">-{toFixedNumber(getInvoiceDiscountAmount(selectedInvoice))} TJS</span>
                    </div>
                    {selectedInvoice.returnedAmount > 0 && (
                      <div className="flex items-center justify-between text-sm text-rose-500">
                        <span className="font-bold">Возвращено:</span>
                        <span className="font-black">-{toFixedNumber(selectedInvoice.returnedAmount || 0)} TJS</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xl font-black text-slate-900 md:text-2xl">
                      <span>Итого:</span>
                      <span>{formatMoney(getInvoiceNetAmount(selectedInvoice))}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
                      <span className="font-bold">Оплачено:</span>
                      <span className="font-black text-emerald-600">{formatMoney(selectedInvoice.paidAmount || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span className="font-bold">Остаток (Долг):</span>
                      <span className="font-black text-rose-600">{formatMoney(getInvoiceBalance(selectedInvoice))}</span>
                    </div>
                  </div>
                </div>

                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-2">История платежей</h4>
                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-6 py-4">Дата</th>
                            <th className="px-6 py-4">Сумма</th>
                            <th className="px-6 py-4">Сотрудник</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedInvoice.payments.map((p: any) => (
                            <tr key={p.id}>
                              <td className="px-6 py-4 font-bold text-slate-500">{new Date(p.createdAt).toLocaleString('ru-RU')}</td>
                              <td className="px-6 py-4 font-black text-emerald-600">{formatMoney(p.amount)}</td>
                              <td className="px-6 py-4 text-slate-500">{p.staff_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedInvoice.returns && selectedInvoice.returns.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-2">История возвратов</h4>
                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-6 py-4">Дата</th>
                            <th className="px-6 py-4">Сумма</th>
                            <th className="px-6 py-4">Причина</th>
                            <th className="px-6 py-4">Сотрудник</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedInvoice.returns.map((r: any) => (
                            <tr key={r.id}>
                              <td className="px-6 py-4 font-bold text-slate-500">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
                              <td className="px-6 py-4 font-black text-rose-600">-{toFixedNumber(r.totalValue)} TJS</td>
                              <td className="px-6 py-4 text-slate-500 italic">{r.reason}</td>
                              <td className="px-6 py-4 text-slate-500">{r.staff_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4 md:p-8">
                <button
                  onClick={() => handlePrintInvoice(selectedInvoice)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-3 text-sm font-bold text-indigo-700 transition-all hover:bg-indigo-100 md:px-8 md:py-4"
                >
                  <Printer size={18} />
                  <span>Печать</span>
                </button>
                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 md:px-10 md:py-4"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentModal && selectedInvoice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl">
                    <Banknote size={24} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Принять оплату</h3>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <p className="text-sm font-bold text-slate-500 mb-1">Накладная #{selectedInvoice.id}</p>
                  <p className="text-lg font-black text-slate-900">{selectedInvoice.customer_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Итого</p>
                    <p className="text-lg font-black text-slate-900">{formatMoney(getInvoiceNetAmount(selectedInvoice))}</p>
                  </div>
                  <div className="p-4 bg-rose-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Долг</p>
                    <p className="text-lg font-black text-rose-600">{formatMoney(getInvoiceBalance(selectedInvoice))}</p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Сумма оплаты</label>
                  <input 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full mt-1 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all font-black text-2xl text-slate-900 shadow-sm"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={handlePayment}
                  disabled={isPaying || !paymentAmount}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isPaying ? 'Сохранение...' : 'Внести'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReturnModal && selectedInvoice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-amber-600 text-white rounded-2xl">
                    <RotateCcw size={24} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Оформить возврат</h3>
                </div>
                <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                <div>
                  <p className="text-sm font-bold text-slate-500 mb-1">Накладная #{selectedInvoice.id}</p>
                  <p className="text-lg font-black text-slate-900">{selectedInvoice.customer_name}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Выберите товары для возврата</h4>
                  <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="px-6 py-4">Товар</th>
                          <th className="px-6 py-4">Продано</th>
                          <th className="px-6 py-4">Возврат</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {returnItems.map((item: any, idx: number) => (
                          <tr key={item.id}>
                            <td className="px-6 py-4 font-black text-slate-900">{formatProductName(item.product_name)}</td>
                            <td className="px-6 py-4 font-bold text-slate-500">{item.quantity} {item.unit}</td>
                            <td className="px-6 py-4">
                              <input 
                                type="number" 
                                min="0"
                                max={item.quantity - (item.returnedQty || 0)}
                                value={item.returnQty}
                                onChange={(e) => {
                                  const newItems = [...returnItems];
                                  newItems[idx].returnQty = e.target.value;
                                  setReturnItems(newItems);
                                }}
                                className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-center outline-none focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Причина возврата</label>
                  <textarea 
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full mt-1 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500 outline-none transition-all font-bold text-slate-900 shadow-sm min-h-[100px]"
                    placeholder="Укажите причину возврата..."
                  />
                </div>
              </div>
              
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleReturn}
                  disabled={isReturning || returnItems.every(item => !item.returnQty || parseFloat(item.returnQty) === 0)}
                  className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isReturning ? 'Оформление...' : 'Оформить возврат'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
