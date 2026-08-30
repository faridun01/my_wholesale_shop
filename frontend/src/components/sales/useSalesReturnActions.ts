import { useState } from 'react';
import type React from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import type { ReturnInvoiceItem } from './salesTypes';
import {
  createReturnInvoiceItems,
  getReturnItemPackaging,
  getReturnItemRemainingUnits,
  isReturnActionDisabled,
} from '../../utils/salesViewUtils';
import { formatMoney } from '../../utils/format';

type UseSalesReturnActionsOptions = {
  selectedInvoice: any;
  setSelectedInvoice: React.Dispatch<React.SetStateAction<any>>;
  refreshSelectedInvoice: (invoiceId: number) => Promise<any>;
  fetchInvoices: () => Promise<void>;
};

const useSalesReturnActions = ({
  selectedInvoice,
  setSelectedInvoice,
  refreshSelectedInvoice,
  fetchInvoices,
}: UseSalesReturnActionsOptions) => {
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [isReturning, setIsReturning] = useState(false);

  const closeReturnModal = () => {
    setShowReturnModal(false);
    setReturnReason('');
    setReturnItems([]);
  };

  const openReturnInvoiceModal = async (invoice: any) => {
    if (!invoice || isReturnActionDisabled(invoice)) {
      return;
    }

    try {
      const res = await client.get(`/invoices/${invoice.id}`);
      setSelectedInvoice(res.data);
      setReturnItems(createReturnInvoiceItems(res.data.items || []));
      setShowReturnModal(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при загрузке накладной');
    }
  };

  const handleReturn = async () => {
    if (!selectedInvoice || returnItems.length === 0) return;

    setIsReturning(true);
    try {
      const itemsToReturn = returnItems
        .map((item: ReturnInvoiceItem) => {
          const rawQuantity = Number(item.returnQty || 0);
          const packaging = getReturnItemPackaging(item);
          const quantity =
            item.returnMode === 'package' && packaging
              ? rawQuantity * packaging.unitsPerPackage
              : rawQuantity;

          return {
            invoiceItemId: Number(item.id),
            rawQuantity,
            quantity,
            item,
          };
        })
        .filter((item) => item.rawQuantity > 0);

      if (itemsToReturn.length === 0) {
        toast.error('Выберите товары для возврата');
        setIsReturning(false);
        return;
      }

      for (const item of itemsToReturn) {
        const remainingUnits = getReturnItemRemainingUnits(item.item);
        const packaging = getReturnItemPackaging(item.item);

        if (!Number.isFinite(item.rawQuantity) || item.rawQuantity <= 0) {
          toast.error('Введите корректное количество для возврата');
          setIsReturning(false);
          return;
        }

        if (item.item.returnMode === 'package') {
          const maxPackages = packaging ? Math.floor(remainingUnits / packaging.unitsPerPackage) : 0;
          if (!Number.isInteger(item.rawQuantity) || item.rawQuantity > maxPackages) {
            toast.error(`Можно вернуть не больше ${maxPackages} ${packaging?.packageName || 'упаковок'}`);
            setIsReturning(false);
            return;
          }
        } else if (item.quantity > remainingUnits) {
          toast.error(`Можно вернуть не больше ${remainingUnits} ${packaging?.baseUnitName || 'шт'}`);
          setIsReturning(false);
          return;
        }
      }

      const { data } = await client.post(`/invoices/${selectedInvoice.id}/return`, {
        items: itemsToReturn.map(({ invoiceItemId, quantity }) => ({ invoiceItemId, quantity })),
        reason: returnReason,
      });
      const cashRefundAmount = Number(data?.cashRefundAmount || 0);
      toast.success(
        cashRefundAmount > 0.009
          ? `Возврат оформлен. Верните клиенту наличными: ${formatMoney(cashRefundAmount)}`
          : 'Возврат оформлен',
        { duration: cashRefundAmount > 0.009 ? 6000 : 4000 },
      );
      closeReturnModal();
      await refreshSelectedInvoice(selectedInvoice.id);
      await fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при оформлении возврата');
    } finally {
      setIsReturning(false);
    }
  };

  return {
    showReturnModal,
    returnReason,
    returnItems,
    isReturning,
    setReturnReason,
    setReturnItems,
    closeReturnModal,
    openReturnInvoiceModal,
    handleReturn,
  };
};

export default useSalesReturnActions;
