import { useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { formatMoney, toFixedNumber } from '../../utils/format';
import { SALES_PAYMENT_EPSILON, getInvoiceBalance } from '../../utils/salesViewUtils';

type UseSalesPaymentActionsOptions = {
  selectedInvoice: any;
  refreshSelectedInvoice: (invoiceId: number) => Promise<any>;
  fetchInvoices: () => Promise<void>;
};

const useSalesPaymentActions = ({
  selectedInvoice,
  refreshSelectedInvoice,
  fetchInvoices,
}: UseSalesPaymentActionsOptions) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [cancellingPaymentId, setCancellingPaymentId] = useState<number | null>(null);

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAmount('');
  };

  const handlePayment = async () => {
    if (!selectedInvoice || !paymentAmount) return;

    const normalizedAmount = Number(paymentAmount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast.error('Сумма оплаты должна быть больше нуля');
      return;
    }

    const currentBalance = getInvoiceBalance(selectedInvoice);
    if (normalizedAmount > currentBalance + SALES_PAYMENT_EPSILON) {
      toast.error(`Сумма оплаты не может превышать остаток долга (${toFixedNumber(currentBalance)})`);
      return;
    }

    setIsPaying(true);
    try {
      await client.post('/payments', {
        customer_id: selectedInvoice.customerId,
        invoice_id: selectedInvoice.id,
        amount: normalizedAmount,
        method: 'cash',
        // Lets the backend dedupe a network retry of this exact submit instead of
        // double-applying the payment.
        idempotency_key: crypto.randomUUID(),
      });
      toast.success('Оплата принята');
      closePaymentModal();
      await refreshSelectedInvoice(selectedInvoice.id);
      await fetchInvoices();
    } catch (err) {
      toast.error('Ошибка при приёме оплаты');
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancelPayment = async (payment: any) => {
    if (!selectedInvoice || !payment?.id) return;

    const amountLabel = formatMoney(payment.amount || 0);
    if (!window.confirm(`Отменить оплату ${amountLabel}? Долг по накладной будет пересчитан.`)) {
      return;
    }

    setCancellingPaymentId(Number(payment.id));
    try {
      await client.delete(`/payments/${payment.id}`);
      toast.success('Оплата отменена');
      await refreshSelectedInvoice(selectedInvoice.id);
      await fetchInvoices();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при отмене оплаты');
    } finally {
      setCancellingPaymentId(null);
    }
  };

  return {
    showPaymentModal,
    setShowPaymentModal,
    paymentAmount,
    setPaymentAmount,
    isPaying,
    cancellingPaymentId,
    closePaymentModal,
    handlePayment,
    handleCancelPayment,
  };
};

export default useSalesPaymentActions;
