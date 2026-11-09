import { financialPost } from '../../api/financialRequest';
import { useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { formatMoney, parseMoneyInput, toFixedNumber } from '../../utils/format';
import { SALES_PAYMENT_EPSILON, getInvoiceAmountToReturn, getInvoiceBalance } from '../../utils/salesViewUtils';
import type { GiveBackMethod } from './GiveBackModal';

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
  const [showGiveBackModal, setShowGiveBackModal] = useState(false);
  const [giveBackAmount, setGiveBackAmount] = useState('');
  const [giveBackMethod, setGiveBackMethod] = useState<GiveBackMethod>('cash');
  const [isGivingBack, setIsGivingBack] = useState(false);

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAmount('');
  };

  const handlePayment = async () => {
    if (!selectedInvoice || !paymentAmount) return;

    const normalizedAmount = parseMoneyInput(paymentAmount);
    if (normalizedAmount === null || normalizedAmount <= 0) {
      toast.error('Сумма оплаты должна быть больше нуля');
      return;
    }

    const currentBalance = getInvoiceBalance(selectedInvoice);
    if (normalizedAmount > currentBalance) {
      toast.error(`Сумма оплаты не может превышать остаток долга (${toFixedNumber(currentBalance)})`);
      return;
    }

    setIsPaying(true);
    try {
      await financialPost('/payments', {
        customer_id: selectedInvoice.customerId,
        invoice_id: selectedInvoice.id,
        amount: normalizedAmount,
        method: 'cash',
        // Lets the backend dedupe a network retry of this exact submit instead of
        // double-applying the payment.
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

  const openGiveBackModal = (amountToReturn: number) => {
    setGiveBackAmount(String(toFixedNumber(amountToReturn)));
    setGiveBackMethod('cash');
    setShowGiveBackModal(true);
  };

  const closeGiveBackModal = () => {
    setShowGiveBackModal(false);
    setGiveBackAmount('');
  };

  const handleGiveBack = async () => {
    if (!selectedInvoice) return;

    const normalizedAmount = parseMoneyInput(giveBackAmount);
    if (normalizedAmount === null || normalizedAmount <= 0) {
      toast.error('Сумма должна быть больше нуля');
      return;
    }

    const amountToReturn = getInvoiceAmountToReturn(selectedInvoice);
    if (normalizedAmount > amountToReturn) {
      toast.error(`Нельзя выдать больше ${toFixedNumber(amountToReturn)}`);
      return;
    }

    setIsGivingBack(true);
    try {
      await financialPost('/payments/give-back', {
        invoice_id: selectedInvoice.id,
        amount: normalizedAmount,
        method: giveBackMethod,
      });
      toast.success(`Выдача записана: ${formatMoney(normalizedAmount)}`);
      closeGiveBackModal();
      await refreshSelectedInvoice(selectedInvoice.id);
      await fetchInvoices();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при записи выдачи');
    } finally {
      setIsGivingBack(false);
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
    showGiveBackModal,
    giveBackAmount,
    setGiveBackAmount,
    giveBackMethod,
    setGiveBackMethod,
    isGivingBack,
    openGiveBackModal,
    closeGiveBackModal,
    handleGiveBack,
  };
};

export default useSalesPaymentActions;
