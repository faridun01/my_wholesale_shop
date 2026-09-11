import React, { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Search, Plus, Edit2, Trash2, FileText, Phone, MapPin, X, User, Printer, Share2, Receipt, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Card, Badge } from '../components/UI';
import client from '../api/client';
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../api/customers.api';
import { formatCount, formatMoney, formatTransactionReason } from '../utils/format';
import { formatProductName } from '../utils/productName';
import ConfirmationModal from '../components/common/ConfirmationModal';
import PaginationControls from '../components/common/PaginationControls';
import { getCurrentUser, isAdminUser } from '../utils/userAccess';
import { NavLink, useLocation } from 'react-router-dom';
import {
  CUSTOMER_PAYMENT_EPSILON,
  getInvoiceAppliedPaidAmount,
  getInvoiceChangeAmount,
  getInvoiceDiscountAmount,
  getInvoiceItemQuantityParts,
  getInvoiceNetAmount,
  getInvoiceSubtotal,
} from '../components/customers/customerInvoiceCalculations';
import { segmentTone, useCustomerList } from '../components/customers/useCustomerList';
import type { Customer, StatementInvoice } from '../types/customer';

const emptyForm = {
  customerType: 'individual',
  name: '',
  customerCategory: '',
  companyName: '',
  contactName: '',
  phone: '',
  country: 'Таджикистан',
  region: '',
  city: '',
  address: '',
  notes: '',
};

const sectionTabClassName = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold transition-all',
    isActive ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');

