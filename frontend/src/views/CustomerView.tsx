import React, { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, Phone, MapPin, X, User, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Card, Badge } from '../components/UI';
import client from '../api/client';
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../api/customers.api';
import { formatCount, formatMoney } from '../utils/format';
import ConfirmationModal from '../components/common/ConfirmationModal';
import PaginationControls from '../components/common/PaginationControls';
import { useMemo } from 'react';
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
  const [formData, setFormData] = useState(emptyForm);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPrintingReconciliation, setIsPrintingReconciliation] = useState(false);
  const PAYMENT_EPSILON = CUSTOMER_PAYMENT_EPSILON;
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

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-5 rounded-[28px] bg-[#f4f5fb] p-5 min-h-screen">
        {/* Top Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Клиенты</h1>
            <p className="mt-0.5 text-xs text-slate-500">База клиентов, детальные акты сверки и истории продаж по накладным.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-1 rounded-full border border-slate-200/70 bg-white p-1.5 w-fit shadow-xs">
          <NavLink to="/customers" end className={sectionTabClassName}>
            База клиентов
          </NavLink>
          <NavLink to="/customers/debts" className={sectionTabClassName}>
            Долги и оплаты
          </NavLink>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Поиск по имени или телефону..."
                className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] py-2.5 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
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
              className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
            >
              <option value="strength">Сильные сверху</option>
              <option value="invoices">По числу накладных</option>
              {isAdmin && <option value="amount">По сумме покупок</option>}
              {isAdmin && <option value="balance">По долгу</option>}
              <option value="lastPurchase">По последней покупке</option>
            </select>
          </div>
        </div>

        {/* Customer Cards Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedCustomers.map((customer) => (
            <motion.div layout key={customer.id} className="h-full">
              <div className="flex h-full flex-col justify-between rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div>
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 font-semibold">
                      <User size={22} strokeWidth={2} />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
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
                        }}
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Редактировать"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowDeleteConfirm(true);
                        }}
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        title="Удалить"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold tracking-tight text-slate-900 line-clamp-1">{customer.name}</h3>
                  
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {customer.customerCategory && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {customer.customerCategory}
                      </span>
                    )}
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${segmentTone[customer.customer_segment || ''] || 'bg-slate-100 text-slate-600'}`}>
                      {customer.customer_segment || 'Новый'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{customer.phone || 'Нет телефона'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{customer.address || 'Нет адреса'}</span>
                    </div>
                  </div>

                  {/* Financial Stats Box */}
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-[#f4f5fb] p-3 text-center">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Накладные</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-900">{formatMoneyByRole(customer.total_invoiced, true)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Оплачено</p>
                      <p className="mt-0.5 text-xs font-semibold text-emerald-600">{formatMoneyByRole(customer.total_paid, true)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Долг</p>
                      <p className={`mt-0.5 text-xs font-semibold ${isAdmin && customer.balance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatMoneyByRole(customer.balance, true)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openStatement(customer)}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
                  >
                    <FileText size={14} />
                    <span>Накладные</span>
                  </button>
                  <button
                    onClick={() => handlePrintCustomerReconciliation(customer)}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-slate-200/70 bg-white py-2 px-3 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
                  >
                    <Printer size={14} />
                    <span>Детальный акт</span>
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeCustomerModal}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white">
                      <User size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {selectedCustomer ? 'Редактировать клиента' : 'Новый клиент'}
                      </h3>
                      <p className="text-xs text-slate-500">Введите персональные и контактные данные клиента.</p>
                    </div>
                  </div>
                  <button onClick={closeCustomerModal} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
                  <div className="space-y-4 overflow-y-auto p-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Тип клиента</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, customerType: 'individual', companyName: '' })}
                          className={`rounded-full py-2.5 px-4 text-xs font-semibold transition-all ${formData.customerType === 'individual' ? 'bg-slate-900 text-white shadow-xs' : 'border border-slate-200/70 bg-[#f4f5fb] text-slate-700 hover:bg-slate-100'}`}
                        >
                          Частное лицо
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, customerType: 'company' })}
                          className={`rounded-full py-2.5 px-4 text-xs font-semibold transition-all ${formData.customerType === 'company' ? 'bg-slate-900 text-white shadow-xs' : 'border border-slate-200/70 bg-[#f4f5fb] text-slate-700 hover:bg-slate-100'}`}
                        >
                          Компания
                        </button>
                      </div>
                    </div>

                    {formData.customerType === 'company' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700">Название компании</label>
                        <input
                          required
                          className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value, name: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">
                        {formData.customerType === 'company' ? 'Контактное лицо' : 'Имя клиента'}
                      </label>
                      <input
                        required={formData.customerType !== 'company'}
                        className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                        value={formData.customerType === 'company' ? formData.contactName : formData.name}
                        onChange={(e) =>
                          setFormData(
                            formData.customerType === 'company'
                              ? { ...formData, contactName: e.target.value }
                              : { ...formData, name: e.target.value, contactName: e.target.value },
                          )
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700">Категория</label>
                        <input
                          list="customer-category-options"
                          className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
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

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700">Телефон</label>
                        <input
                          className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700">Регион</label>
                        <input
                          className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700">Город</label>
                        <input
                          className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Адрес</label>
                      <input
                        className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Заметки</label>
                      <textarea
                        rows={2}
                        className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <button
                      type="button"
                      onClick={closeCustomerModal}
                      className="flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-full bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
                    >
                      Сохранить
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isStatementOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeStatementModal}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-8 py-6">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-slate-900">{selectedCustomer.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">История и баланс строятся только по накладным.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handlePrintCustomerReconciliation(selectedCustomer, statementData)}
                      className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
                    >
                      <Printer size={15} />
                      <span>Детальный акт</span>
                    </button>
                    <button onClick={closeStatementModal} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Всего по накладным</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoneyByRole(selectedCustomer.total_invoiced)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Всего оплачено</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-600">{formatMoneyByRole(selectedCustomer.total_paid)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Текущий долг</p>
                      <p className="mt-1 text-lg font-semibold text-rose-600">{formatMoneyByRole(selectedCustomer.balance)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                  <div className="space-y-3">
                    {statementData.length === 0 && (
                      <div className="rounded-2xl bg-[#f4f5fb] p-8 text-center text-xs font-medium text-slate-500">
                        У клиента пока нет накладных.
                      </div>
                    )}

                    {statementData.map((invoice) => (
                      <div
                        key={invoice.id}
                        onClick={() => openInvoiceDetails(invoice)}
                        className="flex cursor-pointer flex-col gap-4 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] p-4 transition-all hover:bg-white hover:shadow-xs sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 font-semibold">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Накладная #{invoice.id}</p>
                            <p className="text-xs text-slate-400">
                              {new Date(invoice.createdAt).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Оплаты: {formatCount(invoice.paymentEvents?.length || 0)} · Возвраты: {formatCount(invoice.returnEvents?.length || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">{formatMoneyByRole(invoice.netAmount)}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">Остаток: {formatMoneyByRole(invoice.invoiceBalance)}</p>
                          </div>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handlePrintInvoiceDirect(invoice);
                            }}
                            className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                          >
                            <Printer size={14} />
                            <span>Печать</span>
                          </button>
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
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeInvoiceDetailsModal}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Накладная #{selectedInvoice.id}</h3>
                    <p className="text-xs text-slate-500">Детали накладной, списки товаров и оплат</p>
                  </div>
                  <button onClick={closeInvoiceDetailsModal} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-6">
                  <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:justify-between rounded-2xl bg-[#f4f5fb] p-3.5 border border-slate-100">
                    <span>Дата: {new Date(selectedInvoice.createdAt).toLocaleString('ru-RU')}</span>
                    <span>Склад: {selectedInvoice.warehouse?.name || '---'}</span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedInvoice.items?.map((item) => {
                      const quantityInfo = getInvoiceItemQuantityParts(item);

                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] p-3.5">
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{item.product?.name}</p>
                            <p className="text-xs font-medium text-slate-700">{quantityInfo.primary}</p>
                            {quantityInfo.secondary && (
                              <p className="text-[10px] text-slate-400">{quantityInfo.secondary}</p>
                            )}
                            <p className="text-[10px] text-slate-400">x {formatMoney(item.sellingPrice)}</p>
                            {Number(item.returnedQty || 0) > 0 && (
                              <p className="mt-0.5 text-[11px] font-medium text-amber-600">Возвращено: {formatCount(item.returnedQty || 0)}</p>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-900">{formatMoney(Number(item.quantity || 0) * Number(item.sellingPrice || 0))}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Сумма</span>
                      <span>{formatMoneyByRole(selectedInvoice.totalAmount)}</span>
                    </div>
                    {Number(selectedInvoice.discount || 0) > 0 && (
                      <div className="flex justify-between text-xs text-rose-500">
                        <span>Скидка ({selectedInvoice.discount}%)</span>
                        <span>-{formatMoneyByRole((Number(selectedInvoice.totalAmount || 0) * Number(selectedInvoice.discount || 0)) / 100)}</span>
                      </div>
                    )}
                    {Number(selectedInvoice.returnedAmount || 0) > 0 && (
                      <div className="flex justify-between text-xs text-amber-600">
                        <span>Возвраты</span>
                        <span>-{formatMoneyByRole(selectedInvoice.returnedAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200/60 pt-2 text-sm font-bold text-slate-900">
                      <span>Итого</span>
                      <span>{formatMoneyByRole(selectedInvoice.netAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                      <span>Оплачено</span>
                      <span>{formatMoneyByRole(getInvoiceAppliedPaidAmount(selectedInvoice))}</span>
                    </div>
                    <div className="flex justify-between text-xs text-rose-600 font-semibold">
                      <span>Остаток</span>
                      <span>{formatMoneyByRole(selectedInvoice.invoiceBalance)}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider text-slate-400">Оплаты по накладной</h4>
                    {selectedInvoice.paymentEvents?.length ? (
                      selectedInvoice.paymentEvents.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5">
                          <div>
                            <p className="text-xs font-semibold text-emerald-700">{formatMoneyByRole(payment.amount)}</p>
                            <p className="text-[11px] text-emerald-600">
                              {new Date(payment.createdAt).toLocaleString('ru-RU')} · {payment.staff_name}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">{payment.method}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">Оплат по этой накладной нет.</p>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider text-slate-400">Возвраты по накладной</h4>
                    {selectedInvoice.returnEvents?.length ? (
                      selectedInvoice.returnEvents.map((itemReturn) => (
                        <div key={itemReturn.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-2.5">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-xs font-semibold text-amber-700">{formatMoneyByRole(itemReturn.totalValue)}</p>
                            <p className="text-[11px] text-amber-600">{new Date(itemReturn.createdAt).toLocaleString('ru-RU')}</p>
                          </div>
                          <p className="mt-0.5 text-xs text-amber-700">{itemReturn.staff_name}</p>
                          {itemReturn.reason && <p className="mt-0.5 text-xs text-amber-600">{itemReturn.reason}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">Возвратов по этой накладной нет.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                  <button
                    onClick={() => handlePrintInvoiceDirect(selectedInvoice)}
                    className="flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-xs font-semibold text-indigo-700 shadow-xs transition-colors hover:bg-indigo-100"
                  >
                    <Printer size={15} />
                    <span>Печать</span>
                  </button>
                  <button
                    onClick={closeInvoiceDetailsModal}
                    className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
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
