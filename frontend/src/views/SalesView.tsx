import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { 
  Plus, 
  Search, 
  Receipt, 
  ChevronDown,
  ChevronRight, 
  Pencil,
  Trash2, 
  X,
  Banknote,
  User as UserIcon,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  Printer,
  Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { formatCount, formatMoney, toFixedNumber, ceilMoney } from '../utils/format';
import { formatProductName } from '../utils/productName';
import { getDefaultWarehouseId } from '../utils/warehouse';
import { getCustomers } from '../api/customers.api';
import { getWarehouses } from '../api/warehouses.api';
import SalesInvoicesSection from '../components/sales/SalesInvoicesSection';
import useSalesEditInvoice from '../components/sales/useSalesEditInvoice';
import useSalesInvoiceActions from '../components/sales/useSalesInvoiceActions';
import useSalesListData from '../components/sales/useSalesListData';
import useSalesPaymentActions from '../components/sales/useSalesPaymentActions';
import useSalesReturnActions from '../components/sales/useSalesReturnActions';
import type { EditProductOption, ReturnInvoiceItem } from '../components/sales/salesTypes';
import {
  SALES_PAYMENT_EPSILON,
  getEffectiveStatus,
  getInvoiceAppliedPaidAmount,
  getInvoiceBalance,
  getInvoiceChangeAmount,
  getInvoiceDiscountAmount,
  getInvoiceItemQuantityParts,
  getInvoiceItemReturnedQty,
  getInvoiceNetAmount,
  getInvoiceReturnedItems,
  getInvoiceSubtotal,
  getProductStockParts,
  getReturnItemDisplayName,
  getReturnItemPackaging,
  getReturnItemRemainingUnits,
  isPaymentActionDisabled,
  isReturnActionDisabled,
  normalizeDisplayBaseUnit,
} from '../utils/salesViewUtils';

export default function SalesView() {
  const PAYMENT_EPSILON = SALES_PAYMENT_EPSILON;
  const pageSize = 8;
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const hasLoadedCustomersRef = React.useRef(false);
  const hasLoadedWarehousesRef = React.useRef(false);
  const user = React.useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(user);
  const userWarehouseId = getUserWarehouseId(user);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(userWarehouseId ? String(userWarehouseId) : '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [selectedWarehouseId, isAdmin, userWarehouseId]);

  useEffect(() => {
    const incomingWarehouseId = location.state && typeof location.state === 'object'
      ? String((location.state as { warehouseId?: string | number | null }).warehouseId || '')
      : '';

    if (!incomingWarehouseId) {
      return;
    }

    setSelectedWarehouseId(incomingWarehouseId);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (hasLoadedWarehousesRef.current) {
      return;
    }

    hasLoadedWarehousesRef.current = true;
    fetchWarehouses();
  }, [isAdmin]);

  useEffect(() => {
    if (hasLoadedCustomersRef.current) {
      return;
    }

    hasLoadedCustomersRef.current = true;
    fetchCustomers();
  }, []);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const effectiveWarehouseId = !isAdmin && userWarehouseId ? String(userWarehouseId) : selectedWarehouseId;
      const query = effectiveWarehouseId ? `?warehouseId=${effectiveWarehouseId}` : '';
      const res = await client.get(`/invoices${query}`);
      setInvoices(Array.isArray(res.data) ? res.data.filter((invoice) => !invoice?.cancelled) : []);
    } catch (err) {
      toast.error('Ошибка при загрузке накладных');
    } finally {
      setIsLoading(false);
    }
  };

  const {
    showEditModal,
    editCustomerId,
    editDiscount,
    editInvoiceItems,
    editProducts,
    editInvoiceSearch,
    openEditProductMenuKey,
    editProductMenuSearch,
    isSavingEdit,
    isEditItemsDirty,
    filteredEditInvoiceItems,
    editInvoiceSubtotal,
    editInvoiceDiscountAmount,
    editInvoiceTaxAmount,
    editInvoiceNetAmount,
    setEditCustomerId,
    setEditDiscount,
    setEditInvoiceSearch,
    setOpenEditProductMenuKey,
    setEditProductMenuSearch,
    closeEditModal,
    canEditInvoice,
    getEditBlockedReason,
    getEditProductMeta,
    findEditProductBySearch,
    updateEditInvoiceItem,
    getEditItemPackaging,
    getEditItemDefaultBulkPackaging,
    getEditItemMaxAllowedQuantity,
    updateNormalizedEditInvoiceItem,
    selectEditProductForItem,
    addEditInvoiceItem,
    removeEditInvoiceItem,
    openEditInvoiceModal,
    handleUpdateInvoice,
  } = useSalesEditInvoice({
    selectedInvoice,
    setSelectedInvoice,
    setInvoices,
    isAdmin,
    user,
    fetchInvoices,
  });

  const fetchWarehouses = async () => {
    try {
      const data = await getWarehouses();
      const filteredWarehouses = filterWarehousesForUser(Array.isArray(data) ? data : [], user);
      setWarehouses(filteredWarehouses);
      const defaultWarehouseId = getDefaultWarehouseId(filteredWarehouses) || (filteredWarehouses.length === 1 ? Number(filteredWarehouses[0].id) : null);
      if (isAdmin && !selectedWarehouseId && defaultWarehouseId) {
        setSelectedWarehouseId(String(defaultWarehouseId));
      } else if (!isAdmin && filteredWarehouses[0]) {
        setSelectedWarehouseId(String(filteredWarehouses[0].id));
      }
    } catch (err) {
      hasLoadedWarehousesRef.current = false;
      console.error(err);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getStatusBadge = (status: string, cancelled: boolean) => {
    if (cancelled) {
      return (
        <span
          title="Отменена"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500 shadow-xs"
        >
          <Ban size={15} />
        </span>
      );
    }
    switch (status) {
      case 'paid':
        return (
          <span
            title="Оплачено"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-xs"
          >
            <CheckCircle2 size={15} />
          </span>
        );
      case 'partial':
        return (
          <span
            title="Частично оплачено"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-200/80 bg-amber-50 text-amber-600 shadow-xs"
          >
            <Clock size={15} />
          </span>
        );
      default:
        return (
          <span
            title="Не оплачено"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200/80 bg-rose-50 text-rose-500 shadow-xs"
          >
            <AlertCircle size={15} />
          </span>
        );
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const applyInvoiceToHistory = (updatedInvoice: any) => {
    if (!updatedInvoice?.id) {
      return;
    }

    setInvoices((current) =>
      current.map((invoice) =>
        Number(invoice.id) === Number(updatedInvoice.id)
          ? {
              ...invoice,
              ...updatedInvoice,
              customer_name: updatedInvoice.customer_name || updatedInvoice.customer?.name || invoice.customer_name,
              staff_name: updatedInvoice.staff_name || updatedInvoice.user?.username || invoice.staff_name,
              items: Array.isArray(updatedInvoice.items) ? updatedInvoice.items : invoice.items,
              totalAmount: updatedInvoice.totalAmount,
              netAmount: updatedInvoice.netAmount,
              paidAmount: updatedInvoice.paidAmount,
              returnedAmount: updatedInvoice.returnedAmount,
              discount: updatedInvoice.discount,
              tax: updatedInvoice.tax,
              status: updatedInvoice.status,
              cancelled: Boolean(updatedInvoice.cancelled),
            }
          : invoice,
      ),
    );
  };

  const refreshSelectedInvoice = async (invoiceId: number) => {
    try {
      const res = await client.get(`/invoices/${invoiceId}`);
      setSelectedInvoice(res.data);
      applyInvoiceToHistory(res.data);
      return res.data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const {
    showPaymentModal,
    setShowPaymentModal,
    paymentAmount,
    setPaymentAmount,
    isPaying,
    cancellingPaymentId,
    closePaymentModal,
    handlePayment,
    handleCancelPayment,
  } = useSalesPaymentActions({
    selectedInvoice,
    refreshSelectedInvoice,
    fetchInvoices,
  });

  const {
    showReturnModal,
    returnReason,
    returnItems,
    isReturning,
    setReturnReason,
    setReturnItems,
    closeReturnModal,
    openReturnInvoiceModal,
    handleReturn,
  } = useSalesReturnActions({
    selectedInvoice,
    setSelectedInvoice,
    refreshSelectedInvoice,
    fetchInvoices,
  });

  const {
    fetchInvoiceDetails,
    handleDeleteInvoice,
    handlePrintInvoice,
    handleQuickPrintInvoice,
  } = useSalesInvoiceActions({
    selectedInvoice,
    setSelectedInvoice,
    setShowDetailsModal,
    closeDetailsModal,
    closeEditModal,
    closePaymentModal,
    closeReturnModal,
    fetchInvoices,
  });

  useEffect(() => {
    if (!showDetailsModal && !showPaymentModal && !showReturnModal && !showEditModal) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (showPaymentModal) return closePaymentModal();
      if (showReturnModal) return closeReturnModal();
      if (showEditModal) return closeEditModal();
      if (showDetailsModal) return closeDetailsModal();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDetailsModal, showEditModal, showPaymentModal, showReturnModal]);

  const {
    sortedInvoices,
    totalPages,
    paginatedInvoices,
    staffOptions,
  } = useSalesListData({
    invoices,
    search,
    statusFilter,
    staffFilter,
    dateFrom,
    dateTo,
    sortConfig,
    isAdmin,
    userWarehouseId,
    currentPage,
    pageSize,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedWarehouseId, sortConfig.key, sortConfig.direction, statusFilter, staffFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const clearInvoiceFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setStaffFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-5 overflow-hidden rounded-[28px] bg-[#f4f5fb] p-5 min-h-screen">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Продажи</h1>
            <p className="mt-0.5 text-xs text-slate-500">Управление накладными и заказами клиентов.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-full bg-white px-4 py-1.5 border border-slate-200/60 shadow-xs">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {(user.username || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-slate-900">{user.username || 'Admin'}</p>
                <p className="text-[10px] text-slate-400">{user.role || 'ADMIN'}</p>
              </div>
            </div>

            {isAdmin && (
              <>
                {warehouses.length > 1 && (
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    disabled={!isAdmin}
                    className="min-w-44 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 outline-none shadow-xs transition-colors focus:border-slate-300"
                  >
                    <option value="">Все склады</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => navigate('/pos')}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
                >
                  <Plus size={16} />
                  <span>Новая продажа</span>
                </button>
              </>
            )}
          </div>
        </div>

      <SalesInvoicesSection
        isAdmin={isAdmin}
        invoicesCount={invoices.length}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        staffFilter={staffFilter}
        setStaffFilter={setStaffFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        staffOptions={staffOptions}
        clearInvoiceFilters={clearInvoiceFilters}
        paginatedInvoices={paginatedInvoices}
        sortedInvoicesLength={sortedInvoices.length}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        setCurrentPage={setCurrentPage}
        sortConfig={sortConfig}
        onSort={handleSort}
        getStatusBadge={getStatusBadge}
        setSelectedInvoice={setSelectedInvoice}
        setPaymentAmount={setPaymentAmount}
        setShowPaymentModal={setShowPaymentModal}
        openReturnInvoiceModal={openReturnInvoiceModal}
        canEditInvoice={canEditInvoice}
        getEditBlockedReason={getEditBlockedReason}
        openEditInvoiceModal={openEditInvoiceModal}
        fetchInvoiceDetails={fetchInvoiceDetails}
        handleQuickPrintInvoice={handleQuickPrintInvoice}
        handleDeleteInvoice={handleDeleteInvoice}
      />

      <AnimatePresence>
        {showDetailsModal && selectedInvoice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDetailsModal}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
                <div className="flex items-center space-x-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4f5fb] text-slate-700">
                    <Receipt size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Накладная #{selectedInvoice.id}</h3>
                    <p className="text-xs text-slate-500">{new Date(selectedInvoice.createdAt).toLocaleString('ru-RU')}</p>
                  </div>
                </div>
                <button
                  onClick={closeDetailsModal}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-[#f4f5fb] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto bg-[#f4f5fb]/40 p-6">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                    <div className="mb-2 flex items-center space-x-2 text-slate-400">
                      <UserIcon size={16} />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Клиент</span>
                    </div>
                    <p className="text-base font-semibold text-slate-900">{selectedInvoice.customer_name}</p>
                    <p className="mt-1 text-xs text-slate-400">{selectedInvoice.customer_phone || 'Нет телефона'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                    <div className="mb-2 flex items-center space-x-2 text-slate-400">
                      <WarehouseIcon size={16} />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Склад</span>
                    </div>
                    <p className="text-base font-semibold text-slate-900">{selectedInvoice.warehouse?.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{selectedInvoice.warehouse?.address || '---'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                    <div className="mb-2 flex items-center space-x-2 text-slate-400">
                      <Clock size={16} />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Статус</span>
                    </div>
                    <div>{getStatusBadge(getEffectiveStatus(selectedInvoice), selectedInvoice.cancelled)}</div>
                    <p className="mt-2 text-xs text-slate-500">Сотрудник: {selectedInvoice.staff_name}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900">Товары</h4>
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs">
                    <div className="space-y-3 p-3 md:hidden">
                      {selectedInvoice.items.map((item: any) => {
                        const quantityInfo = getInvoiceItemQuantityParts(item);
                        const returnedQty = getInvoiceItemReturnedQty(item);
                        const remainingQty = getReturnItemRemainingUnits(item);

                        return (
                          <div key={`mobile-item-${item.id}`} className="rounded-xl border border-slate-100 bg-[#f4f5fb]/50 p-3">
                            <p className="wrap-break-word text-sm font-medium text-slate-900">{formatProductName(item.product_name)}</p>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                              <div className="rounded-xl bg-white px-2.5 py-2">
                                <p className="text-[9px] uppercase tracking-wider text-slate-400">Кол-во</p>
                                <p className="mt-0.5 whitespace-nowrap text-xs font-semibold text-slate-700">{quantityInfo.primary}</p>
                                {quantityInfo.secondary && (
                                  <p className="mt-0.5 whitespace-nowrap text-[10px] text-slate-400">{quantityInfo.secondary}</p>
                                )}
                              </div>
                              <div className="rounded-xl bg-white px-2.5 py-2">
                                <p className="text-[9px] uppercase tracking-wider text-slate-400">Цена</p>
                                <p className="mt-0.5 text-xs font-semibold text-slate-900">{formatMoney(item.sellingPrice)}</p>
                              </div>
                              <div className="rounded-xl bg-white px-2.5 py-2">
                                <p className="text-[9px] uppercase tracking-wider text-slate-400">Итого</p>
                                <p className="mt-0.5 text-xs font-semibold text-slate-900">{formatMoney(item.totalPrice)}</p>
                              </div>
                            </div>
                            {returnedQty > PAYMENT_EPSILON && (
                              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                                <span>Возвращено: {formatCount(returnedQty)} {normalizeDisplayBaseUnit(item?.unit || item?.baseUnitNameSnapshot || item?.baseUnitName || 'шт')}</span>
                                <span className="text-slate-400">Осталось: {formatCount(remainingQty)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <table className="hidden w-full border-collapse text-left text-xs md:table">
                      <thead>
                        <tr className="border-b border-slate-100 bg-[#f4f5fb] text-xs font-medium uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3">Товар</th>
                          <th className="px-4 py-3">Кол-во</th>
                          <th className="px-4 py-3">Цена</th>
                          <th className="px-4 py-3 text-right">Итого</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedInvoice.items.map((item: any) => {
                          const quantityInfo = getInvoiceItemQuantityParts(item);
                          const returnedQty = getInvoiceItemReturnedQty(item);
                          const remainingQty = getReturnItemRemainingUnits(item);

                          return (
                            <tr key={item.id} className="hover:bg-[#f4f5fb]/50 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{formatProductName(item.product_name)}</p>
                                {item.saleAllocations && item.saleAllocations.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {item.saleAllocations.map((sa: any) => (
                                      <span key={sa.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600">
                                        Партия #{sa.batchId} ({sa.quantity} {item.unit})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                                <p className="whitespace-nowrap text-xs font-semibold text-slate-700">{quantityInfo.primary}</p>
                                {quantityInfo.secondary && (
                                  <p className="mt-0.5 whitespace-nowrap text-[10px] text-slate-400">{quantityInfo.secondary}</p>
                                )}
                                {returnedQty > PAYMENT_EPSILON && (
                                  <div className="mt-1.5 inline-flex flex-col rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1">
                                    <span className="text-[10px] font-semibold text-amber-700">Возвращено: {formatCount(returnedQty)}</span>
                                    <span className="text-[10px] text-slate-500">Осталось: {formatCount(remainingQty)}</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-700">{formatMoney(item.sellingPrice)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(item.totalPrice)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-2 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs text-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Подытог</span>
                      <span className="font-medium text-slate-900">{formatMoney(getInvoiceSubtotal(selectedInvoice))}</span>
                    </div>
                    {getInvoiceChangeAmount(selectedInvoice) > PAYMENT_EPSILON && (
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Сдача клиенту</span>
                        <span className="font-semibold text-amber-600">{formatMoney(getInvoiceChangeAmount(selectedInvoice))}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Скидка ({selectedInvoice.discount}%)</span>
                      <span className="font-medium text-slate-900">-{formatMoney(getInvoiceDiscountAmount(selectedInvoice))}</span>
                    </div>
                    {selectedInvoice.returnedAmount > 0 && (
                      <div className="flex items-center justify-between text-rose-600">
                        <span>Возвращено</span>
                        <span className="font-semibold">-{formatMoney(selectedInvoice.returnedAmount || 0)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-slate-900">
                      <span>Итого</span>
                      <span className="text-lg font-bold text-slate-900">{formatMoney(getInvoiceNetAmount(selectedInvoice))}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                      <span>Оплачено</span>
                      <span className="font-semibold text-emerald-600">{formatMoney(getInvoiceAppliedPaidAmount(selectedInvoice))}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Остаток (Долг)</span>
                      <span className="font-semibold text-rose-600">{formatMoney(getInvoiceBalance(selectedInvoice))}</span>
                    </div>
                  </div>
                </div>

                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">История платежей</h4>
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-[#f4f5fb] text-slate-500">
                            <th className="px-4 py-3">Дата</th>
                            <th className="px-4 py-3">Сумма</th>
                            <th className="px-4 py-3">Сотрудник</th>
                            <th className="px-4 py-3 text-right">Действие</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedInvoice.payments.map((p: any) => (
                            <tr key={p.id}>
                              <td className="px-4 py-3 text-slate-500">{new Date(p.createdAt).toLocaleString('ru-RU')}</td>
                              <td className="px-4 py-3 font-semibold text-emerald-600">{formatMoney(p.amount)}</td>
                              <td className="px-4 py-3 text-slate-500">{p.staff_name}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => void handleCancelPayment(p)}
                                  disabled={cancellingPaymentId === Number(p.id)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <X size={14} />
                                  {cancellingPaymentId === Number(p.id) ? 'Отмена...' : 'Отменить'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {getInvoiceReturnedItems(selectedInvoice).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Возвращенные товары</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {getInvoiceReturnedItems(selectedInvoice).map((item: any) => {
                        const returnedQty = getInvoiceItemReturnedQty(item);
                        const remainingQty = getReturnItemRemainingUnits(item);
                        const unitName = normalizeDisplayBaseUnit(item?.unit || item?.baseUnitNameSnapshot || item?.baseUnitName || 'шт');

                        return (
                          <div key={`returned-item-${item.id}`} className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4">
                            <p className="wrap-break-word text-sm font-medium text-slate-900">{getReturnItemDisplayName(item)}</p>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-xl bg-white px-3 py-2">
                                <p className="text-[9px] font-medium uppercase tracking-wider text-amber-600">Возвращено</p>
                                <p className="mt-0.5 font-semibold text-rose-600">{formatCount(returnedQty)} {unitName}</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2">
                                <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Осталось</p>
                                <p className="mt-0.5 font-semibold text-slate-700">{formatCount(remainingQty)} {unitName}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedInvoice.returns && selectedInvoice.returns.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">История возвратов</h4>
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-[#f4f5fb] text-slate-500">
                            <th className="px-4 py-3">Дата</th>
                            <th className="px-4 py-3">Сумма</th>
                            <th className="px-4 py-3">Причина</th>
                            <th className="px-4 py-3">Сотрудник</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedInvoice.returns.map((r: any) => (
                            <tr key={r.id}>
                              <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
                              <td className="px-4 py-3 font-semibold text-rose-600">-{formatMoney(r.totalValue)}</td>
                              <td className="max-w-xs wrap-break-word px-4 py-3 text-slate-500">{r.reason || 'Без причины'}</td>
                              <td className="px-4 py-3 text-slate-500">{r.staff_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
                <button
                  onClick={() => {
                    if (isPaymentActionDisabled(selectedInvoice)) return;
                    setPaymentAmount(String(toFixedNumber(getInvoiceBalance(selectedInvoice))));
                    setShowPaymentModal(true);
                  }}
                  disabled={isPaymentActionDisabled(selectedInvoice)}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold shadow-xs transition-colors',
                    isPaymentActionDisabled(selectedInvoice)
                      ? 'cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-300'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700',
                  )}
                >
                  <Banknote size={16} />
                  <span>Оплата</span>
                </button>
                <button
                  onClick={() => {
                    void openReturnInvoiceModal(selectedInvoice);
                  }}
                  disabled={isReturnActionDisabled(selectedInvoice)}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors',
                    isReturnActionDisabled(selectedInvoice)
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
                  )}
                >
                  <RotateCcw size={16} />
                  <span>Возврат</span>
                </button>
                <button
                  onClick={() => handlePrintInvoice(selectedInvoice)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-900 hover:text-white"
                >
                  <Printer size={16} />
                  <span>Печать</span>
                </button>
                <button
                  onClick={closeDetailsModal}
                  className="rounded-full border border-slate-200 bg-[#f4f5fb] px-5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditModal && selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeEditModal}
            className="fixed inset-0 z-60 flex items-end justify-center bg-slate-900/35 p-2 sm:items-center sm:p-3"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-[#9fb7d5] bg-white shadow-2xl sm:max-h-[92vh]"
            >
              <div className="flex items-center justify-between border-b border-[#b7c2ce] bg-[linear-gradient(180deg,#ffffff_0%,#dde5ee_100%)] px-4 py-3">
                <div className="flex items-center space-x-4">
                  <div className="rounded border border-[#9fb7d5] bg-[#eaf2fb] p-2 text-[#23527c]">
                    <Pencil size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#1f2933]">Изменить продажу</h3>
                    <p className="text-xs font-medium text-[#5f6f7f]">Накладная #{selectedInvoice.id}</p>
                  </div>
                </div>
                <button onClick={closeEditModal} className="flex h-8 w-8 items-center justify-center rounded border border-[#9fb7d5] bg-white text-[#23527c] transition-colors hover:bg-[#eaf2fb]">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-[#f3f5f7] p-3 sm:p-4">
                <div className="rounded border border-[#c8d2df] bg-white p-3">
                  <label className="ml-1 text-sm font-semibold text-[#32465a]">Клиент</label>
                  <select
                    value={editCustomerId}
                    onChange={(e) => setEditCustomerId(e.target.value ? Number(e.target.value) : '')}
                    className="mt-2 w-full rounded border border-[#9fb7d5] bg-white px-3 py-2 text-sm font-medium text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                  >
                    <option value="">Без названия</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-[#5f6f7f]">
                    При смене клиента переносится только текущая накладная, ее оплаты и возвраты.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#32465a]">Товары в накладной</p>
                      <p className="mt-1 text-xs text-[#5f6f7f]">Проверьте строки, количество, цену и скидку перед сохранением.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addEditInvoiceItem}
                      className="inline-flex items-center gap-2 rounded border border-[#7f9db9] bg-[#eaf2fb] px-3 py-2 text-sm font-medium text-[#1f3f63] transition-colors hover:bg-[#dbe9f6]"
                    >
                      <Plus size={16} />
                      <span>Добавить товар</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#48627f]" />
                    <input
                      type="text"
                      value={editInvoiceSearch}
                      onChange={(e) => setEditInvoiceSearch(e.target.value)}
                      placeholder="Поиск товара внутри накладной..."
                      className="w-full rounded border border-[#9fb7d5] bg-white py-2 pl-10 pr-3 text-sm text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                    />
                  </div>

                  <div className="space-y-3">
                    {filteredEditInvoiceItems.map((item) => {
                      const index = editInvoiceItems.findIndex((entry) => entry.key === item.key);
                      const selectedProduct = getEditProductMeta(item.productId);
                      const itemMaxAllowedQuantity = getEditItemMaxAllowedQuantity(item, editInvoiceItems);
                      const selectedPackagingForRow = getEditItemPackaging(item);
                      const unitsPerPackageForRow = Math.max(0, Number(selectedPackagingForRow?.unitsPerPackage || 0));
                      const maxPackageCount =
                        selectedPackagingForRow && unitsPerPackageForRow > 0
                          ? Math.floor(itemMaxAllowedQuantity / unitsPerPackageForRow)
                          : 0;
                      const visibleEditProducts = editProducts
                        .filter((product) => {
                          const productId = Number(product.id);
                          const isSelectedProduct = productId === Number(item.productId || 0);
                          const hasStock = Math.max(0, Number(product.stock || 0)) > 0;
                          return isSelectedProduct || hasStock;
                        })
                        .filter((product) => {
                          const query = editProductMenuSearch.trim().toLowerCase();
                          if (!query) return true;
                          return formatProductName(product.name).toLowerCase().includes(query);
                        });

                      return (
                        <div
                          key={item.key}
                          className={`rounded border p-3 shadow-sm transition-colors ${
                            item.isNew
                              ? 'border-[#9fb7d5] bg-[#f7fbff]'
                              : 'border-[#b7c2ce] bg-white'
                          }`}
                        >
                          <div className="mb-2.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#48627f]">Строка #{index + 1}</p>
                              {item.isNew ? (
                                <span className="rounded border border-[#9fb7d5] bg-[#eaf2fb] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#23527c]">
                                  Новая
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEditInvoiceItem(item.key)}
                              disabled={editInvoiceItems.length === 1}
                              className="inline-flex items-center gap-1 rounded border border-[#d6a1a1] bg-[#fff1f1] px-3 py-1.5 text-xs font-medium text-[#9f1239] transition-colors hover:bg-[#ffe4e6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                              <span>Убрать</span>
                            </button>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[#48627f]">Товар</p>
                              <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenEditProductMenuKey((current) => {
                                        const nextKey = current === item.key ? null : item.key;
                                        setEditProductMenuSearch('');
                                        return nextKey;
                                      });
                                    }}
                                    className="flex w-full items-center justify-between rounded border border-[#9fb7d5] bg-white px-3 py-2 text-left text-sm text-[#1f2933] transition-colors hover:bg-[#f7fbff] focus:border-[#4f81bd]"
                                  >
                                  <span className="truncate">
                                    {selectedProduct ? formatProductName(selectedProduct.name) : 'Выберите товар из списка'}
                                  </span>
                                  <ChevronDown size={18} className="shrink-0 text-[#48627f]" />
                                </button>

                                {openEditProductMenuKey === item.key ? (
                                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded border border-[#9fb7d5] bg-white shadow-2xl shadow-slate-900/10">
                                    <div className="border-b border-[#c8d2df] bg-[#eef3f8] p-2">
                                      <div className="relative">
                                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#48627f]" />
                                        <input
                                          type="text"
                                          value={editProductMenuSearch}
                                          onChange={(e) => setEditProductMenuSearch(e.target.value)}
                                          placeholder="Поиск товара..."
                                          className="w-full rounded border border-[#9fb7d5] bg-white py-2 pl-9 pr-3 text-sm text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                                        />
                                      </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto py-1">
                                      {visibleEditProducts
                                        .map((product, productIndex) => {
                                          const stockInfo = getProductStockParts(product as EditProductOption);

                                          return (
                                            <button
                                              key={product.id}
                                              type="button"
                                              onClick={() => {
                                                selectEditProductForItem(item.key, product);
                                                setOpenEditProductMenuKey(null);
                                                setEditProductMenuSearch('');
                                              }}
                                              className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[#fff8dc]"
                                            >
                                              <div className="min-w-0">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7d90]">#{productIndex + 1}</p>
                                                <p className="truncate text-sm font-semibold text-[#1f2933]">
                                                  {formatProductName(product.name)}
                                                </p>
                                                <p className="mt-1 text-xs font-medium text-[#48627f]">{stockInfo.primary}</p>
                                                {stockInfo.secondary && (
                                                  <p className="mt-0.5 text-[10px] text-[#6b7d90]">{stockInfo.secondary}</p>
                                                )}
                                              </div>
                                            </button>
                                          );
                                        })}
                                      {!visibleEditProducts.length ? (
                                        <div className="px-4 py-6 text-center text-sm font-medium text-slate-400">
                                          Ничего не найдено
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="rounded border border-[#c8d2df] bg-[#f7f9fb] px-3 py-2">
                              <p className={`wrap-break-word text-sm font-semibold leading-5 ${selectedProduct ? 'text-[#1f2933]' : 'text-[#23527c]'}`}>
                                {selectedProduct ? formatProductName(selectedProduct.name) : 'Сначала выберите товар, потом укажите тип продажи и количество'}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[#48627f]">Тип продажи и количество</p>
                              <div className="rounded border border-[#c8d2df] bg-[#eef3f8] p-2">
                                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_1.1fr]">
                                  <select
                                    value={item.selectedPackagingId ? 'bulk' : 'piece'}
                                    onChange={(e) => {
                                      const bulkPackaging = getEditItemDefaultBulkPackaging(item);
                                      const isBulk = e.target.value === 'bulk' && bulkPackaging;
                                      updateNormalizedEditInvoiceItem(item.key, {
                                        selectedPackagingId: isBulk ? Number(bulkPackaging?.id || '') : '',
                                        packageQuantityInput: isBulk ? (item.packageQuantityInput || '1') : '0',
                                        extraUnitQuantityInput: isBulk ? item.extraUnitQuantityInput || '0' : item.quantity || '1',
                                      });
                                    }}
                                    disabled={!selectedProduct}
                                    className="w-full rounded border border-[#9fb7d5] bg-white px-3 py-2 text-sm font-medium text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                                  >
                                    <option value="piece">Розница</option>
                                    {getEditItemDefaultBulkPackaging(item) ? (
                                      <option value="bulk">Оптом</option>
                                    ) : null}
                                  </select>
                                  <div className="flex items-center rounded border border-[#c8d2df] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#5f6f7f]">
                                    {!selectedProduct
                                      ? 'Выберите товар, чтобы появился режим продажи'
                                      : item.selectedPackagingId && getEditItemPackaging(item)
                                      ? `По умолчанию: ${getEditItemPackaging(item)?.packageName} x ${getEditItemPackaging(item)?.unitsPerPackage}`
                                      : 'Продажа в розницу'}
                                  </div>
                                </div>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {item.selectedPackagingId ? (
                                  <>
                                    <input
                                      type="number"
                                      min="0"
                                      max={maxPackageCount}
                                      step="1"
                                      value={item.packageQuantityInput}
                                      onChange={(e) => updateNormalizedEditInvoiceItem(item.key, { packageQuantityInput: e.target.value })}
                                      placeholder="Кол-во упаковок"
                                      disabled={!selectedProduct}
                                      className="rounded border border-[#9fb7d5] bg-white px-3 py-2 text-sm font-medium text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      max={itemMaxAllowedQuantity}
                                      step="0.01"
                                      value={item.extraUnitQuantityInput}
                                      onChange={(e) => updateNormalizedEditInvoiceItem(item.key, { extraUnitQuantityInput: e.target.value })}
                                      placeholder="+ шт"
                                      disabled={!selectedProduct}
                                      className="rounded border border-[#9fb7d5] bg-white px-3 py-2 text-sm font-medium text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                                    />
                                  </>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    max={itemMaxAllowedQuantity}
                                    step="1"
                                    value={item.extraUnitQuantityInput}
                                    onChange={(e) => updateNormalizedEditInvoiceItem(item.key, { extraUnitQuantityInput: e.target.value })}
                                    placeholder="Кол-во, шт"
                                    disabled={!selectedProduct}
                                    className="sm:col-span-2 rounded border border-[#9fb7d5] bg-white px-3 py-2 text-sm font-medium text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                                  />
                                )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-4">
                            <div className="rounded border border-[#c8d2df] bg-[#f7f9fb] px-3 py-2">
                              <p className="text-[11px] font-semibold text-[#48627f]">Кол-во</p>
                              <p className="mt-1 text-sm font-semibold text-[#1f2933]">
                                {item.selectedPackagingId
                                  ? (() => {
                                      const selectedPackaging = getEditItemPackaging(item);
                                      const packageCount = Math.max(0, Number(item.packageQuantityInput || 0) || 0);
                                      const extraCount = Math.max(0, Number(item.extraUnitQuantityInput || 0) || 0);
                                      const lines = [];
                                      if (packageCount > 0 && selectedPackaging) {
                                        lines.push(`${packageCount} ${selectedPackaging.packageName}`);
                                      }
                                      if (extraCount > 0 || lines.length === 0) {
                                        lines.push(`${extraCount} ${item.baseUnitName || 'шт'}`);
                                      }
                                      return lines.join(' + ');
                                    })()
                                  : (Number(item.quantity || 0) > 0 ? `${item.quantity} ${item.baseUnitName || 'шт'}` : '0')}
                              </p>
                            </div>
                            <div className="rounded border border-[#c8d2df] bg-[#f7f9fb] px-3 py-2">
                              <p className="text-[11px] font-semibold text-[#48627f]">Цена</p>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.sellingPrice}
                                onChange={(e) => updateNormalizedEditInvoiceItem(item.key, { sellingPrice: e.target.value })}
                                placeholder="Цена"
                                disabled={!selectedProduct}
                                className="mt-1 w-full rounded border border-[#9fb7d5] bg-white px-2 py-1.5 text-sm font-semibold text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                              />
                            </div>
                            <div className="rounded border border-[#c8d2df] bg-[#f7f9fb] px-3 py-2">
                              <p className="text-[11px] font-semibold text-[#48627f]">Скидка %</p>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={item.discount}
                                onChange={(e) => updateNormalizedEditInvoiceItem(item.key, { discount: e.target.value })}
                                placeholder="%"
                                disabled={!selectedProduct}
                                className="mt-1 w-full rounded border border-[#9fb7d5] bg-white px-2 py-1.5 text-sm font-semibold text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                              />
                            </div>
                            <div className="rounded border border-[#d6c07a] bg-[#fff8dc] px-3 py-2">
                              <p className="text-[11px] font-semibold text-[#7a5a00]">Итого</p>
                              <p className="mt-1 text-sm font-bold text-[#1f2933]">
                                {(() => {
                                  const q = Math.max(0, Number(item.quantity || 0));
                                  const p = Math.max(0, Number(item.sellingPrice || 0));
                                  const d = Math.max(0, Number(item.discount || 0));
                                  return formatMoney(q * ceilMoney(p * (1 - d / 100)));
                                })()}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#d5dde6] pt-2 text-xs text-[#5f6f7f]">
                            <span>Ед.: {item.baseUnitName || selectedProduct?.baseUnitName || selectedProduct?.unit || item.unit || 'шт'}</span>
                            {item.selectedPackagingId && getEditItemPackaging(item) ? (
                              <span>
                                По умолчанию: {getEditItemPackaging(item)?.packageName} x {getEditItemPackaging(item)?.unitsPerPackage}
                              </span>
                            ) : null}
                            {selectedProduct ? (
                              <span>
                                Остаток сейчас: {getProductStockParts(selectedProduct as EditProductOption).primary}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {!filteredEditInvoiceItems.length && (
                      <div className="rounded border border-dashed border-[#b7c2ce] bg-white px-4 py-6 text-center text-sm text-[#5f6f7f]">
                        По этому поиску товары в накладной не найдены.
                      </div>
                    )}
                  </div>

                  <div className="rounded border border-[#d6c07a] bg-[#fff8dc] p-3">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded border border-[#c8d2df] bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold text-[#48627f]">Товаров</p>
                        <p className="mt-1 text-lg font-bold text-[#1f2933]">{editInvoiceItems.length}</p>
                      </div>
                      <div className="rounded border border-[#c8d2df] bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold text-[#48627f]">Сумма</p>
                        <p className="mt-1 text-lg font-bold text-[#1f2933]">{formatMoney(editInvoiceSubtotal)}</p>
                      </div>
                      <div className="rounded border border-[#c8d2df] bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold text-[#48627f]">Скидка %</p>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editDiscount}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditDiscount(value === '' ? '' : String(Math.max(0, Math.min(100, Number(value) || 0))));
                          }}
                          className="mt-1 w-full rounded border border-[#9fb7d5] bg-white px-2 py-1 text-lg font-bold text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                          placeholder="0"
                        />
                      </div>
                      <div className="rounded border border-[#8f6f18] bg-[#ffd966] px-3 py-2 text-[#1f2933]">
                        <p className="text-[11px] font-semibold text-[#7a5a00]">Итого</p>
                        <p className="mt-1 text-lg font-bold">{formatMoney(editInvoiceNetAmount)}</p>
                      </div>
                    </div>
                  </div>
                  {Number(selectedInvoice?.tax || 0) > 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      Налог: +{formatMoney(editInvoiceTaxAmount)}
                    </p>
                  ) : null}
                </div> {/* container of summary and list (space-y-4 line 2004) */}
              </div> {/* scrollable area (line 1985) */}

              <div className="flex flex-col-reverse gap-2 border-t border-[#b7c2ce] bg-[#eef3f8] px-4 py-3 sm:flex-row">
                <button
                  onClick={closeEditModal}
                  className="flex-1 rounded border border-[#9fb7d5] bg-white px-4 py-2.5 text-sm font-medium text-[#1f3f63] transition-colors hover:bg-[#eaf2fb]"
                >
                  Отмена
                </button>
                <button
                  onClick={handleUpdateInvoice}
                  disabled={isSavingEdit}
                  className="flex-1 rounded border border-[#8f6f18] bg-[#ffd966] px-4 py-2.5 text-sm font-semibold text-[#1f2933] shadow-sm transition-colors hover:bg-[#f7c948] disabled:opacity-50"
                >
                  {isSavingEdit ? 'Сохранение...' : 'Сохранить'}
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
            onClick={closePaymentModal}
            className="fixed inset-0 z-60 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-t-4xl bg-white shadow-2xl sm:rounded-[2.5rem]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4 sm:p-8">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl">
                    <Banknote size={24} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Принять оплату</h3>
                </div>
                <button onClick={closePaymentModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-5 p-4 sm:space-y-6 sm:p-8">
                <div>
                    <p className="text-sm font-bold text-slate-500 mb-1">Накладная #{selectedInvoice.id}</p>
                  <p className="text-lg font-black text-slate-900">{selectedInvoice.customer_name}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    min={0}
                    value={paymentAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPaymentAmount(value === '' ? '' : String(Math.max(0, Number(value) || 0)));
                    }}
                    className="w-full mt-1 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all font-black text-2xl text-slate-900 shadow-sm"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:p-8">
                <button 
                  onClick={closePaymentModal}
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
            onClick={closeReturnModal}
            className="fixed inset-0 z-60 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-[#9fb7d5] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#b7c2ce] bg-[linear-gradient(180deg,#ffffff_0%,#dde5ee_100%)] px-4 py-3">
                <div className="flex items-center space-x-4">
                  <div className="rounded border border-[#d6c07a] bg-[#fff8dc] p-2 text-[#7a5a00]">
                    <RotateCcw size={24} />
                  </div>
                  <h3 className="text-xl font-semibold text-[#1f2933]">Оформить возврат</h3>
                </div>
                <button onClick={closeReturnModal} className="flex h-8 w-8 items-center justify-center rounded border border-[#9fb7d5] bg-white text-[#23527c] transition-colors hover:bg-[#eaf2fb]">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 space-y-4 overflow-y-auto bg-[#f3f5f7] p-3 sm:p-4">
                <div className="grid gap-2 rounded border border-[#c8d2df] bg-white p-3 md:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[#48627f]">Накладная</p>
                    <p className="mt-1 text-sm font-semibold text-[#1f2933]">#{selectedInvoice.id}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#48627f]">Клиент</p>
                    <p className="mt-1 wrap-break-word text-sm font-semibold text-[#1f2933]">{selectedInvoice.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#48627f]">Дата</p>
                    <p className="mt-1 text-sm font-medium text-[#1f2933]">{new Date(selectedInvoice.createdAt).toLocaleDateString('ru-RU')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="ml-1 text-sm font-semibold text-[#32465a]">Выберите товары для возврата</h4>
                  <div className="overflow-x-auto rounded border border-[#b7c2ce] bg-white">
                    <table className="w-full min-w-190 table-fixed border-collapse text-left text-sm">
                      <colgroup>
                        <col className="w-[36%]" />
                        <col className="w-[30%]" />
                        <col className="w-[34%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-[#b7c2ce] bg-[#dbe5f1] text-[12px] font-semibold text-[#32465a]">
                          <th className="px-3 py-2">Товар</th>
                          <th className="px-3 py-2">Продано / доступно</th>
                          <th className="px-3 py-2">Возврат</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#d5dde6]">
                        {returnItems.map((item: ReturnInvoiceItem, idx: number) => {
                          const quantityInfo = getInvoiceItemQuantityParts(item);
                          const packaging = getReturnItemPackaging(item);
                          const remainingUnits = getReturnItemRemainingUnits(item);
                          const maxPackages = packaging ? Math.floor(remainingUnits / packaging.unitsPerPackage) : 0;
                          const inputMax = item.returnMode === 'package' ? maxPackages : remainingUnits;
                          const itemMeta = [
                            `Строка #${idx + 1}`,
                            item?.product?.sku ? `Артикул: ${item.product.sku}` : null,
                            item?.brandSnapshot || item?.product?.brand ? `Бренд: ${item.brandSnapshot || item.product.brand}` : null,
                          ].filter(Boolean).join(' Â· ');

                          return (
                            <tr key={item.id} className="even:bg-[#fbfcfd]">
                              <td className="px-3 py-3 align-top">
                                <p className="mb-1 text-[10px] font-medium text-[#6b7b8d]">
                                  {itemMeta}
                                </p>
                                <p className="wrap-break-word text-sm font-semibold leading-5 text-[#1f2933]">
                                  {getReturnItemDisplayName(item)}
                                </p>
                              </td>
                              <td className="px-3 py-3 align-top text-[11px] text-[#48627f]">
                                <p className="whitespace-nowrap text-xs font-semibold text-[#1f2933]">{quantityInfo.primary}</p>
                                {quantityInfo.secondary && (
                                  <p className="mt-0.5 whitespace-nowrap text-[10px] text-[#6b7b8d]">{quantityInfo.secondary}</p>
                                )}
                                <p className="mt-2 inline-flex rounded border border-[#c8d2df] bg-[#f7f9fb] px-2 py-1 text-[10px] text-[#48627f]">
                                  Доступно: {packaging ? `${maxPackages} ${packaging.packageName} или ` : ''}{formatCount(remainingUnits)} {packaging?.baseUnitName || 'шт'}
                                </p>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_120px] gap-2">
                                  {packaging ? (
                                    <select
                                      value={item.returnMode}
                                      onChange={(e) => {
                                        const newItems = [...returnItems] as ReturnInvoiceItem[];
                                        newItems[idx] = {
                                          ...newItems[idx],
                                          returnMode: e.target.value === 'package' ? 'package' : 'unit',
                                          returnQty: '',
                                        };
                                        setReturnItems(newItems);
                                      }}
                                      className="h-9 w-full min-w-0 rounded border border-[#9fb7d5] bg-white px-2 text-xs font-medium text-[#1f2933] outline-none focus:border-[#4f81bd]"
                                    >
                                      <option value="package">{packaging.packageName}</option>
                                      <option value="unit">{packaging.baseUnitName}</option>
                                    </select>
                                  ) : null}
                                  <input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    max={inputMax}
                                    value={item.returnQty}
                                    onChange={(e) => {
                                      const newItems = [...returnItems] as ReturnInvoiceItem[];
                                      newItems[idx] = {
                                        ...newItems[idx],
                                        returnQty: e.target.value,
                                      };
                                      setReturnItems(newItems);
                                    }}
                                    placeholder={item.returnMode === 'package' ? 'Кол-во коробок' : 'Кол-во шт'}
                                    className={clsx(
                                      'h-9 w-full min-w-0 rounded border border-[#9fb7d5] bg-white px-2 text-center text-sm font-semibold text-[#1f2933] outline-none focus:border-[#4f81bd]',
                                      !packaging && 'col-span-2'
                                    )}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded border border-[#c8d2df] bg-white p-3">
                  <label className="ml-1 text-sm font-semibold text-[#32465a]">Причина возврата</label>
                  <textarea 
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="mt-2 min-h-21.5 w-full rounded border border-[#9fb7d5] bg-white px-3 py-2 text-sm font-medium text-[#1f2933] outline-none transition-colors focus:border-[#4f81bd]"
                    placeholder="Укажите причину возврата..."
                  />
                </div>
              </div>
              
              <div className="flex flex-col-reverse gap-2 border-t border-[#b7c2ce] bg-[#eef3f8] px-4 py-3 sm:flex-row">
                <button 
                  onClick={closeReturnModal}
                  className="flex-1 rounded border border-[#9fb7d5] bg-white px-4 py-2 text-sm font-medium text-[#1f3f63] transition-colors hover:bg-[#eaf2fb]"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleReturn}
                  disabled={isReturning || returnItems.every((item: ReturnInvoiceItem) => !item.returnQty || parseFloat(item.returnQty) === 0)}
                  className="flex-1 rounded border border-[#8f6f18] bg-[#ffd966] px-4 py-2 text-sm font-semibold text-[#2f2f2f] transition-colors hover:bg-[#ffc83d] disabled:cursor-not-allowed disabled:opacity-50"
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