export default function CustomerView() {
  const location = useLocation();
  const user = useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(user);
  const pageSize = 6;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('strength');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<StatementInvoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [statementData, setStatementData] = useState<StatementInvoice[]>([]);
  const [statementFilter, setStatementFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [statementSearch, setStatementSearch] = useState('');
  const [formData, setFormData] = useState(emptyForm);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPrintingReconciliation, setIsPrintingReconciliation] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const PAYMENT_EPSILON = CUSTOMER_PAYMENT_EPSILON;

  const getCustomerInvoiceBadge = (inv: StatementInvoice) => {
    const balance = Number(inv.invoiceBalance ?? 0);
    const netAmount = Number(inv.netAmount ?? 0);
    const paid = Math.max(0, netAmount - balance);

    if (inv.cancelled) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
          Отменена
        </span>
      );
    }
    if (balance <= PAYMENT_EPSILON) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Оплачено
        </span>
      );
    }
    if (paid > PAYMENT_EPSILON) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Частично
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200/60">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Не оплачено
      </span>
    );
  };

  const filteredStatementInvoices = useMemo(() => {
    return statementData.filter((inv) => {
      const balance = Number(inv.invoiceBalance ?? 0);
      const isUnpaid = balance > PAYMENT_EPSILON;
      if (statementFilter === 'unpaid' && !isUnpaid) return false;
      if (statementFilter === 'paid' && isUnpaid) return false;
      if (statementSearch.trim()) {
        const q = statementSearch.trim().toLowerCase();
        const matchId = String(inv.id).includes(q);
        const matchDate = new Date(inv.createdAt).toLocaleDateString('ru-RU').toLowerCase().includes(q);
        const matchWh = String(inv.warehouse?.name || '').toLowerCase().includes(q);
        return matchId || matchDate || matchWh;
      }
      return true;
    });
  }, [statementData, statementFilter, statementSearch, PAYMENT_EPSILON]);

  const unpaidStatementCount = useMemo(() => {
    return statementData.filter((inv) => Number(inv.invoiceBalance ?? 0) > PAYMENT_EPSILON).length;
  }, [statementData, PAYMENT_EPSILON]);

  const paidStatementCount = useMemo(() => {
    return statementData.filter((inv) => Number(inv.invoiceBalance ?? 0) <= PAYMENT_EPSILON).length;
  }, [statementData, PAYMENT_EPSILON]);

  const { customerCategories, paginatedCustomers, sortedCustomers, totalPages } = useCustomerList({
    currentPage,
    customers,
    pageSize,
    searchTerm,
    segmentFilter,
    sortBy,
  });
  const formatMoneyByRole = (value: unknown, trimCurrency = false) => {
    if (!isAdmin) {
      return 'Скрыто';
    }

    const formatted = formatMoney(value);
    return trimCurrency ? formatted.replace(' TJS', '') : formatted;
  };

  const closeCustomerModal = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
    setFormData(emptyForm);
  };

  const closeStatementModal = () => {
    setIsStatementOpen(false);
    setIsInvoiceDetailsOpen(false);
    setSelectedInvoice(null);
    setStatementData([]);
    setSelectedCustomer(null);
  };

  const closeInvoiceDetailsModal = () => {
    setIsInvoiceDetailsOpen(false);
    setSelectedInvoice(null);
  };

  useEffect(() => {
    fetchCustomers();
  }, [location.key]);

  useEffect(() => {
    const handleWindowFocus = () => {
      fetchCustomers();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, []);

  useEffect(() => {
    if (!isModalOpen && !isStatementOpen && !isInvoiceDetailsOpen && !showDeleteConfirm) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
        setSelectedCustomer(null);
        return;
      }

      if (isInvoiceDetailsOpen) return closeInvoiceDetailsModal();
      if (isStatementOpen) return closeStatementModal();
      if (isModalOpen) return closeCustomerModal();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInvoiceDetailsOpen, isModalOpen, isStatementOpen, showDeleteConfirm]);

  const fetchCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Ошибка при загрузке клиентов');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCustomer) return;
    const payload = {
      ...formData,
      name: formData.name.trim(),
      customerCategory: formData.customerCategory.trim(),
      companyName: formData.companyName.trim(),
      contactName: formData.contactName.trim(),
      phone: formData.phone.trim(),
      country: formData.country.trim() || 'Таджикистан',
      region: formData.region.trim(),
      city: formData.city.trim(),
      address: formData.address.trim(),
      notes: formData.notes.trim(),
    };

    const resolvedName = payload.customerType === 'company'
      ? payload.companyName || payload.contactName || payload.name
      : payload.contactName || payload.name;

    if (!resolvedName) {
      toast.error('Введите название клиента');
      return;
    }

    try {
      setIsSavingCustomer(true);
      if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, payload);
        toast.success('Клиент обновлен');
      } else {
        await createCustomer(payload);
        toast.success('Клиент добавлен');
      }

      closeCustomerModal();
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при сохранении');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedCustomer) return;

    try {
      await deleteCustomer(selectedCustomer.id);
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
    setStatementFilter('all');
    setStatementSearch('');

    try {
      const res = await client.get(`/customers/${customer.id}/history`);
      setStatementData(Array.isArray(res.data) ? res.data : []);
      setIsStatementOpen(true);
    } catch {
      toast.error('Ошибка при загрузке истории клиента');
    }
  };

  const openInvoiceDetails = async (invoice: StatementInvoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDetailsOpen(true);
    try {
      const res = await client.get(`/invoices/${invoice.id}`);
      if (res.data) {
        setSelectedInvoice((prev) => {
          if (!prev || prev.id !== invoice.id) return prev;
          return {
            ...prev,
            ...res.data,
            invoiceBalance: prev.invoiceBalance ?? (Number(res.data.netAmount || 0) - Number(res.data.paidAmount || 0)),
            paymentEvents: prev.paymentEvents?.length ? prev.paymentEvents : (res.data.payments || []).map((p: any) => ({
              id: p.id,
              amount: p.amount,
              method: p.method,
              createdAt: p.createdAt,
              staff_name: p.user?.username || '—',
            })),
            returnEvents: prev.returnEvents?.length ? prev.returnEvents : (res.data.returns || []).map((r: any) => ({
              id: r.id,
              totalValue: r.totalValue,
              reason: r.reason,
              createdAt: r.createdAt,
              staff_name: r.user?.username || '—',
            })),
          };
        });
      }
    } catch {
      // ignore
    }
  };

  const handlePrintInvoiceDirect = async (invoice: StatementInvoice) => {
    try {
      const res = await client.get(`/invoices/${invoice.id}`);
      const fullInvoice = res.data;
      const statusLabel = fullInvoice?.cancelled
        ? 'Отменена'
        : fullInvoice?.status === 'paid'
          ? 'Оплачено'
          : Number(fullInvoice?.paidAmount || 0) > PAYMENT_EPSILON
            ? 'Частично оплачено'
            : 'Не оплачено';

      const { printSalesInvoice } = await import('../utils/print/salesInvoicePrint');
      const result = printSalesInvoice({
        invoice: fullInvoice,
        statusLabel,
        subtotal: getInvoiceSubtotal(fullInvoice),
        discountAmount: getInvoiceDiscountAmount(fullInvoice),
        netAmount: getInvoiceNetAmount(fullInvoice),
        appliedPaidAmount: getInvoiceAppliedPaidAmount(fullInvoice),
        changeAmount: getInvoiceChangeAmount(fullInvoice),
        balanceAmount: fullInvoice.invoiceBalance || 0,
      });

      if (!result.ok && result.reason === 'blocked') {
        toast.error('Разрешите всплывающие окна для печати накладной');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || '?????? ??? ?????????? ??????');
    }
  };

  const handlePrintInvoice = async (invoice: StatementInvoice) => {
    if (!selectedCustomer) {
      return;
    }

    const { printCustomerInvoice } = await import('../utils/print/customerInvoicePrint');
    const result = printCustomerInvoice({
      invoice,
      customer: selectedCustomer,
      statusLabel: invoice.status === 'paid' ? 'Оплачено' : invoice.invoiceBalance > PAYMENT_EPSILON ? 'Есть долг' : 'Закрыто',
      subtotal: getInvoiceSubtotal(invoice),
      discountAmount: getInvoiceDiscountAmount(invoice),
      netAmount: getInvoiceNetAmount(invoice),
      appliedPaidAmount: getInvoiceAppliedPaidAmount(invoice),
      changeAmount: getInvoiceChangeAmount(invoice),
    });

    if (!result.ok && result.reason === 'blocked') {
      toast.error('Разрешите всплывающие окна для печати накладной');
    }
  };

  const buildReconciliationCustomer = (customer: Customer, invoices: StatementInvoice[]) => ({
    id: customer.id,
    name: customer.name || 'Без имени',
    phone: customer.phone || undefined,
    purchasedTotal: Number(customer.total_invoiced || 0),
    paidTotal: Number(customer.total_paid || 0),
    debtTotal: Math.max(0, Number(customer.balance || 0)),
    statusLabel:
      Number(customer.balance || 0) > PAYMENT_EPSILON
        ? 'Есть долг'
        : Number(customer.total_invoiced || 0) > PAYMENT_EPSILON
          ? 'Оплачено'
          : 'Нет операций',
    invoices,
  });

  const handlePrintCustomerReconciliation = async (customer: Customer, invoices?: StatementInvoice[]) => {
    try {
      const customerInvoices =
        invoices ||
        (await client.get(`/customers/${customer.id}/history`)).data;
      const normalizedInvoices = Array.isArray(customerInvoices) ? customerInvoices : [];

      if (normalizedInvoices.length === 0 && Number(customer.total_invoiced || 0) <= PAYMENT_EPSILON) {
        toast.error('У клиента пока нет накладных для акта сверки');
        return;
      }

      const { printCustomerReconciliationBatch } = await import('../utils/print/customerInvoicePrint');
      const result = printCustomerReconciliationBatch({
        customers: [buildReconciliationCustomer(customer, normalizedInvoices)],
        filterLabel: `Детальный акт: ${customer.name || 'Клиент'}`,
        sortLabel: 'Один клиент',
      });

      if (!result.ok) {
        toast.error('Не удалось подготовить акт сверки');
      }
    } catch {
      toast.error('Не удалось подготовить акт сверки');
    }
  };

  const handlePrintAllReconciliation = async () => {
    if (customers.length === 0) {
      toast.error('Список клиентов пуст');
      return;
    }

    setIsPrintingReconciliation(true);

    try {
      const customersWithHistory = await Promise.all(
        customers.map(async (customer) => {
          const res = await client.get(`/customers/${customer.id}/history`);
          const invoices = Array.isArray(res.data) ? res.data : [];
          return buildReconciliationCustomer(customer, invoices);
        }),
      );

      const printableCustomers = customersWithHistory.filter(
        (customer) =>
          customer.invoices.length > 0 ||
          Number(customer.purchasedTotal || 0) > PAYMENT_EPSILON ||
          Number(customer.debtTotal || 0) > PAYMENT_EPSILON,
      );

      if (printableCustomers.length === 0) {
        toast.error('Нет клиентов с накладными для акта сверки');
        return;
      }

      const { printCustomerReconciliationBatch } = await import('../utils/print/customerInvoicePrint');
      const result = printCustomerReconciliationBatch({
        customers: printableCustomers,
        filterLabel: 'Все клиенты',
        sortLabel: 'Без фильтра страницы',
        includeCustomerDetails: false,
      });

      if (!result.ok) {
        toast.error('Не удалось подготовить акт сверки');
      }
    } catch {
      toast.error('Не удалось подготовить акт сверки');
    } finally {
      setIsPrintingReconciliation(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, segmentFilter, sortBy]);

  const openEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      customerType: customer.customerType || 'individual',
      name: customer.name || '',
      customerCategory: customer.customerCategory || '',
      companyName: customer.companyName || '',
      contactName: customer.contactName || '',
      phone: customer.phone || '',
      country: customer.country || 'Таджикистан',
      region: customer.region || '',
      city: customer.city || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setIsModalOpen(true);
  };

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-4 lg:space-y-5">
        {/* Top Header for Desktop */}
        <div className="hidden lg:flex lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Клиенты</h1>
            <p className="mt-0.5 text-xs text-slate-500">База клиентов, детальные акты сверки и истории продаж по накладным.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrintAllReconciliation}
              disabled={isPrintingReconciliation || customers.length === 0}
              className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Printer size={15} />
              <span>{isPrintingReconciliation ? 'Подготовка...' : 'Общий акт сверки'}</span>
            </button>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setFormData(emptyForm);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus size={15} />
              <span>Новый клиент</span>
            </button>
          </div>
        </div>

        {/* Mobile Header Bar: Tabs + Quick Actions */}
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white p-1 shadow-xs">
            <NavLink to="/customers" end className={sectionTabClassName}>
              Клиенты
            </NavLink>
            <NavLink to="/customers/debts" className={sectionTabClassName}>
              Долги
            </NavLink>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrintAllReconciliation}
              disabled={isPrintingReconciliation || customers.length === 0}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50"
              title="Общий акт сверки"
            >
              <Printer size={14} />
            </button>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setFormData(emptyForm);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus size={14} />
              <span>Новый</span>
            </button>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden lg:flex items-center gap-1 rounded-full border border-slate-200/70 bg-white p-1.5 w-fit shadow-xs">
          <NavLink to="/customers" end className={sectionTabClassName}>
            База клиентов
          </NavLink>
          <NavLink to="/customers/debts" className={sectionTabClassName}>
            Долги и оплаты
          </NavLink>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="rounded-2xl lg:rounded-[28px] border border-slate-200/70 bg-white p-2.5 sm:p-4 shadow-xs space-y-2 sm:space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3 sm:gap-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder={customers.length > 0 ? `Поиск среди ${customers.length} клиентов...` : 'Поиск по имени или телефону...'}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-200/70 bg-[#f4f5fb] py-2 sm:py-2.5 pl-10 pr-8 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Очистить"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 md:col-span-2">
              <select
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              >
                <option value="all">Все категории</option>
                <option value="VIP">VIP</option>
                <option value="Постоянный">Постоянный</option>
                <option value="Обычный">Обычный</option>
                <option value="Новый">Новый</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              >
                <option value="strength">Сильные сверху</option>
                <option value="invoices">По накладным</option>
                {isAdmin && <option value="amount">По покупкам</option>}
                {isAdmin && <option value="balance">По долгу</option>}
                <option value="lastPurchase">По последней</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customer Cards Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedCustomers.map((customer) => (
            <motion.div layout key={customer.id} className="h-full">
              <div className="flex h-full flex-col justify-between rounded-2xl sm:rounded-[28px] border border-slate-200/80 bg-white p-3.5 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div>
                  {/* Top Row: Avatar + Name + Badges + Edit/Delete */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-sky-50 text-sky-600 font-bold text-xs sm:text-base">
                      {(customer.name || 'К').slice(0, 1).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className="truncate text-xs sm:text-base font-bold text-slate-900 leading-snug">
                          {customer.name}
                        </h3>
                        <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-0.5">
                          <button
                            type="button"
                            onClick={() => openEditCustomer(customer)}
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            title="Редактировать"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setShowDeleteConfirm(true);
                            }}
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            title="Удалить"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        {customer.customerCategory && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                            {customer.customerCategory}
                          </span>
                        )}
                        <span className={`inline-flex rounded px-1.5 py-0.2 text-[10px] font-semibold ${segmentTone[customer.customer_segment || ''] || 'bg-slate-100 text-slate-600'}`}>
                          {customer.customer_segment || 'Новый'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Phone and Address */}
                  {(customer.phone || customer.address) && (
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      {customer.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400 shrink-0" />
                          <a href={`tel:${customer.phone}`} className="truncate hover:text-slate-900 hover:underline">
                            {customer.phone}
                          </a>
                        </div>
                      )}
                      {customer.address && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate text-slate-400">{customer.address}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Financial Stats Box */}
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-xl sm:rounded-2xl border border-slate-100 bg-[#f8f9fc] p-2 sm:p-3 text-center">
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Покупки</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 truncate">{formatMoneyByRole(customer.total_invoiced, true)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Оплачено</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-emerald-600 truncate">{formatMoneyByRole(customer.total_paid, true)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Долг</p>
                      <p className={`mt-0.5 text-xs sm:text-sm font-bold truncate ${isAdmin && customer.balance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatMoneyByRole(customer.balance, true)}</p>
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openStatement(customer)}
                    className="flex items-center justify-center gap-1.5 rounded-xl sm:rounded-full bg-slate-900 py-1.5 sm:py-2 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 active:scale-[0.99]"
                  >
                    <FileText size={13} />
                    <span>Накладные</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintCustomerReconciliation(customer)}
                    className="hidden md:flex items-center justify-center gap-1.5 rounded-xl sm:rounded-full border border-slate-200/80 bg-white py-1.5 sm:py-2 px-3 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 active:scale-[0.99]"
                  >
                    <Printer size={13} />
                    <span>Акт сверки</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedCustomers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />

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
            <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeCustomerModal}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative flex max-h-[92vh] sm:max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl border border-slate-200/90"
              >
                {/* Compact Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-[#f8f9fc] px-4 py-2.5 sm:px-5 sm:py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-2xs shrink-0">
                      <User size={15} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {selectedCustomer ? 'Редактировать клиента' : 'Новый клиент'}
                      </h3>
                      <p className="hidden sm:block text-[11px] text-slate-400 truncate">Контактные данные и реквизиты</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeCustomerModal}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
                  <div className="space-y-2.5 overflow-y-auto p-3.5 sm:p-4">
                    {/* Compact Segmented Control */}
                    <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100/90 text-xs font-semibold gap-1">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, customerType: 'individual', companyName: '' })}
                        className={clsx(
                          'rounded-lg py-1.5 px-3 transition-all text-xs font-semibold',
                          formData.customerType === 'individual'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        )}
                      >
                        Частное лицо
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, customerType: 'company' })}
                        className={clsx(
                          'rounded-lg py-1.5 px-3 transition-all text-xs font-semibold',
                          formData.customerType === 'company'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        )}
                      >
                        Компания
                      </button>
                    </div>

                    {formData.customerType === 'company' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">Название компании *</label>
                        <input
                          required
                          className="w-full rounded-xl border border-slate-200/90 bg-[#f8f9fb] px-3 py-1.5 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value, name: e.target.value })}
                          placeholder="ООО «Пример»"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">
                        {formData.customerType === 'company' ? 'Контактное лицо' : 'Имя клиента *'}
                      </label>
                      <input
                        required={formData.customerType !== 'company'}
                        className="w-full rounded-xl border border-slate-200/90 bg-[#f8f9fb] px-3 py-1.5 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                        value={formData.customerType === 'company' ? formData.contactName : formData.name}
                        onChange={(e) =>
                          setFormData(
                            formData.customerType === 'company'
                              ? { ...formData, contactName: e.target.value }
                              : { ...formData, name: e.target.value, contactName: e.target.value },
                          )
                        }
                        placeholder={formData.customerType === 'company' ? 'ФИО представителя' : 'ФИО клиента'}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">Телефон</label>
                        <input
                          className="w-full rounded-xl border border-slate-200/90 bg-[#f8f9fb] px-3 py-1.5 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+992..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">Категория</label>
                        <input
                          list="customer-category-options"
                          className="w-full rounded-xl border border-slate-200/90 bg-[#f8f9fb] px-3 py-1.5 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                          value={formData.customerCategory}
                          onChange={(e) => setFormData({ ...formData, customerCategory: e.target.value })}
                          placeholder="VIP, Оптовик..."
                        />
                        <datalist id="customer-category-options">
                          {customerCategories.map((category) => (
                            <option key={category} value={category} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">Город</label>
                        <input
                          className="w-full rounded-xl border border-slate-200/90 bg-[#f8f9fb] px-3 py-1.5 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="Душанбе..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">Регион</label>
                        <input
                          className="w-full rounded-xl border border-slate-200/90 bg-[#f8f9fb] px-3 py-1.5 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                          placeholder="РРП..."
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">Адрес</label>
                      <input
                        className="w-full rounded-xl border border-slate-200/90 bg-[#f8f9fb] px-3 py-1.5 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Улица, дом, ориентир..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">Заметки</label>
                      <textarea
                        rows={2}
                        className="w-full rounded-xl border border-slate-200/90 bg-[#f8f9fb] px-3 py-1.5 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white resize-none"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Дополнительная информация о клиенте..."
                      />
                    </div>
                  </div>

                  {/* Compact Modal Footer */}
                  <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 sm:px-5 sm:py-3">
                    <button
                      type="button"
                      onClick={closeCustomerModal}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 active:scale-[0.99]"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCustomer}
                      className="flex-1 rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
                    >
                      {isSavingCustomer ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isStatementOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeStatementModal}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
              />
              <motion.div
                initial={{ y: '100%', opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0.5 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="relative flex h-[92vh] sm:h-auto sm:max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200/90 bg-white shadow-2xl"
              >
                {/* Mobile grab handle */}
                <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 sm:hidden" />

                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Receipt size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                        {selectedCustomer.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Накладные ({statementData.length})</span>
                        {selectedCustomer.phone && (
                          <>
                            <span>•</span>
                            <a href={`tel:${selectedCustomer.phone}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
                              <Phone size={11} />
                              <span>{selectedCustomer.phone}</span>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePrintCustomerReconciliation(selectedCustomer, statementData)}
                      className="hidden md:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                      title="Печать акта сверки"
                    >
                      <Printer size={14} />
                      <span>Акт сверки</span>
                    </button>
                    <button
                      type="button"
                      onClick={closeStatementModal}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-95"
                      title="Закрыть"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Financial Summary Strip */}
                <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-6 sm:py-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 text-center shadow-xs">
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Сумма накладных</p>
                      <p className="mt-0.5 font-mono text-xs sm:text-base font-bold tabular-nums text-slate-900 truncate">
                        {formatMoneyByRole(selectedCustomer.total_invoiced)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 text-center shadow-xs">
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Всего оплачено</p>
                      <p className="mt-0.5 font-mono text-xs sm:text-base font-bold tabular-nums text-emerald-600 truncate">
                        {formatMoneyByRole(selectedCustomer.total_paid)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 text-center shadow-xs">
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Текущий долг</p>
                      <p className={clsx(
                        'mt-0.5 font-mono text-xs sm:text-base font-bold tabular-nums truncate',
                        Number(selectedCustomer.balance || 0) > PAYMENT_EPSILON ? 'text-rose-600' : 'text-slate-700'
                      )}>
                        {formatMoneyByRole(selectedCustomer.balance)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2 sm:px-6">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setStatementFilter('all')}
                      className={clsx(
                        'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                        statementFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      Все ({statementData.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatementFilter('unpaid')}
                      className={clsx(
                        'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                        statementFilter === 'unpaid'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                      )}
                    >
                      <span>С долгом</span>
                      <span>({unpaidStatementCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatementFilter('paid')}
                      className={clsx(
                        'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                        statementFilter === 'paid'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                      )}
                    >
                      <span>Оплачено</span>
                      <span>({paidStatementCount})</span>
                    </button>
                  </div>

                  {statementData.length > 3 && (
                    <div className="relative min-w-[140px] sm:w-56">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={statementSearch}
                        onChange={(e) => setStatementSearch(e.target.value)}
                        placeholder="Поиск по № или дате..."
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* Invoices List */}
                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/40 p-3.5 sm:p-6">
                  {filteredStatementInvoices.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs font-medium text-slate-500">
                      {statementData.length === 0
                        ? 'У клиента пока нет накладных.'
                        : 'Нет накладных, соответствующих выбранному фильтру.'}
                    </div>
                  ) : (
                    filteredStatementInvoices.map((invoice) => {
                      const balance = Number(invoice.invoiceBalance ?? 0);
                      const netAmount = Number(invoice.netAmount ?? 0);
                      const paid = Math.max(0, netAmount - balance);
                      const paymentsCount = invoice.paymentEvents?.length || 0;
                      const returnsCount = invoice.returnEvents?.length || 0;

                      return (
                        <div
                          key={invoice.id}
                          onClick={() => openInvoiceDetails(invoice)}
                          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs hover:border-slate-300 hover:shadow-md transition-all active:scale-[0.99]"
                        >
                          {/* Top Row: Number & Status */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs sm:text-sm font-bold text-slate-900">
                                Накладная #{invoice.id}
                              </span>
                              {getCustomerInvoiceBadge(invoice)}
                            </div>
                            <span className="font-mono text-[11px] text-slate-400">
                              {new Date(invoice.createdAt).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* 3-Column Financial Strip */}
                          <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-center">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Сумма</p>
                              <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-slate-900">
                                {formatMoneyByRole(netAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Оплачено</p>
                              <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-emerald-600">
                                {formatMoneyByRole(paid)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Остаток</p>
                              <p className={clsx(
                                'mt-0.5 font-mono text-xs font-bold tabular-nums',
                                balance > PAYMENT_EPSILON ? 'text-rose-600' : 'text-slate-400'
                              )}>
                                {formatMoneyByRole(balance)}
                              </p>
                            </div>
                          </div>

                          {/* Bottom Row: Metadata & Actions */}
                          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 min-w-0">
                              {invoice.warehouse?.name && (
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 truncate max-w-[140px]">
                                  {invoice.warehouse.name}
                                </span>
                              )}
                              {paymentsCount > 0 && (
                                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  Оплат: {paymentsCount}
                                </span>
                              )}
                              {returnsCount > 0 && (
                                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  Возвратов: {returnsCount}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openInvoiceDetails(invoice)}
                                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-slate-800 active:scale-95"
                              >
                                <Eye size={13} />
                                <span>Посмотреть</span>
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  const { shareInvoicePdf } = await import('../utils/print/salesInvoicePdf');
                                  await shareInvoicePdf(invoice);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-95"
                                title="Поделиться PDF"
                              >
                                <Share2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePrintInvoiceDirect(invoice)}
                                className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-95"
                                title="Печать"
                              >
                                <Printer size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isInvoiceDetailsOpen && selectedInvoice && (
            <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeInvoiceDetailsModal}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
              />
              <motion.div
                initial={{ y: '100%', opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0.5 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="relative flex h-[92vh] sm:h-auto sm:max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200/90 bg-white shadow-2xl"
              >
                {/* Mobile grab handle */}
                <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 sm:hidden" />

                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                      <Receipt size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          Накладная #{selectedInvoice.id}
                        </h3>
                        <div className="shrink-0 scale-90 sm:scale-100 origin-left">
                          {getCustomerInvoiceBadge(selectedInvoice)}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {new Date(selectedInvoice.createdAt).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePrintInvoiceDirect(selectedInvoice)}
                      className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                      title="Печать"
                    >
                      <Printer size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const { shareInvoicePdf } = await import('../utils/print/salesInvoicePdf');
                        await shareInvoicePdf(selectedInvoice);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                      title="Поделиться (PDF)"
                    >
                      <Share2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={closeInvoiceDetailsModal}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                      title="Закрыть"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 space-y-3.5 overflow-y-auto bg-white p-3.5 sm:p-5">
                  {/* Requisites Card */}
                  <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-3">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Клиент</span>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {selectedInvoice.customer_name || selectedCustomer?.name || 'Обычный клиент'}
                        </p>
                        {(selectedInvoice.customer_phone || selectedCustomer?.phone) && (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {selectedInvoice.customer_phone || selectedCustomer?.phone}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 sm:border-l sm:border-slate-200 sm:pl-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Склад</span>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {selectedInvoice.warehouse?.name || '---'}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500 truncate">
                          {selectedInvoice.warehouse?.address || 'Без адреса'}
                        </p>
                      </div>

                      <div className="min-w-0 sm:border-l sm:border-slate-200 sm:pl-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Сотрудник</span>
                        <p className="text-xs font-semibold text-slate-800">
                          {selectedInvoice.staff_name || selectedInvoice.user?.username || 'admin'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Товары в накладной ({selectedInvoice.items?.length || 0})
                      </h4>
                    </div>

                    {/* Mobile Items Cards */}
                    <div className="space-y-2 md:hidden">
                      {selectedInvoice.items?.map((item: any, idx: number) => {
                        const quantityInfo = getInvoiceItemQuantityParts(item);
                        const lineTotal = Number(item.totalPrice) || (Number(item.quantity || 0) * Number(item.sellingPrice || 0));
                        const returnedQty = Number(item.returnedQty || 0);

                        return (
                          <div key={item.id || idx} className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-[10px] font-bold text-slate-500">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-900 leading-snug">
                                  {formatProductName(item.product_name || item.product?.name)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                              <div className="rounded-lg bg-slate-50 p-2 text-center">
                                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Кол-во</p>
                                <p className="mt-0.5 font-bold text-slate-800 text-xs">{quantityInfo.primary}</p>
                                {quantityInfo.secondary && (
                                  <p className="mt-0.5 text-[9px] text-slate-400">{quantityInfo.secondary}</p>
                                )}
                              </div>
                              <div className="rounded-lg bg-slate-50 p-2 text-center">
                                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Цена</p>
                                <p className="mt-0.5 font-bold text-slate-900 text-xs">{formatMoney(item.sellingPrice)}</p>
                              </div>
                              <div className="rounded-lg bg-slate-100/80 p-2 text-center">
                                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Итого</p>
                                <p className="mt-0.5 font-bold text-slate-900 text-xs">{formatMoney(lineTotal)}</p>
                              </div>
                            </div>

                            {returnedQty > PAYMENT_EPSILON && (
                              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-800">
                                Возвращено: {formatCount(returnedQty)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Items Table */}
                    <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full border-collapse text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="px-3 py-2 w-10">№</th>
                            <th className="px-3 py-2">Товар</th>
                            <th className="px-3 py-2">Кол-во</th>
                            <th className="px-3 py-2">Цена</th>
                            <th className="px-3 py-2 text-right">Итого</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedInvoice.items?.map((item: any, idx: number) => {
                            const quantityInfo = getInvoiceItemQuantityParts(item);
                            const lineTotal = Number(item.totalPrice) || (Number(item.quantity || 0) * Number(item.sellingPrice || 0));
                            const returnedQty = Number(item.returnedQty || 0);

                            return (
                              <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-3 py-2 font-mono text-slate-400">{idx + 1}</td>
                                <td className="px-3 py-2">
                                  <p className="font-semibold text-slate-900">{formatProductName(item.product_name || item.product?.name)}</p>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                                  <p className="whitespace-nowrap text-[11px] font-semibold text-slate-700">{quantityInfo.primary}</p>
                                  {quantityInfo.secondary && (
                                    <p className="mt-0.5 whitespace-nowrap text-[9px] text-slate-400">{quantityInfo.secondary}</p>
                                  )}
                                  {returnedQty > PAYMENT_EPSILON && (
                                    <span className="mt-1 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                                      Возвращено: {formatCount(returnedQty)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-700">{formatMoney(item.sellingPrice)}</td>
                                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatMoney(lineTotal)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="flex justify-end">
                    <div className="w-full max-w-sm space-y-1.5 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 text-xs">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Сумма без скидки</span>
                        <span className="font-medium text-slate-900">{formatMoneyByRole(selectedInvoice.totalAmount || selectedInvoice.netAmount)}</span>
                      </div>

                      {Number(selectedInvoice.discount || 0) > 0 && (
                        <div className="flex items-center justify-between text-rose-600">
                          <span>Скидка ({selectedInvoice.discount}%)</span>
                          <span className="font-medium">-{formatMoneyByRole(getInvoiceDiscountAmount(selectedInvoice))}</span>
                        </div>
                      )}

                      {Number(selectedInvoice.returnedAmount || 0) > 0 && (
                        <div className="flex items-center justify-between text-amber-700">
                          <span>Возврат</span>
                          <span className="font-semibold">-{formatMoneyByRole(selectedInvoice.returnedAmount)}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-xs font-bold text-slate-900">
                        <span>ИТОГО К ОПЛАТЕ</span>
                        <span className="font-mono text-sm font-bold text-slate-900">{formatMoneyByRole(selectedInvoice.netAmount)}</span>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-slate-500">
                        <span>Оплачено</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {formatMoneyByRole(getInvoiceAppliedPaidAmount(selectedInvoice))}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-500">
                        <span>Остаток долга</span>
                        <span className={clsx(
                          'font-mono font-bold',
                          Number(selectedInvoice.invoiceBalance || 0) > PAYMENT_EPSILON ? 'text-rose-600' : 'text-slate-400'
                        )}>
                          {formatMoneyByRole(selectedInvoice.invoiceBalance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Events */}
                  {Boolean(selectedInvoice.paymentEvents?.length) && (
                    <div className="space-y-1.5 pt-1">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        История оплат ({selectedInvoice.paymentEvents!.length})
                      </h4>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                              <th className="px-3 py-1.5">Дата</th>
                              <th className="px-3 py-1.5">Сумма</th>
                              <th className="px-3 py-1.5">Сотрудник</th>
                              <th className="px-3 py-1.5 text-right">Способ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedInvoice.paymentEvents!.map((payment: any) => {
                              const isRefund = Number(payment.amount || 0) < 0;
                              return (
                                <tr key={payment.id}>
                                  <td className="px-3 py-1.5 text-slate-500 font-mono text-[10px]">
                                    {new Date(payment.createdAt).toLocaleString('ru-RU')}
                                  </td>
                                  <td className={`px-3 py-1.5 font-bold ${isRefund ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {isRefund ? '−' : ''}{formatMoneyByRole(Math.abs(Number(payment.amount || 0)))}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-600">{payment.staff_name}</td>
                                  <td className="px-3 py-1.5 text-right text-[10px] font-bold uppercase text-slate-500">
                                    {payment.method}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Return Events */}
                  {Boolean(selectedInvoice.returnEvents?.length) && (
                    <div className="space-y-1.5 pt-1">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                        История возвратов ({selectedInvoice.returnEvents!.length})
                      </h4>
                      <div className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50/40">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-amber-200 bg-amber-100/50 text-amber-800 font-semibold">
                              <th className="px-3 py-1.5">Дата</th>
                              <th className="px-3 py-1.5">Сумма</th>
                              <th className="px-3 py-1.5">Причина</th>
                              <th className="px-3 py-1.5 text-right">Сотрудник</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {selectedInvoice.returnEvents!.map((itemReturn: any) => (
                              <tr key={itemReturn.id}>
                                <td className="px-3 py-1.5 text-slate-500 font-mono text-[10px]">
                                  {new Date(itemReturn.createdAt).toLocaleString('ru-RU')}
                                </td>
                                <td className="px-3 py-1.5 font-bold text-rose-600">
                                  -{formatMoneyByRole(itemReturn.totalValue)}
                                </td>
                                <td className="px-3 py-1.5 text-slate-600">{formatTransactionReason(itemReturn.reason)}</td>
                                <td className="px-3 py-1.5 text-right text-slate-500">{itemReturn.staff_name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sticky Modal Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePrintInvoiceDirect(selectedInvoice)}
                      className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      <Printer size={14} />
                      <span>Печать</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const { shareInvoicePdf } = await import('../utils/print/salesInvoicePdf');
                        await shareInvoicePdf(selectedInvoice);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      <Share2 size={14} />
                      <span>Поделиться (PDF)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={closeInvoiceDetailsModal}
                    className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
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
