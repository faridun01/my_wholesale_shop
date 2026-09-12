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
  Ban,
  Phone,
  Share2,
  Loader2,
  Package,
  Layers,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { formatCount, formatMoney, toFixedNumber, ceilMoney, formatTransactionReason } from '../utils/format';
import { formatProductName } from '../utils/productName';
import { getDefaultWarehouseId } from '../utils/warehouse';
import { getCustomers } from '../api/customers.api';
import { getWarehouses } from '../api/warehouses.api';
import { Badge, Button, IconButton, PageHeader } from '../components/UI';
import SalesInvoicesSection from '../components/sales/SalesInvoicesSection';
import DeleteInvoiceModal from '../components/sales/DeleteInvoiceModal';
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
  getInvoiceReturnedAmount,
  getInvoiceReturnedItems,
  getInvoiceSubtotal,
  getProductStockParts,
  getReturnItemDisplayName,
  getReturnItemPackaging,
  getReturnItemRemainingUnits,
  hasInvoiceReturns,
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
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    if (!isAdmin && userWarehouseId) {
      return String(userWarehouseId);
    }
    return '';
  });
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
      if (!isAdmin && (filteredWarehouses[0] || defaultWarehouseId)) {
        setSelectedWarehouseId(String(defaultWarehouseId || filteredWarehouses[0]?.id));
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

  const [returnSearch, setReturnSearch] = useState('');

  const handleCloseReturnModal = () => {
    setReturnSearch('');
    closeReturnModal();
  };

  const filteredReturnItems = React.useMemo(() => {
    const query = returnSearch.trim().toLowerCase();
    if (!query) return returnItems;
    return returnItems.filter((item: ReturnInvoiceItem) => {
      const name = getReturnItemDisplayName(item).toLowerCase();
      const sku = String(item?.product?.sku || '').toLowerCase();
      const brand = String(item?.brandSnapshot || item?.product?.brand || '').toLowerCase();
      return name.includes(query) || sku.includes(query) || brand.includes(query);
    });
  }, [returnItems, returnSearch]);

  const returnStats = React.useMemo(() => {
    let activeCount = 0;
    let totalUnits = 0;
    let totalRefund = 0;

    for (const item of returnItems) {
      const rawQty = Number(item.returnQty || 0);
      if (rawQty > 0) {
        activeCount++;
        const packaging = getReturnItemPackaging(item);
        const units = item.returnMode === 'package' && packaging
          ? rawQty * packaging.unitsPerPackage
          : rawQty;
        totalUnits += units;

        const itemDiscount = Number(item.discount || 0);
        const globalDiscount = Number(selectedInvoice?.discount || 0);
        const basePrice = Number(item.sellingPrice ?? item.price ?? 0);
        const unitPriceAfterDiscount = basePrice * (1 - itemDiscount / 100) * (1 - globalDiscount / 100);
        totalRefund += unitPriceAfterDiscount * units;
      }
    }

    return {
      activeCount,
      totalUnits,
      totalRefund,
    };
  }, [returnItems, selectedInvoice]);

  const handleFillAllReturns = () => {
    setReturnItems((current) =>
      current.map((item) => {
        const remainingUnits = getReturnItemRemainingUnits(item);
        const packaging = getReturnItemPackaging(item);
        if (item.returnMode === 'package' && packaging) {
          const maxPackages = Math.floor(remainingUnits / packaging.unitsPerPackage);
          return { ...item, returnQty: String(maxPackages) };
        }
        return { ...item, returnQty: String(remainingUnits) };
      })
    );
  };

  const handleResetAllReturns = () => {
    setReturnItems((current) => current.map((item) => ({ ...item, returnQty: '' })));
  };

  const updateReturnItemMode = (itemId: number, mode: 'package' | 'unit') => {
    setReturnItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, returnMode: mode, returnQty: '' }
          : item
      )
    );
  };

  const updateReturnItemQty = (itemId: number, qty: string) => {
    const intQty = qty === '' ? '' : String(Math.max(0, Math.floor(Number(qty) || 0)));
    setReturnItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, returnQty: intQty }
          : item
      )
    );
  };

  const {
    fetchInvoiceDetails,
    handleDeleteInvoice,
    handlePrintInvoice,
    handleQuickPrintInvoice,
    invoiceToDelete,
    closeDeleteInvoiceModal,
    confirmDeleteInvoice,
    isDeletingInvoice,
    deleteInvoiceError,
    needsForceDelete,
  } = useSalesInvoiceActions({
    selectedInvoice,
    setSelectedInvoice,
    setShowDetailsModal,
    closeDetailsModal,
    closeEditModal,
    closePaymentModal,
    closeReturnModal,
    fetchInvoices,
    invoices,
  });

  const handleShareInvoice = async (invoice: any) => {
    if (!invoice) return;
    const effectiveStatus = getEffectiveStatus(invoice);
    const statusLabel = invoice?.cancelled
      ? 'Отменена'
      : effectiveStatus === 'paid'
        ? 'Оплачено'
        : effectiveStatus === 'partial'
          ? 'Частично оплачено'
          : 'Не оплачено';

    const itemsText = (invoice.items || [])
      .map((item: any, idx: number) => {
        const qInfo = getInvoiceItemQuantityParts(item);
        const name = formatProductName(item.product_name);
        const price = formatMoney(item.sellingPrice);
        const total = formatMoney(item.totalPrice);
        return `${idx + 1}. ${name}\n   ${qInfo.primary} × ${price} = ${total}`;
      })
      .join('\n');

    const lines = [
      `🧾 НАКЛАДНАЯ №${invoice.id}`,
      `Дата: ${new Date(invoice.createdAt).toLocaleString('ru-RU')}`,
      `Клиент: ${invoice.customer_name || 'Не указан'}${invoice.customer_phone ? ` (${invoice.customer_phone})` : ''}`,
      invoice.warehouse?.name ? `Склад: ${invoice.warehouse.name}` : '',
      `Статус: ${statusLabel}`,
      '',
      '--- ТОВАРЫ ---',
      itemsText,
      '--------------',
      `Подытог: ${formatMoney(getInvoiceSubtotal(invoice))}`,
      Number(invoice.discount || 0) > 0 ? `Скидка (${invoice.discount}%): -${formatMoney(getInvoiceDiscountAmount(invoice))}` : '',
      Number(invoice.returnedAmount || 0) > 0 ? `Возврат: -${formatMoney(invoice.returnedAmount)}` : '',
      `ИТОГО: ${formatMoney(getInvoiceNetAmount(invoice))}`,
      `Оплачено: ${formatMoney(getInvoiceAppliedPaidAmount(invoice))}`,
      `Остаток (Долг): ${formatMoney(getInvoiceBalance(invoice))}`,
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Накладная №${invoice.id}`,
          text: lines,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(lines);
      toast.success('Текст накладной скопирован!');
    } catch {
      toast.error('Не удалось скопировать накладную');
    }
  };

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
    if (isAdmin) {
      setSelectedWarehouseId('');
    }
  };

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-3.5 sm:space-y-4 lg:space-y-5 lg:rounded-[28px] lg:bg-[#f4f5fb] lg:p-5 min-h-screen">
        <SalesInvoicesSection
        isAdmin={isAdmin}
        warehouses={warehouses}
        selectedWarehouseId={selectedWarehouseId}
        setSelectedWarehouseId={setSelectedWarehouseId}
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
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ y: '100%', opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.5 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-[92vh] sm:h-auto sm:max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200/90 bg-white shadow-2xl"
            >
              {/* Mobile grab handle */}
              <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 sm:hidden" />

              {/* Modal Top Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-6">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-slate-950 via-slate-800 to-indigo-950 text-white shadow-sm ring-4 ring-slate-100/80">
                    <Receipt size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 truncate">
                        Накладная #{selectedInvoice.id}
                      </h3>
                      <div className="shrink-0 scale-95 origin-left">
                        {getStatusBadge(getEffectiveStatus(selectedInvoice), selectedInvoice.cancelled)}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                      <Clock size={11} className="text-slate-400 shrink-0" />
                      <span>{new Date(selectedInvoice.createdAt).toLocaleString('ru-RU')}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePrintInvoice(selectedInvoice)}
                    className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 shadow-2xs"
                    title="Печать"
                  >
                    <Printer size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareInvoice(selectedInvoice)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-200/90 bg-teal-50/80 text-teal-700 transition-all hover:bg-teal-100 active:scale-95 shadow-2xs"
                    title="Поделиться накладной"
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={closeDetailsModal}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 shadow-2xs"
                    title="Закрыть"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/40 p-4 sm:p-6">
                {/* Requisites 3-Cards */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {/* Customer Card */}
                  <div className="rounded-2xl border border-blue-100/90 bg-linear-to-br from-blue-50/50 via-white to-blue-50/20 p-3.5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-blue-600">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100/80 text-blue-700">
                          <UserIcon size={13} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800/80">Клиент</span>
                      </div>
                      <p className="mt-2 text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate" title={selectedInvoice.customer_name}>
                        {selectedInvoice.customer_name}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-100/60 flex items-center justify-between">
                      {selectedInvoice.customer_phone ? (
                        <a
                          href={`tel:${selectedInvoice.customer_phone}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-blue-100/50 hover:bg-blue-100/80 px-2 py-0.5 rounded-md"
                        >
                          <Phone size={11} className="shrink-0" />
                          <span className="font-mono">{selectedInvoice.customer_phone}</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400">Телефон не указан</span>
                      )}

                      {hasInvoiceReturns(selectedInvoice) && (
                        <span className="sm:hidden inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200">
                          <RotateCcw size={10} />
                          Есть возврат
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Warehouse Card (Desktop Only) */}
                  <div className="hidden sm:flex rounded-2xl border border-slate-200/90 bg-linear-to-br from-slate-50/80 via-white to-slate-50/30 p-3.5 shadow-2xs flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                          <WarehouseIcon size={13} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Склад отгрузки</span>
                      </div>
                      <p className="mt-2 text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate" title={selectedInvoice.warehouse?.name || '---'}>
                        {selectedInvoice.warehouse?.name || 'Основной склад'}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                      <MapPin size={11} className="shrink-0 text-slate-400" />
                      <span className="truncate">{selectedInvoice.warehouse?.address || 'Адрес не указан'}</span>
                    </div>
                  </div>

                  {/* Staff & Return status Card (Desktop Only) */}
                  <div className="hidden sm:flex rounded-2xl border border-purple-100/90 bg-linear-to-br from-purple-50/50 via-white to-purple-50/20 p-3.5 shadow-2xs flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-purple-600">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100/80 text-purple-700">
                          <Clock size={13} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800/80">Оформил</span>
                      </div>
                      <p className="mt-2 text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate">
                        {selectedInvoice.staff_name || 'Администратор'}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-purple-100/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">Статус возвратов:</span>
                      {hasInvoiceReturns(selectedInvoice) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200">
                          <RotateCcw size={10} />
                          Есть возврат
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-emerald-600">Без возвратов</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Goods List Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-200/80 text-slate-700">
                        <Package size={12} />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Товары в накладной
                      </h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold font-mono text-slate-600 border border-slate-200/70">
                        {selectedInvoice.items?.length || 0}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-800 sm:hidden">
                      {formatMoney(getInvoiceSubtotal(selectedInvoice))}
                    </span>
                  </div>

                  {/* Mobile Item Cards */}
                  <div className="space-y-2 md:hidden">
                    {selectedInvoice.items.map((item: any, idx: number) => {
                      const quantityInfo = getInvoiceItemQuantityParts(item);
                      const returnedQty = getInvoiceItemReturnedQty(item);
                      const remainingQty = getReturnItemRemainingUnits(item);

                      return (
                        <div
                          key={`mobile-item-${item.id}`}
                          className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-[10px] font-bold text-slate-500">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 leading-snug">
                                {formatProductName(item.product_name)}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 text-center">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Кол-во</p>
                              <p className="mt-0.5 font-bold text-slate-800 text-xs">{quantityInfo.primary}</p>
                              {quantityInfo.secondary && (
                                <p className="mt-0.5 text-[9px] text-slate-400">{quantityInfo.secondary}</p>
                              )}
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 text-center">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Цена</p>
                              <p className="mt-0.5 font-bold text-slate-900 text-xs font-mono">{formatMoney(item.sellingPrice)}</p>
                            </div>
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2 text-center">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-indigo-500">Итого</p>
                              <p className="mt-0.5 font-black text-indigo-950 text-xs font-mono">{formatMoney(item.totalPrice)}</p>
                            </div>
                          </div>

                          {returnedQty > PAYMENT_EPSILON && (
                            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-amber-200/90 bg-amber-50/70 px-2.5 py-1.5 text-[10px] font-medium text-amber-900">
                              <span className="flex items-center gap-1">
                                <RotateCcw size={10} className="text-amber-600" />
                                Возвращено: <strong>{formatCount(returnedQty)} {normalizeDisplayBaseUnit(item?.unit || item?.baseUnitNameSnapshot || item?.baseUnitName || 'шт')}</strong>
                              </span>
                              <span className="text-slate-500">
                                Осталось: <strong className="text-slate-700">{formatCount(remainingQty)}</strong>
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/90 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-3.5 py-2.5 w-10 text-center">№</th>
                          <th className="px-3.5 py-2.5">Товар</th>
                          <th className="px-3.5 py-2.5 text-center">Количество</th>
                          <th className="px-3.5 py-2.5 text-right">Цена за ед.</th>
                          <th className="px-3.5 py-2.5 text-right">Итоговая сумма</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedInvoice.items.map((item: any, idx: number) => {
                          const quantityInfo = getInvoiceItemQuantityParts(item);
                          const returnedQty = getInvoiceItemReturnedQty(item);
                          const remainingQty = getReturnItemRemainingUnits(item);

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-3.5 py-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                              <td className="px-3.5 py-3">
                                <p className="font-bold text-slate-900 leading-snug">{formatProductName(item.product_name)}</p>
                              </td>
                              <td className="whitespace-nowrap px-3.5 py-3 text-center">
                                <p className="text-xs font-bold text-slate-800">{quantityInfo.primary}</p>
                                {quantityInfo.secondary && (
                                  <p className="mt-0.5 text-[9px] text-slate-400 font-medium">{quantityInfo.secondary}</p>
                                )}
                                {returnedQty > PAYMENT_EPSILON && (
                                  <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px]">
                                    <span className="font-bold text-amber-800">Возврат: {formatCount(returnedQty)}</span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-500">Остаток: {formatCount(remainingQty)}</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-3.5 py-3 text-right font-mono font-medium text-slate-700">{formatMoney(item.sellingPrice)}</td>
                              <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900 text-xs">{formatMoney(item.totalPrice)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Requisites Block */}
                <div className="flex justify-end pt-1">
                  <div className="w-full sm:max-w-96 rounded-2xl border border-slate-200/90 bg-white p-4 text-xs space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-100">
                      <span className="font-medium">Подытог ({selectedInvoice.items?.length || 0} поз.)</span>
                      <span className="font-bold font-mono text-slate-900">{formatMoney(getInvoiceSubtotal(selectedInvoice))}</span>
                    </div>

                    {Number(selectedInvoice.discount || 0) > 0 && (
                      <div className="flex items-center justify-between text-amber-700">
                        <span className="font-medium">Скидка ({selectedInvoice.discount}%)</span>
                        <span className="font-bold font-mono">-{formatMoney(getInvoiceDiscountAmount(selectedInvoice))}</span>
                      </div>
                    )}

                    {Number(selectedInvoice.returnedAmount || 0) > 0 && (
                      <div className="flex items-center justify-between text-rose-600">
                        <span className="font-medium">Возвращено</span>
                        <span className="font-bold font-mono">-{formatMoney(selectedInvoice.returnedAmount || 0)}</span>
                      </div>
                    )}

                    {getInvoiceChangeAmount(selectedInvoice) > PAYMENT_EPSILON && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-medium">Сдача клиенту</span>
                        <span className="font-bold font-mono text-amber-600">{formatMoney(getInvoiceChangeAmount(selectedInvoice))}</span>
                      </div>
                    )}

                    {/* Highlighted Net Amount */}
                    <div className="rounded-xl bg-linear-to-r from-slate-900 to-slate-800 text-white p-3 flex items-center justify-between shadow-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Итого к оплате</p>
                        <p className="text-[9px] text-slate-400">с учётом скидок и возвратов</p>
                      </div>
                      <span className="font-mono text-lg font-black tracking-tight text-white">
                        {formatMoney(getInvoiceNetAmount(selectedInvoice))}
                      </span>
                    </div>

                    {/* Payment & Debt Split */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-medium flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          Оплачено:
                        </span>
                        <span className="font-mono font-bold text-emerald-600">{formatMoney(getInvoiceAppliedPaidAmount(selectedInvoice))}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="font-bold text-slate-700">Остаток (Долг):</span>
                        <span
                          className={clsx(
                            'font-mono font-black text-sm px-2 py-0.5 rounded-md',
                            getInvoiceBalance(selectedInvoice) > PAYMENT_EPSILON
                              ? 'bg-rose-50 text-rose-600 border border-rose-200/80'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200/80',
                          )}
                        >
                          {formatMoney(getInvoiceBalance(selectedInvoice))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payments Section */}
                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 px-0.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                        <Banknote size={12} />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        История платежей
                      </h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold font-mono text-slate-600 border border-slate-200/70">
                        {selectedInvoice.payments.length}
                      </span>
                    </div>

                    {/* Mobile Payments Cards */}
                    <div className="space-y-2 md:hidden">
                      {selectedInvoice.payments.map((p: any) => {
                        const isRefund = Number(p.amount || 0) < 0;
                        return (
                          <div
                            key={p.id}
                            className={clsx(
                              'flex items-center justify-between rounded-2xl border p-3 shadow-2xs',
                              isRefund ? 'border-rose-200/80 bg-rose-50/40' : 'border-slate-200/90 bg-white',
                            )}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={clsx('font-mono text-xs font-black', isRefund ? 'text-rose-600' : 'text-emerald-600')}>
                                  {isRefund ? '−' : '+'}{formatMoney(Math.abs(Number(p.amount || 0)))}
                                </span>
                                {isRefund && (
                                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                                    Возврат
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[10px] text-slate-400">
                                {new Date(p.createdAt).toLocaleString('ru-RU')} • <span className="font-medium text-slate-600">{p.staff_name}</span>
                              </p>
                            </div>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => void handleCancelPayment(p)}
                                disabled={cancellingPaymentId === Number(p.id)}
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 active:scale-95 disabled:opacity-50 transition-all shadow-2xs"
                              >
                                <X size={12} />
                                <span>{cancellingPaymentId === Number(p.id) ? '...' : 'Отменить'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Payments Table */}
                    <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/90 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="px-3.5 py-2.5">Дата и время</th>
                            <th className="px-3.5 py-2.5">Сумма платежа</th>
                            <th className="px-3.5 py-2.5">Кассир / Сотрудник</th>
                            <th className="px-3.5 py-2.5 text-right">Действие</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedInvoice.payments.map((p: any) => {
                            const isRefund = Number(p.amount || 0) < 0;
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-3.5 py-2.5 text-slate-500 font-mono">{new Date(p.createdAt).toLocaleString('ru-RU')}</td>
                                <td className={clsx('px-3.5 py-2.5 font-bold font-mono', isRefund ? 'text-rose-600' : 'text-emerald-600')}>
                                  {isRefund ? '−' : '+'}{formatMoney(Math.abs(Number(p.amount || 0)))}
                                  {isRefund && <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-600 border border-rose-200">Возврат</span>}
                                </td>
                                <td className="px-3.5 py-2.5 font-medium text-slate-700">{p.staff_name}</td>
                                <td className="px-3.5 py-2.5 text-right">
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => void handleCancelPayment(p)}
                                      disabled={cancellingPaymentId === Number(p.id)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-600 transition-all hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <X size={11} />
                                      {cancellingPaymentId === Number(p.id) ? 'Отмена...' : 'Отменить'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Returned Goods Section */}
                {getInvoiceReturnedItems(selectedInvoice).length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 px-0.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                        <RotateCcw size={12} />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Возвращенные товары</h4>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {getInvoiceReturnedItems(selectedInvoice).map((item: any) => {
                        const returnedQty = getInvoiceItemReturnedQty(item);
                        const remainingQty = getReturnItemRemainingUnits(item);
                        const unitName = normalizeDisplayBaseUnit(item?.unit || item?.baseUnitNameSnapshot || item?.baseUnitName || 'шт');

                        return (
                          <div key={`returned-item-${item.id}`} className="rounded-2xl border border-amber-200/90 bg-linear-to-br from-amber-50/60 to-white p-3 shadow-2xs space-y-2">
                            <p className="wrap-break-word text-xs font-bold text-slate-900 leading-snug">{getReturnItemDisplayName(item)}</p>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="rounded-xl border border-amber-200/60 bg-white px-2.5 py-2 text-center">
                                <p className="text-[8px] font-bold uppercase tracking-wider text-amber-700">Возвращено</p>
                                <p className="mt-0.5 font-bold text-rose-600 font-mono text-xs">{formatCount(returnedQty)} {unitName}</p>
                              </div>
                              <div className="rounded-xl border border-slate-200/70 bg-white px-2.5 py-2 text-center">
                                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Осталось</p>
                                <p className="mt-0.5 font-bold text-slate-700 font-mono text-xs">{formatCount(remainingQty)} {unitName}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Returns History Section */}
                {selectedInvoice.returns && selectedInvoice.returns.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 px-0.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                        <RotateCcw size={12} />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        История возвратов
                      </h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold font-mono text-slate-600 border border-slate-200/70">
                        {selectedInvoice.returns.length}
                      </span>
                    </div>

                    {/* Mobile Returns Cards */}
                    <div className="space-y-2 md:hidden">
                      {selectedInvoice.returns.map((r: any) => (
                        <div key={r.id} className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-black text-rose-600">-{formatMoney(r.totalValue)}</span>
                            <span className="text-[10px] font-mono text-slate-400">{new Date(r.createdAt).toLocaleString('ru-RU')}</span>
                          </div>
                          {r.reason && (
                            <p className="text-[11px] text-slate-700 bg-white/70 p-2 rounded-xl border border-amber-100">
                              <span className="font-bold text-slate-500">Причина:</span> {formatTransactionReason(r.reason)}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400">Сотрудник: <span className="font-medium text-slate-600">{r.staff_name}</span></p>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Returns Table */}
                    <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/90 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="px-3.5 py-2.5">Дата и время</th>
                            <th className="px-3.5 py-2.5">Сумма возврата</th>
                            <th className="px-3.5 py-2.5">Причина</th>
                            <th className="px-3.5 py-2.5">Сотрудник</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedInvoice.returns.map((r: any) => (
                            <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-3.5 py-2.5 text-slate-500 font-mono">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
                              <td className="px-3.5 py-2.5 font-bold font-mono text-rose-600">-{formatMoney(r.totalValue)}</td>
                              <td className="max-w-xs wrap-break-word px-3.5 py-2.5 text-slate-600">{formatTransactionReason(r.reason)}</td>
                              <td className="px-3.5 py-2.5 font-medium text-slate-700">{r.staff_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Sticky Modal Footer */}
              <div className="flex items-center justify-between gap-2.5 border-t border-slate-100 bg-white px-4 py-3 sm:px-6 shadow-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintInvoice(selectedInvoice)}
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    <Printer size={15} />
                    <span>Печать</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      void openReturnInvoiceModal(selectedInvoice);
                    }}
                    disabled={isReturnActionDisabled(selectedInvoice)}
                    title="Возврат"
                    aria-label="Возврат"
                    className={clsx(
                      'flex h-10 w-10 items-center justify-center rounded-xl border transition-all shadow-2xs active:scale-95 shrink-0',
                      isReturnActionDisabled(selectedInvoice)
                        ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                        : 'border-amber-200/90 bg-amber-50/90 text-amber-700 hover:bg-amber-500 hover:text-white hover:border-amber-500',
                    )}
                  >
                    <RotateCcw size={17} />
                  </button>

                  {getInvoiceBalance(selectedInvoice) > PAYMENT_EPSILON && !isPaymentActionDisabled(selectedInvoice) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentAmount(String(toFixedNumber(getInvoiceBalance(selectedInvoice))));
                        setShowPaymentModal(true);
                      }}
                      title="Оплата"
                      aria-label="Оплата"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-emerald-600 active:scale-95 transition-all shrink-0"
                    >
                      <Banknote size={18} />
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteInvoice(selectedInvoice);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200/90 bg-rose-50/80 text-rose-600 shadow-2xs hover:bg-rose-500 hover:text-white hover:border-rose-500 active:scale-95 transition-all shrink-0"
                      title="Удалить накладную"
                      aria-label="Удалить накладную"
                    >
                      <Trash2 size={17} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={closeDetailsModal}
                    className="h-10 rounded-xl border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 active:scale-95 transition-all"
                  >
                    Закрыть
                  </button>
                </div>
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
            className="fixed inset-0 z-60 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-3"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-2xl sm:max-h-[86vh]"
            >
              {/* Mobile Grab Handle */}
              <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
                <div className="h-1 w-10 rounded-full bg-slate-300" />
              </div>

              {/* Compact Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3.5 py-2.5 sm:px-5 sm:py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-blue-600 text-white shadow-xs">
                    <Pencil size={15} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                      Изменить накладную
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px] sm:max-w-md">
                      №{selectedInvoice.id} {selectedInvoice.customer_name ? `· ${selectedInvoice.customer_name}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all"
                  title="Закрыть"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/50 p-2.5 sm:p-4">
                {/* Compact Customer & Invoice Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-2xs">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-600 shrink-0">Клиент:</span>
                    <select
                      value={editCustomerId}
                      onChange={(e) => setEditCustomerId(e.target.value ? Number(e.target.value) : '')}
                      className="h-8 w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 text-xs font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                    >
                      <option value="">Без названия</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                    Переносятся накладная, оплаты и возвраты
                  </span>
                </div>

                {/* Items Toolbar */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">Товары</span>
                    <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {editInvoiceItems.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-36 sm:w-56">
                      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={editInvoiceSearch}
                        onChange={(e) => setEditInvoiceSearch(e.target.value)}
                        placeholder="Поиск товара..."
                        className="h-7.5 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addEditInvoiceItem}
                      className="inline-flex h-7.5 shrink-0 items-center justify-center gap-1 rounded-lg bg-slate-900 px-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 active:scale-95 transition-all"
                    >
                      <Plus size={13} />
                      <span className="hidden sm:inline">Добавить</span>
                    </button>
                  </div>
                </div>

                {/* Products List */}
                <div className="space-y-2">
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

                    const q = Math.max(0, Number(item.quantity || 0));
                    const p = Math.max(0, Number(item.sellingPrice || 0));
                    const d = Math.max(0, Number(item.discount || 0));
                    const lineTotal = q * ceilMoney(p * (1 - d / 100));

                    return (
                      <div
                        key={item.key}
                        className={clsx(
                          'relative rounded-xl border p-2.5 shadow-2xs transition-all space-y-2',
                          item.isNew
                            ? 'border-indigo-200 bg-indigo-50/20'
                            : 'border-slate-200/80 bg-white hover:border-slate-300',
                          openEditProductMenuKey === item.key && 'z-30'
                        )}
                      >
                        {/* Top Line: Index, Product Selector, Delete */}
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center font-mono text-[11px] font-bold text-slate-400 shrink-0">
                            #{index + 1}
                          </span>
                          {item.isNew && (
                            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-indigo-700 shrink-0">
                              Новая
                            </span>
                          )}

                          {/* Product Dropdown Trigger */}
                          <div className="relative flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenEditProductMenuKey((current) => {
                                  const nextKey = current === item.key ? null : item.key;
                                  setEditProductMenuSearch('');
                                  return nextKey;
                                });
                              }}
                              className="flex h-8 w-full items-center justify-between rounded-lg border border-slate-200/90 bg-slate-50/70 px-2.5 text-left text-xs font-bold text-slate-900 transition-all hover:bg-slate-100 focus:bg-white focus:border-indigo-500 shadow-2xs"
                            >
                              <span className="truncate">
                                {selectedProduct ? formatProductName(selectedProduct.name) : 'Выберите товар из списка...'}
                              </span>
                              <ChevronDown size={14} className="shrink-0 text-slate-400 ml-1.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {openEditProductMenuKey === item.key && (
                              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                                <div className="border-b border-slate-100 bg-slate-50 p-2">
                                  <div className="relative">
                                    <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                      type="text"
                                      value={editProductMenuSearch}
                                      onChange={(e) => setEditProductMenuSearch(e.target.value)}
                                      placeholder="Поиск товара..."
                                      className="h-7.5 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div className="max-h-52 overflow-y-auto py-1 divide-y divide-slate-50">
                                  {visibleEditProducts.map((product, productIndex) => {
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
                                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-indigo-50/70"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-bold text-slate-900">
                                            <span className="text-slate-400 mr-1.5 font-normal">#{productIndex + 1}</span>
                                            {formatProductName(product.name)}
                                          </p>
                                        </div>
                                        <span className="shrink-0 text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                          {stockInfo.primary}
                                        </span>
                                      </button>
                                    );
                                  })}
                                  {!visibleEditProducts.length && (
                                    <div className="px-4 py-4 text-center text-xs font-medium text-slate-400">
                                      Ничего не найдено
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Inline Stock hint */}
                          {selectedProduct && (
                            <span className="hidden sm:inline-flex shrink-0 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                              Склад: {getProductStockParts(selectedProduct as EditProductOption).primary}
                            </span>
                          )}

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => removeEditInvoiceItem(item.key)}
                            disabled={editInvoiceItems.length === 1}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Убрать товар"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Bottom Line: Mode, Quantities, Price, Discount, Total */}
                        <div className="grid grid-cols-2 sm:flex sm:items-center sm:gap-2 gap-2 pt-0.5">
                          {/* Sale Mode Selector */}
                          <div className="sm:w-28 shrink-0">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              Тип
                            </label>
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
                              className="h-7.5 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 text-xs font-bold text-slate-900 outline-none transition-all focus:bg-white focus:border-indigo-500 shadow-2xs disabled:opacity-40"
                            >
                              <option value="piece">Розница</option>
                              {getEditItemDefaultBulkPackaging(item) && (
                                <option value="bulk">Оптом</option>
                              )}
                            </select>
                          </div>

                          {/* Quantity Inputs */}
                          {item.selectedPackagingId ? (
                            <div className="flex items-center gap-1 sm:w-44 shrink-0">
                              <div className="flex-1 min-w-0">
                                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
                                  Упак
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={maxPackageCount}
                                  step="1"
                                  value={item.packageQuantityInput}
                                  onChange={(e) => updateNormalizedEditInvoiceItem(item.key, { packageQuantityInput: e.target.value })}
                                  placeholder="Упак"
                                  disabled={!selectedProduct}
                                  className="h-7.5 w-full rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 shadow-2xs disabled:opacity-40"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
                                  +Шт
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={itemMaxAllowedQuantity}
                                  step="1"
                                  value={item.extraUnitQuantityInput}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const intV = v === '' ? '' : String(Math.max(0, Math.floor(Number(v) || 0)));
                                    updateNormalizedEditInvoiceItem(item.key, { extraUnitQuantityInput: intV });
                                  }}
                                  placeholder="+Шт"
                                  disabled={!selectedProduct}
                                  className="h-7.5 w-full rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 shadow-2xs disabled:opacity-40"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="sm:w-32 shrink-0">
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                Кол-во ({item.baseUnitName || 'шт'})
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={itemMaxAllowedQuantity}
                                step="1"
                                value={item.extraUnitQuantityInput}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const intV = v === '' ? '' : String(Math.max(0, Math.floor(Number(v) || 0)));
                                  updateNormalizedEditInvoiceItem(item.key, { extraUnitQuantityInput: intV });
                                }}
                                placeholder="Кол-во"
                                disabled={!selectedProduct}
                                className="h-7.5 w-full rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 shadow-2xs disabled:opacity-40"
                              />
                            </div>
                          )}

                          {/* Price Input */}
                          <div className="sm:w-28 shrink-0">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              Цена (TJS)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.sellingPrice}
                              onChange={(e) => updateNormalizedEditInvoiceItem(item.key, { sellingPrice: e.target.value })}
                              placeholder="Цена"
                              disabled={!selectedProduct}
                              className="h-7.5 w-full rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 shadow-2xs disabled:opacity-40"
                            />
                          </div>

                          {/* Discount Input */}
                          <div className="sm:w-20 shrink-0">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              Скидка %
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={item.discount}
                              onChange={(e) => {
                                const value = e.target.value;
                                updateNormalizedEditInvoiceItem(item.key, {
                                  discount: value === '' ? '' : String(Math.max(0, Math.min(100, Number(value) || 0))),
                                });
                              }}
                              placeholder="0%"
                              disabled={!selectedProduct}
                              className="h-7.5 w-full rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 shadow-2xs disabled:opacity-40"
                            />
                          </div>

                          {/* Row Total */}
                          <div className="col-span-2 sm:col-span-1 sm:ml-auto sm:text-right shrink-0">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              Итого
                            </label>
                            <div className="h-7.5 flex items-center justify-end px-2.5 rounded-lg bg-emerald-50 border border-emerald-200/80 font-mono text-xs font-black text-emerald-800 whitespace-nowrap shadow-2xs">
                              {formatMoney(lineTotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!filteredEditInvoiceItems.length && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                      Товары в накладной не найдены.
                    </div>
                  )}
                </div>

                {/* Compact Financial Summary Strip */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-600 font-semibold">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mr-1.5">Строк:</span>
                        <span className="font-bold text-slate-900">{editInvoiceItems.length}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mr-1.5">Сумма:</span>
                        <span className="font-mono font-bold text-slate-900">{formatMoney(editInvoiceSubtotal)}</span>
                      </div>
                      {Number(selectedInvoice?.tax || 0) > 0 && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1.5">Налог:</span>
                          <span className="font-mono font-bold text-slate-700">+{formatMoney(editInvoiceTaxAmount)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Скидка накладной:</span>
                        <div className="relative w-16">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editDiscount}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEditDiscount(value === '' ? '' : String(Math.max(0, Math.min(100, Number(value) || 0))));
                            }}
                            className="h-7 w-full rounded-md border border-slate-200 bg-slate-50 px-1.5 text-center font-mono text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-400"
                            placeholder="0"
                          />
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200/90 px-2.5 py-1 text-emerald-950">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">К оплате:</span>
                        <span className="font-mono text-xs sm:text-sm font-black text-emerald-800">{formatMoney(editInvoiceNetAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-3.5 py-2 sm:px-5 sm:py-2.5">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="h-8.5 rounded-lg border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all text-center"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleUpdateInvoice}
                  disabled={isSavingEdit}
                  className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 text-xs font-black uppercase tracking-wider text-white shadow-xs active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <span>Сохранить</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentModal && selectedInvoice && (() => {
          const totalAmount = getInvoiceNetAmount(selectedInvoice);
          const balance = getInvoiceBalance(selectedInvoice);
          const numericAmount = Number(paymentAmount) || 0;
          const alreadyPaid = Math.max(0, totalAmount - balance);
          const remainingAfterPayment = Math.max(0, balance - numericAmount);
          const isFullSettlement = balance > 0 && Math.abs(numericAmount - balance) < 0.01;
          const isOverPayment = numericAmount > balance + 0.01;
          const isPartialPayment = numericAmount > 0 && numericAmount < balance - 0.01;
          const paidPercent = totalAmount > 0 ? Math.min(100, Math.round((alreadyPaid / totalAmount) * 100)) : 0;
          const projectedPaidPercent = totalAmount > 0 ? Math.min(100, Math.round(((alreadyPaid + numericAmount) / totalAmount) * 100)) : 0;

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePaymentModal}
              className="fixed inset-0 z-60 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-3"
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 12 }}
                transition={{ type: 'spring', damping: 26, stiffness: 340 }}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[92vh] sm:max-h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-2xl"
              >
                {/* Mobile Grab Handle */}
                <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
                  <div className="h-1 w-10 rounded-full bg-slate-300" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3.5 py-2.5 sm:px-5 sm:py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-xs">
                      <Banknote size={15} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                        Принять оплату
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px] sm:max-w-xs mt-0.5">
                        Накладная №{selectedInvoice.id} {selectedInvoice.customer_name ? `· ${selectedInvoice.customer_name}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closePaymentModal}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all"
                    title="Закрыть"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Body */}
                <div className="space-y-2.5 overflow-y-auto p-3 sm:p-4 bg-slate-50/40">
                  {/* Financial Overview Card */}
                  <div className="rounded-xl border border-emerald-100/90 bg-linear-to-br from-emerald-50/35 via-white to-emerald-50/15 p-2.5 sm:p-3 space-y-2 shadow-2xs">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
                          Сумма
                        </p>
                        <p className="font-mono text-xs sm:text-sm font-black text-slate-800 truncate">
                          {formatMoney(totalAmount)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
                          Оплачено
                        </p>
                        <p className="font-mono text-xs sm:text-sm font-black text-emerald-700 truncate">
                          {formatMoney(alreadyPaid)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-rose-200/80 bg-rose-50/80 p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-rose-600 mb-0.5 truncate">
                          Долг
                        </p>
                        <p className="font-mono text-xs sm:text-sm font-black text-rose-700 truncate">
                          {formatMoney(balance)}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">
                          Прогресс оплаты: <strong className="text-slate-800">{paidPercent}%</strong>
                          {projectedPaidPercent > paidPercent && (
                            <span className="text-emerald-600 ml-1">→ {projectedPaidPercent}%</span>
                          )}
                        </span>
                        <span className="font-mono text-slate-400">
                          {formatMoney(alreadyPaid + numericAmount)} / {formatMoney(totalAmount)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                          style={{ width: `${paidPercent}%` }}
                        />
                        {projectedPaidPercent > paidPercent && (
                          <div
                            className="h-full bg-teal-400 transition-all duration-300 animate-pulse"
                            style={{ width: `${Math.max(0, projectedPaidPercent - paidPercent)}%` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Payment Amount Input Card */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        Сумма к внесению (TJS) <span className="text-emerald-600">*</span>
                      </label>
                      {balance > 0 && (
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(String(toFixedNumber(balance)))}
                          className="text-[10px] font-black text-emerald-700 hover:text-emerald-800 underline transition-colors"
                        >
                          Вся сумма
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPaymentAmount(value === '' ? '' : String(Math.max(0, Number(value) || 0)));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isPaying && numericAmount > 0 && !isOverPayment) {
                            e.preventDefault();
                            handlePayment();
                          }
                        }}
                        className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-3.5 pr-12 font-mono text-xl sm:text-2xl font-black text-slate-950 outline-none transition-all shadow-2xs focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 placeholder:text-slate-300"
                        placeholder="0.00"
                        autoFocus
                      />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-400">
                        TJS
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {balance > 0 && (
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(String(toFixedNumber(balance)))}
                          className="h-7 flex-1 min-w-[120px] rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-600 hover:text-white transition-all active:scale-95 text-center truncate"
                        >
                          Полная ({formatMoney(balance)})
                        </button>
                      )}
                      {balance > 10 && (
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(String(toFixedNumber(ceilMoney(balance / 2, 2))))}
                          className="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-900 hover:text-white transition-all active:scale-95 text-center"
                          title="50% долга"
                        >
                          50%
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPaymentAmount('')}
                        className="h-7 rounded-lg border border-slate-200/80 bg-white px-2.5 text-xs font-bold text-slate-400 shadow-2xs hover:bg-slate-100 hover:text-slate-700 transition-all active:scale-95 text-center"
                        title="Очистить"
                      >
                        Очистить
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Status Feedback */}
                  {isFullSettlement && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 p-2.5 text-xs font-bold text-emerald-800 shadow-2xs">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span>Накладная будет полностью оплачена (долг 0 TJS)</span>
                    </div>
                  )}

                  {isPartialPayment && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 text-xs font-medium text-slate-600 shadow-2xs">
                      <span className="text-slate-500">Остаток долга после оплаты:</span>
                      <span className="font-mono font-black text-rose-600 tabular-nums">
                        {formatMoney(remainingAfterPayment)} TJS
                      </span>
                    </div>
                  )}

                  {isOverPayment && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/90 p-2.5 text-xs font-semibold text-rose-800 shadow-2xs">
                      <AlertCircle size={15} className="text-rose-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="leading-tight">Сумма превышает долг на <span className="font-mono font-black">{formatMoney(numericAmount - balance)} TJS</span></p>
                        <p className="text-[10px] text-rose-600/80 font-normal mt-0.5">Максимальная сумма к оплате: {formatMoney(balance)} TJS</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-3.5 py-2 sm:px-5 sm:py-2.5 shadow-xs">
                  <button
                    type="button"
                    onClick={closePaymentModal}
                    className="h-8.5 rounded-lg border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all text-center"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={isPaying || !paymentAmount || numericAmount <= 0 || isOverPayment}
                    className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 text-xs font-black uppercase tracking-wider text-white shadow-xs active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isPaying ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Сохранение...</span>
                      </>
                    ) : (
                      <>
                        <Banknote size={14} />
                        <span>Принять {numericAmount > 0 ? `${formatMoney(numericAmount)} TJS` : 'оплату'}</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {showReturnModal && selectedInvoice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseReturnModal}
            className="fixed inset-0 z-60 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          >
            <motion.div 
              initial={{ y: '100%', opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.6 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-2xl"
            >
              {/* Mobile Drag Indicator */}
              <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
                <div className="h-1.5 w-10 rounded-full bg-slate-300" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 shadow-2xs">
                    <RotateCcw size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                      Оформить возврат
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                      Накладная №{selectedInvoice.id} {selectedInvoice.customer_name ? `· ${selectedInvoice.customer_name}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseReturnModal}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all"
                  aria-label="Закрыть"
                >
                  <X size={19} />
                </button>
              </div>
              
              <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto bg-slate-50/50 p-3.5 sm:p-5">
                {/* Invoice summary strip */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-2xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Накладная</p>
                      <p className="mt-0.5 font-mono text-xs sm:text-sm font-bold text-slate-900">№{selectedInvoice.id}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Клиент</p>
                      <p className="mt-0.5 truncate text-xs sm:text-sm font-semibold text-slate-900" title={selectedInvoice.customer_name}>
                        {selectedInvoice.customer_name || 'Розничный покупатель'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Дата продажи</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-700">
                        {new Date(selectedInvoice.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Сумма накладной</p>
                      <p className="mt-0.5 font-mono text-xs sm:text-sm font-bold text-slate-900">
                        {formatMoney(selectedInvoice.netAmount ?? selectedInvoice.totalValue ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Return Items Section */}
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900">Товары для возврата</p>
                      <p className="text-[11px] sm:text-xs text-slate-500">Укажите количество для возврата на склад.</p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {returnItems.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={handleFillAllReturns}
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 active:scale-95"
                          >
                            <span>Вернуть всё</span>
                          </button>
                          {returnStats.activeCount > 0 && (
                            <button
                              type="button"
                              onClick={handleResetAllReturns}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
                            >
                              <span>Очистить</span>
                            </button>
                          )}
                        </>
                      )}
                      <span className="rounded-xl bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        {returnItems.length} поз.
                      </span>
                    </div>
                  </div>

                  {/* Search inside return items */}
                  {returnItems.length > 2 && (
                    <div className="relative">
                      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={returnSearch}
                        onChange={(e) => setReturnSearch(e.target.value)}
                        placeholder="Поиск товара по названию, артикулу..."
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  )}

                  {/* Cards List */}
                  <div className="space-y-2.5 sm:space-y-3">
                    {filteredReturnItems.map((item: ReturnInvoiceItem) => {
                      const originalIndex = returnItems.findIndex((entry) => entry.id === item.id);
                      const quantityInfo = getInvoiceItemQuantityParts(item);
                      const packaging = getReturnItemPackaging(item);
                      const remainingUnits = getReturnItemRemainingUnits(item);
                      const maxPackages = packaging ? Math.floor(remainingUnits / packaging.unitsPerPackage) : 0;
                      const inputMax = item.returnMode === 'package' ? maxPackages : remainingUnits;
                      const isFilled = Number(item.returnQty || 0) > 0;

                      const itemDiscount = Number(item.discount || 0);
                      const globalDiscount = Number(selectedInvoice?.discount || 0);
                      const basePrice = Number(item.sellingPrice ?? item.price ?? 0);
                      const unitPriceAfterDiscount = basePrice * (1 - itemDiscount / 100) * (1 - globalDiscount / 100);
                      const itemUnits = item.returnMode === 'package' && packaging
                        ? Number(item.returnQty || 0) * packaging.unitsPerPackage
                        : Number(item.returnQty || 0);
                      const lineRefund = unitPriceAfterDiscount * itemUnits;

                      return (
                        <div
                          key={item.id}
                          className={clsx(
                            'rounded-2xl border p-3 sm:p-3.5 transition-all shadow-2xs',
                            isFilled
                              ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-300/60 shadow-xs'
                              : 'border-slate-200/90 bg-white hover:border-slate-300'
                          )}
                        >
                          {/* Top Row: index & available badge */}
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Строка #{originalIndex + 1}
                              </span>
                              {item?.product?.sku && (
                                <span className="text-[10px] text-slate-400">· Арт: {item.product.sku}</span>
                              )}
                              {(item?.brandSnapshot || item?.product?.brand) && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">· {item.brandSnapshot || item.product.brand}</span>
                              )}
                            </div>

                            <span className={clsx(
                              'rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0',
                              isFilled ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                            )}>
                              Доступно: {packaging && maxPackages > 0 ? `${maxPackages} ${packaging.packageName} / ` : ''}{formatCount(remainingUnits)} {packaging?.baseUnitName || 'шт'}
                            </span>
                          </div>

                          {/* Product Title */}
                          <p className="wrap-break-word text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                            {getReturnItemDisplayName(item)}
                          </p>

                          {/* Financial strip */}
                          <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-center text-xs">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Продано</p>
                              <p className="mt-0.5 font-bold text-slate-800 text-[11px] sm:text-xs truncate">{quantityInfo.primary}</p>
                              {quantityInfo.secondary && (
                                <p className="mt-0.5 text-[9px] text-slate-400 truncate">{quantityInfo.secondary}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Цена за ед.</p>
                              <p className="mt-0.5 font-mono font-bold text-slate-800 text-[11px] sm:text-xs">{formatMoney(basePrice)}</p>
                              {(itemDiscount > 0 || globalDiscount > 0) && (
                                <p className="mt-0.5 text-[9px] text-emerald-600 font-medium truncate">со скидкой: {formatMoney(unitPriceAfterDiscount)}</p>
                              )}
                            </div>
                            <div className="border-l border-slate-200 pl-1">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">К возврату</p>
                              <p className={clsx("mt-0.5 font-mono font-bold text-[11px] sm:text-xs truncate", isFilled ? "text-rose-600" : "text-slate-400")}>
                                {isFilled ? `-${formatMoney(lineRefund)}` : '0 TJS'}
                              </p>
                              {isFilled && (
                                <p className="text-[9px] text-amber-700 font-medium truncate">
                                  {formatCount(itemUnits)} {packaging?.baseUnitName || 'шт'}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Controls Row */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
                            {packaging && (
                              <div className="w-full sm:w-48 shrink-0">
                                <select
                                  value={item.returnMode}
                                  onChange={(e) => updateReturnItemMode(item.id, e.target.value as 'package' | 'unit')}
                                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                >
                                  <option value="package">{packaging.packageName} ({packaging.unitsPerPackage} {packaging.baseUnitName})</option>
                                  <option value="unit">{packaging.baseUnitName}</option>
                                </select>
                              </div>
                            )}

                            <div className="relative flex-1 flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                max={inputMax}
                                value={item.returnQty}
                                onChange={(e) => updateReturnItemQty(item.id, e.target.value)}
                                placeholder={item.returnMode === 'package' ? `Кол-во ${packaging?.packageName || 'упаковок'}` : `Кол-во ${packaging?.baseUnitName || 'шт'}`}
                                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                              />

                              <button
                                type="button"
                                onClick={() => updateReturnItemQty(item.id, String(inputMax))}
                                disabled={inputMax <= 0}
                                className="h-9 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-40"
                                title="Вернуть максимум"
                              >
                                Макс ({inputMax})
                              </button>

                              {isFilled && (
                                <button
                                  type="button"
                                  onClick={() => updateReturnItemQty(item.id, '')}
                                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition-all"
                                  title="Сбросить"
                                >
                                  <X size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!filteredReturnItems.length && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs sm:text-sm text-slate-500">
                        {returnItems.length === 0
                          ? 'По этой накладной нет товаров, доступных для возврата.'
                          : 'По вашему запросу товары не найдены.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-2xs">
                  <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500">Позиций к возврату</p>
                      <p className="mt-0.5 text-sm sm:text-base font-bold text-slate-900">
                        {returnStats.activeCount} из {returnItems.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500">Всего единиц</p>
                      <p className="mt-0.5 text-sm sm:text-base font-bold text-slate-900">
                        {formatCount(returnStats.totalUnits)} шт
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500">Сумма возврата</p>
                      <p className="mt-0.5 font-mono text-sm sm:text-base font-bold text-rose-600">
                        {returnStats.totalRefund > 0 ? `-${formatMoney(returnStats.totalRefund)}` : '0 TJS'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-500 bg-amber-500 p-2.5 text-white shadow-xs">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-amber-100">Итого к возврату</p>
                      <p className="mt-0.5 font-mono text-sm sm:text-base font-bold text-white truncate">
                        {returnStats.totalRefund > 0 ? `-${formatMoney(returnStats.totalRefund)}` : '0 TJS'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reason Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-2xs">
                  <label className="text-xs sm:text-sm font-semibold text-slate-800">Причина возврата</label>
                  <textarea 
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    placeholder="Укажите причину возврата (брак, излишек, отказ покупателя)..."
                  />
                </div>
              </div>
              
              {/* Sticky Footer */}
              <div className="flex flex-row items-center justify-end gap-2 sm:gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-6 sm:py-3.5">
                <button 
                  type="button"
                  onClick={handleCloseReturnModal}
                  className="h-9 sm:h-10 px-3.5 sm:px-5 rounded-xl border border-slate-200/90 bg-white text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all shadow-2xs shrink-0"
                >
                  Отмена
                </button>
                <button 
                  type="button"
                  onClick={handleReturn}
                  disabled={isReturning || returnStats.totalUnits <= 0}
                  className="inline-flex h-9 sm:h-10 items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 px-3.5 sm:px-5 text-xs sm:text-sm font-bold text-white shadow-xs shadow-amber-500/20 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
                >
                  {isReturning ? (
                    <>
                      <Loader2 size={15} className="animate-spin shrink-0" />
                      <span className="truncate">Оформление...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={15} className="shrink-0" />
                      <span className="truncate">
                        {returnStats.totalRefund > 0
                          ? `Оформить возврат (${formatMoney(returnStats.totalRefund)})`
                          : 'Оформить возврат'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DeleteInvoiceModal
        isOpen={Boolean(invoiceToDelete)}
        onClose={closeDeleteInvoiceModal}
        invoice={invoiceToDelete}
        isDeleting={isDeletingInvoice}
        error={deleteInvoiceError}
        needsForceDelete={needsForceDelete}
        onConfirm={confirmDeleteInvoice}
      />
      </div>
    </div>
  );
}
