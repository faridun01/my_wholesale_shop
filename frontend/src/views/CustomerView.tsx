import React, { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, Phone, MapPin, X, User, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Card, Badge } from '../components/UI';
import client from '../api/client';
import { formatCount, formatMoney } from '../utils/format';
import ConfirmationModal from '../components/common/ConfirmationModal';

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  total_invoiced: number;
  total_paid: number;
  balance: number;
}

interface StatementPayment {
  id: number;
  amount: number;
  method: string;
  createdAt: string;
  staff_name: string;
}

interface StatementReturn {
  id: number;
  totalValue: number;
  reason?: string;
  createdAt: string;
  staff_name: string;
}

interface StatementItem {
  id: number;
  product?: { name?: string };
  quantity: number;
  returnedQty?: number;
  sellingPrice: number;
}

interface StatementInvoice {
  id: number;
  createdAt: string;
  totalAmount: number;
  discount: number;
  netAmount: number;
  paidAmount: number;
  returnedAmount: number;
  status: string;
  warehouse?: { name?: string };
  items?: StatementItem[];
  invoiceBalance: number;
  paymentEvents: StatementPayment[];
  returnEvents: StatementReturn[];
}

const emptyForm = { name: '', phone: '', address: '', notes: '' };

export default function CustomerView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<StatementInvoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [statementData, setStatementData] = useState<StatementInvoice[]>([]);
  const [formData, setFormData] = useState(emptyForm);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const PAYMENT_EPSILON = 0.01;

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await client.get('/customers');
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Ошибка при загрузке клиентов');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedCustomer) {
        await client.put(`/customers/${selectedCustomer.id}`, formData);
        toast.success('Клиент обновлен');
      } else {
        await client.post('/customers', formData);
        toast.success('Клиент добавлен');
      }

      setIsModalOpen(false);
      setSelectedCustomer(null);
      setFormData(emptyForm);
      fetchCustomers();
    } catch {
      toast.error('Ошибка при сохранении');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Вы уверены?')) return;

    try {
      await client.delete(`/customers/${id}`);
      toast.success('Клиент удален');
      fetchCustomers();
    } catch {
      toast.error('Ошибка при удалении');
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedCustomer) return;

    try {
      await client.delete(`/customers/${selectedCustomer.id}`);
      toast.success('Клиент удален');
      setShowDeleteConfirm(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch {
      toast.error('Ошибка при удалении');
    }
  };

  const openStatement = async (customer: Customer) => {
    setSelectedCustomer(customer);

    try {
      const res = await client.get(`/customers/${customer.id}/history`);
      setStatementData(Array.isArray(res.data) ? res.data : []);
      setIsStatementOpen(true);
    } catch {
      toast.error('Ошибка при загрузке истории клиента');
    }
  };

  const openInvoiceDetails = (invoice: StatementInvoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDetailsOpen(true);
  };

  const escapeHtml = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const getInvoiceSubtotal = (invoice: StatementInvoice) =>
    Array.isArray(invoice?.items)
      ? invoice.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.sellingPrice || 0), 0)
      : Number(invoice?.totalAmount || 0);

  const getInvoiceDiscountAmount = (invoice: StatementInvoice) => {
    const subtotal = getInvoiceSubtotal(invoice);
    const discount = Number(invoice?.discount || 0);
    return subtotal * (discount / 100);
  };

  const getInvoiceNetAmount = (invoice: StatementInvoice) => {
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

  const getInvoiceChangeAmount = (invoice: StatementInvoice) => {
    const change = Number(invoice?.paidAmount || 0) - getInvoiceNetAmount(invoice);
    return change > PAYMENT_EPSILON ? change : 0;
  };

  const getInvoiceAppliedPaidAmount = (invoice: StatementInvoice) =>
    Math.max(0, Number(invoice?.paidAmount || 0) - getInvoiceChangeAmount(invoice));

  const getPrintableStatus = (invoice: StatementInvoice) => {
    if (invoice.status === 'paid') return 'Оплачено';
    if (invoice.invoiceBalance > PAYMENT_EPSILON) return 'Есть долг';
    return 'Закрыто';
  };

  const handlePrintInvoice = (invoice: StatementInvoice) => {
    if (typeof window === 'undefined' || !selectedCustomer) {
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
            (item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(item.product?.name || '---')}</td>
                <td>${escapeHtml(item.quantity)} шт</td>
                <td>${escapeHtml(formatMoney(item.sellingPrice))}</td>
                <td>${escapeHtml(formatMoney(Number(item.quantity || 0) * Number(item.sellingPrice || 0)))}</td>
              </tr>
            `,
          )
          .join('')
      : '';

    const paymentsBlock = Array.isArray(invoice.paymentEvents) && invoice.paymentEvents.length > 0
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
              ${invoice.paymentEvents
                .map(
                  (payment) => `
                    <tr>
                      <td>${escapeHtml(new Date(payment.createdAt).toLocaleString('ru-RU'))}</td>
                      <td>${escapeHtml(formatMoney(payment.amount))}</td>
                      <td>${escapeHtml(payment.staff_name)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : '';

    const returnsBlock = Array.isArray(invoice.returnEvents) && invoice.returnEvents.length > 0
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
              ${invoice.returnEvents
                .map(
                  (itemReturn) => `
                    <tr>
                      <td>${escapeHtml(new Date(itemReturn.createdAt).toLocaleString('ru-RU'))}</td>
                      <td>-${escapeHtml(formatMoney(itemReturn.totalValue))}</td>
                      <td>${escapeHtml(itemReturn.reason || '---')}</td>
                      <td>${escapeHtml(itemReturn.staff_name)}</td>
                    </tr>
                  `,
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
            body { margin: 0; padding: 32px; font-family: Arial, sans-serif; color: #0f172a; background: #fff; }
            .sheet { max-width: 900px; margin: 0 auto; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
            .title { font-size: 30px; font-weight: 700; margin: 0 0 8px; }
            .muted { color: #475569; font-size: 14px; line-height: 1.6; }
            .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
            .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background: #f8fafc; }
            .label { margin: 0 0 8px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
            .value { margin: 0; font-size: 18px; font-weight: 700; }
            .subvalue { margin: 8px 0 0; color: #475569; font-size: 14px; line-height: 1.5; }
            .section { margin-top: 24px; }
            .section h3 { margin: 0 0 12px; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; font-size: 14px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; font-weight: 700; }
            .summary { margin-left: auto; margin-top: 24px; width: 320px; }
            .summary-row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            .summary-row.total { font-size: 20px; font-weight: 700; border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <h1 class="title">Накладная #${invoice.id}</h1>
              <div class="muted">
                <div>Дата: ${escapeHtml(new Date(invoice.createdAt).toLocaleString('ru-RU'))}</div>
                <div>Статус: ${escapeHtml(getPrintableStatus(invoice))}</div>
              </div>
            </div>
            <div class="grid">
              <div class="card">
                <p class="label">Клиент</p>
                <p class="value">${escapeHtml(selectedCustomer.name || '---')}</p>
                <p class="subvalue">${escapeHtml(selectedCustomer.phone || 'Нет телефона')}</p>
              </div>
              <div class="card">
                <p class="label">Склад</p>
                <p class="value">${escapeHtml(invoice.warehouse?.name || '---')}</p>
              </div>
              <div class="card">
                <p class="label">Оплата</p>
                <p class="value">${escapeHtml(formatMoney(getInvoiceAppliedPaidAmount(invoice)))}</p>
                <p class="subvalue">${getInvoiceChangeAmount(invoice) > PAYMENT_EPSILON ? `Сдача клиенту: ${escapeHtml(formatMoney(getInvoiceChangeAmount(invoice)))}` : `Остаток: ${escapeHtml(formatMoney(invoice.invoiceBalance))}`}</p>
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
                <tbody>${itemsRows}</tbody>
              </table>
            </div>
            <div class="summary">
              <div class="summary-row"><span>Подытог</span><strong>${escapeHtml(formatMoney(getInvoiceSubtotal(invoice)))}</strong></div>
              <div class="summary-row"><span>Скидка (${escapeHtml(invoice.discount)}%)</span><strong>-${escapeHtml(formatMoney(getInvoiceDiscountAmount(invoice)))}</strong></div>
              ${Number(invoice.returnedAmount || 0) > 0 ? `<div class="summary-row"><span>Возвращено</span><strong>-${escapeHtml(formatMoney(invoice.returnedAmount))}</strong></div>` : ''}
              <div class="summary-row total"><span>Итого</span><strong>${escapeHtml(formatMoney(getInvoiceNetAmount(invoice)))}</strong></div>
              <div class="summary-row"><span>Оплачено</span><strong>${escapeHtml(formatMoney(getInvoiceAppliedPaidAmount(invoice)))}</strong></div>
              <div class="summary-row"><span>Остаток</span><strong>${escapeHtml(formatMoney(invoice.invoiceBalance))}</strong></div>
            </div>
            ${paymentsBlock}
            ${returnsBlock}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm),
  );

  return (
    <div className="rounded-[30px] border border-white/70 bg-[#f4f5fb] p-4 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[28px] border border-white bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-medium tracking-tight text-slate-900">Клиенты</h1>
              <p className="mt-1 text-slate-500">Только накладные формируют историю операций и баланс клиента.</p>
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setFormData(emptyForm);
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center space-x-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-all hover:bg-slate-800"
            >
              <Plus size={18} />
              <span>Новый клиент</span>
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Поиск по имени или телефону..."
                className="w-full rounded-2xl border border-slate-200 bg-[#f7f8fc] py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 2xl:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <motion.div layout key={customer.id} className="h-full">
                <Card className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white shadow-sm transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 transition-colors duration-300 group-hover:bg-sky-500 group-hover:text-white">
                      <User size={28} strokeWidth={2.2} />
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setFormData({
                            name: customer.name || '',
                            phone: customer.phone || '',
                            address: customer.address || '',
                            notes: customer.notes || '',
                          });
                          setIsModalOpen(true);
                        }}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowDeleteConfirm(true);
                        }}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <h3 className="mb-3 break-words text-xl font-medium leading-7 text-slate-900">{customer.name}</h3>
                  <div className="mb-6 space-y-3">
                    <div className="flex items-start text-sm text-slate-500">
                      <Phone size={14} className="mr-2" /> {customer.phone || 'Нет телефона'}
                    </div>
                    <div className="flex items-center text-sm text-slate-500">
                      <MapPin size={14} className="mr-2" /> {customer.address || 'Нет адреса'}
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl bg-[#f4f5fb] p-4 lg:grid-cols-3">
                    <div className="min-w-0 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-3">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Накладные</p>
                      <p className="whitespace-nowrap text-[10px] leading-4 tabular-nums text-slate-900 xl:text-[11px]">{formatMoney(customer.total_invoiced).replace(' TJS', '')}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Оплачено</p>
                      <p className="whitespace-nowrap text-[10px] leading-4 tabular-nums text-emerald-600 xl:text-[11px]">{formatMoney(customer.total_paid).replace(' TJS', '')}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-3">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Долг</p>
                      <p className={`whitespace-nowrap text-[10px] leading-4 tabular-nums xl:text-[11px] ${customer.balance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatMoney(customer.balance).replace(' TJS', '')}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => openStatement(customer)}
                    className="mt-auto flex w-full items-center justify-center space-x-2 rounded-2xl border border-violet-200 bg-violet-50 py-3 text-sm font-medium text-violet-700 transition-all hover:border-violet-300 hover:bg-violet-100"
                  >
                    <FileText size={16} />
                    <span>Накладные клиента</span>
                  </button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        <ConfirmationModal
          isOpen={showDeleteConfirm}
          title="Удалить клиента?"
          message={selectedCustomer ? `Клиент "${selectedCustomer.name}" будет скрыт из активного списка.` : 'Клиент будет скрыт из активного списка.'}
          confirmText="Удалить"
          cancelText="Отмена"
          onConfirm={handleDeleteConfirmed}
          onClose={() => {
            setShowDeleteConfirm(false);
            setSelectedCustomer(null);
          }}
        />

        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:rounded-[2.5rem]"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-10 sm:py-8">
                  <h2 className="text-2xl font-medium tracking-tight text-slate-900">
                    {selectedCustomer ? 'Редактировать клиента' : 'Новый клиент'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="rounded-xl p-2 transition-colors hover:bg-white">
                    <X />
                  </button>
                </div>
                <form onSubmit={handleSave} className="space-y-5 p-5 sm:space-y-6 sm:p-10">
                  <div className="space-y-2">
                    <label className="ml-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Имя клиента</label>
                    <input
                      required
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 outline-none transition-all focus:ring-4 focus:ring-slate-500/10"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Телефон</label>
                    <input
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 outline-none transition-all focus:ring-4 focus:ring-slate-500/10"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Адрес</label>
                    <input
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 outline-none transition-all focus:ring-4 focus:ring-slate-500/10"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Заметки</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-2xl bg-slate-50 px-6 py-4 outline-none transition-all focus:ring-4 focus:ring-slate-500/10"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="w-full rounded-2xl bg-slate-900 py-5 text-white transition-all hover:bg-slate-800">
                    Сохранить
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isStatementOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsStatementOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:rounded-[3rem]"
              >
                <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-10 sm:py-10">
                  <div className="mb-5 flex items-start justify-between gap-4 sm:mb-6">
                    <div>
                      <h2 className="text-3xl font-medium tracking-tight text-slate-900">{selectedCustomer.name}</h2>
                      <p className="mt-1 text-slate-500">История и баланс строятся только по накладным.</p>
                    </div>
                    <button onClick={() => setIsStatementOpen(false)} className="rounded-2xl p-3 shadow-sm transition-colors hover:bg-white">
                      <X />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
                    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Всего по накладным</p>
                      <p className="text-lg font-medium text-slate-900 md:text-xl">{formatMoney(selectedCustomer.total_invoiced)}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Всего оплачено</p>
                      <p className="text-xl font-medium text-emerald-600">{formatMoney(selectedCustomer.total_paid)}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-slate-400">Текущий долг</p>
                      <p className="text-xl font-medium text-rose-600">{formatMoney(selectedCustomer.balance)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
                  <div className="space-y-3">
                    {statementData.length === 0 && (
                      <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                        У клиента пока нет накладных.
                      </div>
                    )}

                    {statementData.map((invoice) => (
                      <div
                        key={invoice.id}
                        onClick={() => openInvoiceDetails(invoice)}
                        className="flex cursor-pointer flex-col items-start gap-4 rounded-[24px] bg-slate-50 p-4 transition-colors hover:bg-slate-100 sm:flex-row sm:items-center sm:justify-between md:rounded-3xl md:p-6"
                      >
                        <div className="flex w-full min-w-0 items-center space-x-4 md:space-x-6">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 md:h-14 md:w-14">
                            <FileText size={20} />
                          </div>
                          <div>
                            <p className="text-base font-medium text-slate-900 md:text-lg">Накладная #{invoice.id}</p>
                            <p className="text-xs text-slate-400 md:text-sm">
                              {new Date(invoice.createdAt).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Оплаты: {formatCount(invoice.paymentEvents?.length || 0)} · Возвраты: {formatCount(invoice.returnEvents?.length || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="w-full text-left sm:w-auto sm:text-right">
                          <p className="text-lg font-medium text-slate-900 md:text-xl">{formatMoney(invoice.netAmount)}</p>
                          <div className="mt-1.5 flex justify-end">
                            <Badge variant={invoice.status === 'paid' ? 'success' : invoice.invoiceBalance > 0 ? 'warning' : 'default'}>
                              {invoice.status === 'paid' ? 'Оплачено' : invoice.invoiceBalance > 0 ? 'Есть долг' : 'Закрыто'}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-500">Остаток: {formatMoney(invoice.invoiceBalance)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isInvoiceDetailsOpen && selectedInvoice && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsInvoiceDetailsOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:rounded-[2.5rem]"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5 sm:p-8">
                  <h3 className="text-2xl font-medium text-slate-900">Накладная #{selectedInvoice.id}</h3>
                  <button onClick={() => setIsInvoiceDetailsOpen(false)} className="rounded-xl p-2 transition-colors hover:bg-white">
                    <X />
                  </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-8">
                  <div className="flex flex-col gap-1 text-sm text-slate-500 sm:flex-row sm:justify-between">
                    <span>Дата: {new Date(selectedInvoice.createdAt).toLocaleString('ru-RU')}</span>
                    <span>Склад: {selectedInvoice.warehouse?.name || '---'}</span>
                  </div>

                  <div className="space-y-4">
                    {selectedInvoice.items?.map((item) => (
                      <div key={item.id} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{item.product?.name}</p>
                          <p className="text-xs text-slate-400">
                            {formatCount(item.quantity)} x {formatMoney(item.sellingPrice)}
                          </p>
                          {Number(item.returnedQty || 0) > 0 && (
                            <p className="mt-1 text-xs text-amber-600">Возвращено: {formatCount(item.returnedQty || 0)}</p>
                          )}
                        </div>
                        <p className="font-medium text-slate-900">{formatMoney(Number(item.quantity || 0) * Number(item.sellingPrice || 0))}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-6">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Сумма</span>
                      <span>{formatMoney(selectedInvoice.totalAmount)}</span>
                    </div>
                    {Number(selectedInvoice.discount || 0) > 0 && (
                      <div className="flex justify-between text-sm text-rose-500">
                        <span>Скидка ({selectedInvoice.discount}%)</span>
                        <span>-{formatMoney((Number(selectedInvoice.totalAmount || 0) * Number(selectedInvoice.discount || 0)) / 100)}</span>
                      </div>
                    )}
                    {Number(selectedInvoice.returnedAmount || 0) > 0 && (
                      <div className="flex justify-between text-sm text-amber-600">
                        <span>Возвраты</span>
                        <span>-{formatMoney(selectedInvoice.returnedAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 text-lg font-medium text-slate-900 md:text-xl">
                      <span>Итого</span>
                      <span>{formatMoney(selectedInvoice.netAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Оплачено</span>
                      <span>{formatMoney(selectedInvoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-rose-600">
                      <span>Остаток</span>
                      <span>{formatMoney(selectedInvoice.invoiceBalance)}</span>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-slate-100 pt-6">
                    <h4 className="text-sm font-medium text-slate-900">Оплаты по накладной</h4>
                    {selectedInvoice.paymentEvents?.length ? (
                      selectedInvoice.paymentEvents.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-emerald-700">{formatMoney(payment.amount)}</p>
                            <p className="text-xs text-emerald-600">
                              {new Date(payment.createdAt).toLocaleString('ru-RU')} · {payment.staff_name}
                            </p>
                          </div>
                          <span className="text-xs uppercase tracking-wider text-emerald-600">{payment.method}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 md:text-sm">Оплат по этой накладной нет.</p>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-slate-100 pt-6">
                    <h4 className="text-sm font-medium text-slate-900">Возвраты по накладной</h4>
                    {selectedInvoice.returnEvents?.length ? (
                      selectedInvoice.returnEvents.map((itemReturn) => (
                        <div key={itemReturn.id} className="rounded-2xl bg-amber-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-medium text-amber-700">{formatMoney(itemReturn.totalValue)}</p>
                            <p className="text-xs text-amber-600">{new Date(itemReturn.createdAt).toLocaleString('ru-RU')}</p>
                          </div>
                          <p className="mt-1 text-xs text-amber-700">{itemReturn.staff_name}</p>
                          {itemReturn.reason && <p className="mt-1 text-xs text-amber-600">{itemReturn.reason}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 md:text-sm">Возвратов по этой накладной нет.</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50 p-5 sm:p-8">
                  <button
                    onClick={() => handlePrintInvoice(selectedInvoice)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-3 text-sm font-bold text-indigo-700 transition-all hover:bg-indigo-100"
                  >
                    <Printer size={18} />
                    <span>Печать</span>
                  </button>
                  <button
                    onClick={() => setIsInvoiceDetailsOpen(false)}
                    className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                  >
                    Закрыть
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


