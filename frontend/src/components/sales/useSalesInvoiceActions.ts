import React from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import {
  getEffectiveStatus,
  getInvoiceAppliedPaidAmount,
  getInvoiceBalance,
  getInvoiceChangeAmount,
  getInvoiceDiscountAmount,
  getInvoiceNetAmount,
  getInvoiceSubtotal,
} from '../../utils/salesViewUtils';

type UseSalesInvoiceActionsOptions = {
  selectedInvoice: any;
  setSelectedInvoice: React.Dispatch<React.SetStateAction<any>>;
  setShowDetailsModal: React.Dispatch<React.SetStateAction<boolean>>;
  closeDetailsModal: () => void;
  closeEditModal: () => void;
  closePaymentModal: () => void;
  closeReturnModal: () => void;
  fetchInvoices: () => Promise<void>;
  invoices?: any[];
};

const useSalesInvoiceActions = ({
  selectedInvoice,
  setSelectedInvoice,
  setShowDetailsModal,
  closeDetailsModal,
  closeEditModal,
  closePaymentModal,
  closeReturnModal,
  fetchInvoices,
  invoices = [],
}: UseSalesInvoiceActionsOptions) => {
  const [invoiceToDelete, setInvoiceToDelete] = React.useState<any | null>(null);
  const [isDeletingInvoice, setIsDeletingInvoice] = React.useState(false);
  const [deleteInvoiceError, setDeleteInvoiceError] = React.useState<string | null>(null);
  const [needsForceDelete, setNeedsForceDelete] = React.useState(false);

  const fetchInvoiceDetails = async (id: number) => {
    try {
      const res = await client.get(`/invoices/${id}`);
      setSelectedInvoice(res.data);
      setShowDetailsModal(true);
    } catch (err) {
      toast.error('Ошибка при загрузке деталей накладной');
    }
  };

  const handleDeleteInvoice = (target: any) => {
    if (!target) return;
    let inv = target;
    if (typeof target === 'number' || typeof target === 'string') {
      inv =
        invoices?.find((i: any) => Number(i.id) === Number(target)) ||
        (Number(selectedInvoice?.id) === Number(target) ? selectedInvoice : { id: Number(target) });
    }
    setInvoiceToDelete(inv);
    setDeleteInvoiceError(null);
    setNeedsForceDelete(false);
  };

  const closeDeleteInvoiceModal = () => {
    if (isDeletingInvoice) return;
    setInvoiceToDelete(null);
    setDeleteInvoiceError(null);
    setNeedsForceDelete(false);
  };

  const confirmDeleteInvoice = async (force = false) => {
    if (!invoiceToDelete) return;
    const id = invoiceToDelete.id;
    setIsDeletingInvoice(true);
    setDeleteInvoiceError(null);

    try {
      await client.delete(`/invoices/${id}${force ? '?force=true' : ''}`);
      toast.success('Накладная удалена');
      closeDeleteInvoiceModal();

      if (Number(selectedInvoice?.id) === Number(id)) {
        closeDetailsModal();
        closeEditModal();
        closePaymentModal();
        closeReturnModal();
        setSelectedInvoice(null);
      }
      await fetchInvoices();
    } catch (err: any) {
      const message = err.response?.data?.error || err?.message || 'Ошибка при удалении накладной';
      const isForceNeeded = !force && (message.includes('уже есть оплата') || message.includes('уже есть возврат'));

      if (isForceNeeded) {
        setNeedsForceDelete(true);
        setDeleteInvoiceError(message);
      } else {
        setDeleteInvoiceError(message);
        toast.error(message);
      }
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  const handlePrintInvoice = async (invoice: any) => {
    if (!invoice) {
      return;
    }

    const effectiveStatus = getEffectiveStatus(invoice);
    const statusLabel = invoice?.cancelled
      ? 'Отменена'
      : effectiveStatus === 'paid'
        ? 'Оплачено'
        : effectiveStatus === 'partial'
          ? 'Частично оплачено'
          : 'Не оплачено';

    const { printSalesInvoice } = await import('../../utils/print/salesInvoicePrint');
    const result = printSalesInvoice({
      invoice,
      statusLabel,
      subtotal: getInvoiceSubtotal(invoice),
      discountAmount: getInvoiceDiscountAmount(invoice),
      netAmount: getInvoiceNetAmount(invoice),
      balanceAmount: getInvoiceBalance(invoice),
      changeAmount: getInvoiceChangeAmount(invoice),
      appliedPaidAmount: getInvoiceAppliedPaidAmount(invoice),
    });

    if (!result.ok && result.reason === 'blocked') {
      toast.error('Разрешите всплывающие окна для печати накладной');
    }
  };

  const handleQuickPrintInvoice = async (invoiceId: number) => {
    try {
      const res = await client.get(`/invoices/${invoiceId}`);
      await handlePrintInvoice(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Ошибка при подготовке печати');
    }
  };

  return {
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
  };
};

export default useSalesInvoiceActions;
