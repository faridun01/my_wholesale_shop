import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, Filter, Pencil, Plus, RotateCcw, Search, Trash2, Wallet, Warehouse, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { addExpensePayment, addExpenseRefund, cancelExpensePayment, createExpense, deleteExpense, getExpenses, updateExpense } from '../api/expenses.api';
import { getWarehouses } from '../api/warehouses.api';
import ConfirmationModal from '../components/common/ConfirmationModal';
import PaginationControls from '../components/common/PaginationControls';
import { formatMoney, roundMoney } from '../utils/format';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { getDefaultWarehouseId } from '../utils/warehouse';

type ExpenseRow = {
  id: number;
  title: string;
  category: string;
  amount: number;
  paidAmount: number;
  expenseDate: string;
  note?: string | null;
  warehouse?: { id: number; name: string };
  user?: { id: number; username: string };
  userId?: number;
  payments?: Array<{
    id: number;
    amount: number;
    paymentDate: string;
    method?: string;
    note?: string | null;
    staff_name?: string;
    user?: { id: number; username: string };
  }>;
};

const categories = ['Аренда', 'Зарплата', 'Доставка', 'Транспорт', 'Коммунальные', 'Ремонт', 'Прочее'];
const todayValue = new Date().toISOString().slice(0, 10);

const buildExpenseFormState = (expense?: Partial<ExpenseRow> | null, preferredWarehouseId = '') => ({
  warehouseId: expense?.warehouse?.id ? String(expense.warehouse.id) : preferredWarehouseId,
  title: String(expense?.title || ''),
  category: String(expense?.category || 'Прочее') || 'Прочее',
  amount: expense ? String(roundMoney(expense.amount || 0)) : '',
  paidAmount: expense ? String(roundMoney(expense.paidAmount || 0)) : '',
  paymentDate: todayValue,
  expenseDate: expense ? String(expense.expenseDate || '').slice(0, 10) || todayValue : todayValue,
  note: String(expense?.note || ''),
});

export default function ExpensesView() {
  const pageSize = 8;
  const user = React.useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(user);
  const userWarehouseId = getUserWarehouseId(user);

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(userWarehouseId ? String(userWarehouseId) : '');
  const [search, setSearch] = useState('');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [payingExpenseId, setPayingExpenseId] = useState<number | null>(null);
  const [cancellingPaymentId, setCancellingPaymentId] = useState<number | null>(null);
  const [selectedExpenseForPayment, setSelectedExpenseForPayment] = useState<ExpenseRow | null>(null);
  const [selectedExpenseForRefund, setSelectedExpenseForRefund] = useState<ExpenseRow | null>(null);
  const [selectedExpenseForDelete, setSelectedExpenseForDelete] = useState<ExpenseRow | null>(null);
  const [selectedExpenseForEdit, setSelectedExpenseForEdit] = useState<ExpenseRow | null>(null);
  const [isUpdatingExpense, setIsUpdatingExpense] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [refundDate, setRefundDate] = useState(todayValue);
  const [expensePaymentDate, setExpensePaymentDate] = useState(todayValue);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({
    title: '',
    category: 'Прочее',
    amount: '',
    paidAmount: '',
    paymentDate: todayValue,
    expenseDate: todayValue,
    note: '',
  });
  const [editForm, setEditForm] = useState(() => buildExpenseFormState(null, userWarehouseId ? String(userWarehouseId) : ''));

  const getExpenseRemaining = (expense: ExpenseRow) =>
    Math.max(0, Number(expense.amount || 0) - Number(expense.paidAmount || 0));

  const getExpenseRefundLimit = (expense: ExpenseRow) =>
    Math.max(0, Number(expense.amount || 0));

  const fetchExpenses = async (warehouseIdParam?: string) => {
    try {
      const effectiveWarehouseId = !isAdmin && userWarehouseId ? String(userWarehouseId) : (warehouseIdParam ?? selectedWarehouseId);
      const data = await getExpenses({
        warehouseId: effectiveWarehouseId || undefined,
      });
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при загрузке расходов');
    }
  };

  useEffect(() => {
    // Fetching itself is left to the [selectedWarehouseId] effect below, which
    // already fires once on mount with the initial value and again whenever this
    // sets a different one — calling fetchExpenses here too just duplicated the request.
    getWarehouses()
      .then((data) => {
        const filtered = filterWarehousesForUser(Array.isArray(data) ? data : [], user);
        setWarehouses(filtered);
        const defaultWarehouseId = getDefaultWarehouseId(filtered) || (filtered.length === 1 ? Number(filtered[0].id) : null);
        const nextWarehouseId = userWarehouseId
          ? String(userWarehouseId)
          : selectedWarehouseId || (defaultWarehouseId ? String(defaultWarehouseId) : '');

        if (nextWarehouseId !== selectedWarehouseId) {
          setSelectedWarehouseId(nextWarehouseId);
        }
      })
      .catch(() => {
        setWarehouses([]);
      });
  }, []);

  useEffect(() => {
    fetchExpenses(selectedWarehouseId);
  }, [selectedWarehouseId]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesQuery =
        !query ||
        [expense.title, expense.category, expense.note, expense.warehouse?.name, expense.user?.username]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesCategory = historyCategoryFilter === 'all' || expense.category === historyCategoryFilter;
      const remaining = getExpenseRemaining(expense);
      const matchesStatus =
        historyStatusFilter === 'all' ||
        (historyStatusFilter === 'paid' && remaining <= 0) ||
        (historyStatusFilter === 'partial' && Number(expense.paidAmount || 0) > 0 && remaining > 0) ||
        (historyStatusFilter === 'unpaid' && Number(expense.paidAmount || 0) <= 0 && remaining > 0);

      const expenseDateValue = String(expense.expenseDate || '').slice(0, 10);
      const matchesDateFrom = !historyDateFrom || expenseDateValue >= historyDateFrom;
      const matchesDateTo = !historyDateTo || expenseDateValue <= historyDateTo;

      return matchesQuery && matchesCategory && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [expenses, historyCategoryFilter, historyDateFrom, historyDateTo, historyStatusFilter, search]);

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalPaidAmount = filteredExpenses.reduce((sum, expense) => sum + Number(expense.paidAmount || 0), 0);
  const totalRemainingAmount = Math.max(0, totalAmount - totalPaidAmount);
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [historyCategoryFilter, historyDateFrom, historyDateTo, historyStatusFilter, search, selectedWarehouseId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const closeAddModal = () => {
    setShowAddModal(false);
    setForm({
      title: '',
      category: 'Прочее',
      amount: '',
      paidAmount: '',
      paymentDate: todayValue,
      expenseDate: todayValue,
      note: '',
    });
  };

  const closePaymentModal = () => {
    setSelectedExpenseForPayment(null);
    setPaymentAmount('');
    setExpensePaymentDate(todayValue);
  };

  const closeRefundModal = () => {
    setSelectedExpenseForRefund(null);
    setRefundAmount('');
    setRefundNote('');
    setRefundDate(todayValue);
  };

  const closeEditModal = () => {
    setSelectedExpenseForEdit(null);
    setEditForm(buildExpenseFormState(null, selectedWarehouseId || (userWarehouseId ? String(userWarehouseId) : '')));
  };

  const handleCreateExpense = async (event: React.FormEvent) => {
    event.preventDefault();

    const warehouseId = isAdmin ? Number(selectedWarehouseId) : userWarehouseId;
    if (!warehouseId) {
      toast.error('Выберите склад');
      return;
    }

    if (!form.title.trim()) {
      toast.error('Введите название расхода');
      return;
    }

    if (!(Number(form.amount) > 0)) {
      toast.error('Сумма расхода должна быть больше нуля');
      return;
    }

    if (Number(form.paidAmount || 0) < 0) {
      toast.error('Оплата не может быть отрицательной');
      return;
    }

    if (Number(form.paidAmount || 0) > Number(form.amount)) {
      toast.error('Оплата не может быть больше суммы расхода');
      return;
    }

    setIsSubmitting(true);
    try {
      await createExpense({
        warehouseId,
        title: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        paidAmount: Number(form.paidAmount || 0),
        paymentDate: form.paymentDate || todayValue,
        expenseDate: form.expenseDate,
        note: form.note.trim(),
      });
      toast.success('Расход добавлен');
      closeAddModal();
      await fetchExpenses(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при добавлении расхода');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentModal = (expense: ExpenseRow) => {
    const remaining = getExpenseRemaining(expense);
    if (remaining <= 0) {
      toast.success('Этот расход уже полностью оплачен');
      return;
    }

    setSelectedExpenseForPayment(expense);
    setPaymentAmount(String(roundMoney(remaining)));
    setExpensePaymentDate(todayValue);
  };

  const openRefundModal = (expense: ExpenseRow) => {
    const refundLimit = getExpenseRefundLimit(expense);
    if (refundLimit <= 0) {
      toast.error('По этому расходу нечего уменьшать');
      return;
    }

    setSelectedExpenseForRefund(expense);
    setRefundAmount(String(roundMoney(refundLimit)));
    setRefundNote('');
    setRefundDate(todayValue);
  };

  const openEditModal = (expense: ExpenseRow) => {
    setSelectedExpenseForEdit(expense);
    setEditForm(buildExpenseFormState(expense, selectedWarehouseId || (userWarehouseId ? String(userWarehouseId) : '')));
  };

  const handleAddPayment = async () => {
    if (!selectedExpenseForPayment) {
      return;
    }

    const remaining = getExpenseRemaining(selectedExpenseForPayment);
    const amount = Number(String(paymentAmount).replace(',', '.'));

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Введите корректную сумму оплаты');
      return;
    }

    if (amount > remaining) {
      toast.error('Сумма оплаты не может быть больше остатка');
      return;
    }

    setPayingExpenseId(selectedExpenseForPayment.id);
    try {
      await addExpensePayment(selectedExpenseForPayment.id, {
        amount,
        paymentDate: expensePaymentDate || todayValue,
      });
      toast.success('Оплата расхода сохранена');
      closePaymentModal();
      await fetchExpenses(selectedWarehouseId);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        toast.error('Маршрут оплаты не найден. Перезапустите backend и попробуйте снова.');
      } else {
        toast.error(err?.response?.data?.error || 'Ошибка при сохранении оплаты');
      }
    } finally {
      setPayingExpenseId(null);
    }
  };

  const handleAddRefund = async () => {
    if (!selectedExpenseForRefund) {
      return;
    }

    const refundLimit = getExpenseRefundLimit(selectedExpenseForRefund);
    const amount = Number(String(refundAmount).replace(',', '.'));

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Введите корректную сумму возврата');
      return;
    }

    if (amount > refundLimit) {
      toast.error('Сумма возврата не может быть больше суммы расхода');
      return;
    }

    setPayingExpenseId(selectedExpenseForRefund.id);
    try {
      await addExpenseRefund(selectedExpenseForRefund.id, {
        amount,
        refundDate: refundDate || todayValue,
        note: refundNote.trim(),
      });
      toast.success('Возврат расхода сохранен');
      closeRefundModal();
      await fetchExpenses(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при сохранении возврата расхода');
    } finally {
      setPayingExpenseId(null);
    }
  };

  const handleCancelExpensePayment = async (expense: ExpenseRow, payment: NonNullable<ExpenseRow['payments']>[number]) => {
    if (!payment?.id) return;

    const isRefund = Number(payment.amount || 0) < 0;
    const confirmLabel = isRefund
      ? `возврат ${formatMoney(Math.abs(Number(payment.amount || 0)))}`
      : `оплату ${formatMoney(payment.amount || 0)}`;

    if (!window.confirm(`Отменить ${confirmLabel}? Остаток расхода будет пересчитан.`)) {
      return;
    }

    setCancellingPaymentId(Number(payment.id));
    try {
      const result = await cancelExpensePayment(expense.id, payment.id);
      toast.success(isRefund ? 'Возврат расхода отменен' : 'Оплата расхода отменена');
      // Sync the still-open payment modal's snapshot too — a plain refetch only
      // updates the `expenses` list state, leaving `selectedExpenseForPayment`
      // (and the payment history just shown in this modal) stuck on stale data.
      if (result?.expense) {
        setSelectedExpenseForPayment((current) => (current && current.id === expense.id ? result.expense : current));
      }
      await fetchExpenses(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при отмене оплаты расхода');
    } finally {
      setCancellingPaymentId(null);
    }
  };

  const handleDeleteExpense = async () => {
    if (!selectedExpenseForDelete) {
      return;
    }

    try {
      await deleteExpense(selectedExpenseForDelete.id);
      toast.success('Расход удалён');
      setSelectedExpenseForDelete(null);
      await fetchExpenses(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при удалении расхода');
    }
  };

  const handleUpdateExpense = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedExpenseForEdit) {
      return;
    }

    const warehouseId = Number(editForm.warehouseId || selectedWarehouseId || userWarehouseId || '');
    if (!warehouseId) {
      toast.error('Выберите склад');
      return;
    }

    if (!editForm.title.trim()) {
      toast.error('Введите название расхода');
      return;
    }

    if (!(Number(editForm.amount) > 0)) {
      toast.error('Сумма расхода должна быть больше нуля');
      return;
    }

    if (Number(editForm.paidAmount || 0) < 0) {
      toast.error('Оплата не может быть отрицательной');
      return;
    }

    if (Number(editForm.paidAmount || 0) > Number(editForm.amount)) {
      toast.error('Оплата не может быть больше суммы расхода');
      return;
    }

    setIsUpdatingExpense(true);
    try {
      await updateExpense(selectedExpenseForEdit.id, {
        warehouseId,
        title: editForm.title.trim(),
        category: editForm.category,
        amount: Number(editForm.amount),
        paidAmount: Number(editForm.paidAmount || 0),
        expenseDate: editForm.expenseDate,
        note: editForm.note.trim(),
      });
      toast.success('Расход обновлён');
      closeEditModal();
      if (String(warehouseId) !== selectedWarehouseId) {
        setSelectedWarehouseId(String(warehouseId));
      }
      await fetchExpenses(String(warehouseId));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при обновлении расхода');
    } finally {
      setIsUpdatingExpense(false);
    }
  };

  const clearHistoryFilters = () => {
    setSearch('');
    setHistoryCategoryFilter('all');
    setHistoryStatusFilter('all');
    setHistoryDateFrom('');
    setHistoryDateTo('');
  };

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-5 overflow-hidden rounded-[28px] bg-[#f4f5fb] p-5 min-h-screen">
        {/* Top Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Расходы</h1>
            <p className="mt-0.5 text-xs text-slate-500">Учитывайте расходы по каждому складу отдельно.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {warehouses.length > 1 && (
              <div className="relative">
                <Warehouse className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <select
                  value={selectedWarehouseId}
                  onChange={(event) => setSelectedWarehouseId(event.target.value)}
                  disabled={!isAdmin}
                  className="appearance-none rounded-full border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-700 shadow-xs outline-none transition-colors hover:border-slate-300"
                >
                  <option value="">Все склады</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus size={16} />
              <span>Добавить расход</span>
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wider text-rose-500">Всего расходов</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(totalAmount)}</p>
          </div>
          <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-500">Оплачено</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(totalPaidAmount)}</p>
          </div>
          <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wider text-amber-500">Остаток долга</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(totalRemainingAmount)}</p>
          </div>
        </div>

        {/* Table & Filters Card */}
        <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-xs">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск по названию, категории или примечанию..."
                  className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] py-2.5 pl-11 pr-4 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                  Записей: {filteredExpenses.length}
                </span>
                {(search || historyCategoryFilter !== 'all' || historyStatusFilter !== 'all' || historyDateFrom || historyDateTo) && (
                  <button
                    type="button"
                    onClick={clearHistoryFilters}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-900 hover:text-white"
                  >
                    Сбросить фильтры
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={historyCategoryFilter}
                onChange={(event) => setHistoryCategoryFilter(event.target.value)}
                className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              >
                <option value="all">Все категории</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={historyStatusFilter}
                onChange={(event) => setHistoryStatusFilter(event.target.value as typeof historyStatusFilter)}
                className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              >
                <option value="all">Все статусы</option>
                <option value="paid">Полностью оплачено</option>
                <option value="partial">Частично оплачено</option>
                <option value="unpaid">Не оплачено</option>
              </select>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3 py-2">
                <CalendarDays size={15} className="text-slate-400" />
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(event) => setHistoryDateFrom(event.target.value)}
                  className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3 py-2">
                <CalendarDays size={15} className="text-slate-400" />
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(event) => setHistoryDateTo(event.target.value)}
                  className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-[#f4f5fb] text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Расход</th>
                  <th className="px-4 py-3">Категория</th>
                  <th className="px-4 py-3">Склад</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Оплачено</th>
                  <th className="px-4 py-3">Долг</th>
                  <th className="px-4 py-3">Кто добавил</th>
                  <th className="px-4 py-3 text-center">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedExpenses.map((expense) => {
                  const remaining = getExpenseRemaining(expense);
                  const refundLimit = getExpenseRefundLimit(expense);

                  return (
                    <tr key={expense.id} className="transition-colors hover:bg-[#f4f5fb]">
                      <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-500">
                        {new Date(expense.expenseDate).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{expense.title}</p>
                        {expense.note ? <p className="mt-0.5 text-[11px] text-slate-400">{expense.note}</p> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                          {expense.category}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-600">
                        {expense.warehouse?.name || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-rose-600">
                        {formatMoney(expense.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-emerald-600">
                        {formatMoney(expense.paidAmount || 0)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-amber-600">
                        {formatMoney(remaining)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-500">
                        {expense.user?.username || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(expense)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-900 hover:text-white"
                            title="Редактировать"
                          >
                            <Pencil size={15} />
                          </button>
                          {remaining > 0 ? (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(expense)}
                              disabled={payingExpenseId === expense.id}
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                              title="Внести оплату"
                            >
                              <Wallet size={15} className={payingExpenseId === expense.id ? 'animate-pulse' : ''} />
                            </button>
                          ) : null}
                          {refundLimit > 0 ? (
                            <button
                              type="button"
                              onClick={() => openRefundModal(expense)}
                              disabled={payingExpenseId === expense.id}
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50"
                              title="Возврат расхода"
                            >
                              <RotateCcw size={15} className={payingExpenseId === expense.id ? 'animate-pulse' : ''} />
                            </button>
                          ) : null}
                          {(isAdmin || expense.user?.id === user.id) && (
                            <button
                              type="button"
                              onClick={() => setSelectedExpenseForDelete(expense)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
                              title="Удалить"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredExpenses.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400">
                      Расходы пока не добавлены.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 p-3 md:hidden">
            {paginatedExpenses.map((expense) => {
              const remaining = getExpenseRemaining(expense);
              const refundLimit = getExpenseRefundLimit(expense);

              return (
                <article key={`expense-mobile-${expense.id}`} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{expense.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{new Date(expense.expenseDate).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                      {expense.category}
                    </span>
                  </div>

                  {expense.note ? <p className="text-xs text-slate-500">{expense.note}</p> : null}

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl bg-[#f4f5fb] p-2.5">
                      <p className="text-[10px] uppercase text-slate-400">Сумма</p>
                      <p className="mt-0.5 font-semibold text-rose-600">{formatMoney(expense.amount)}</p>
                    </div>
                    <div className="rounded-xl bg-[#f4f5fb] p-2.5">
                      <p className="text-[10px] uppercase text-slate-400">Оплачено</p>
                      <p className="mt-0.5 font-semibold text-emerald-600">{formatMoney(expense.paidAmount || 0)}</p>
                    </div>
                    <div className="rounded-xl bg-[#f4f5fb] p-2.5">
                      <p className="text-[10px] uppercase text-slate-400">Остаток</p>
                      <p className="mt-0.5 font-semibold text-amber-600">{formatMoney(remaining)}</p>
                    </div>
                    <div className="rounded-xl bg-[#f4f5fb] p-2.5">
                      <p className="text-[10px] uppercase text-slate-400">Склад</p>
                      <p className="mt-0.5 font-medium text-slate-700">{expense.warehouse?.name || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">Добавил: <span className="font-medium text-slate-700">{expense.user?.username || '-'}</span></span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(expense)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
                        title="Редактировать"
                      >
                        <Pencil size={14} />
                      </button>
                      {remaining > 0 && (
                        <button
                          type="button"
                          onClick={() => openPaymentModal(expense)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700"
                          title="Оплатить"
                        >
                          <Wallet size={14} />
                        </button>
                      )}
                      {refundLimit > 0 && (
                        <button
                          type="button"
                          onClick={() => openRefundModal(expense)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700"
                          title="Возврат"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {(isAdmin || expense.user?.id === user.id) && (
                        <button
                          type="button"
                          onClick={() => setSelectedExpenseForDelete(expense)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600"
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {!filteredExpenses.length && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                Расходы пока не добавлены.
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredExpenses.length > pageSize && (
            <div className="border-t border-slate-100 bg-white">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredExpenses.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                className="border-t-0"
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal: Новый расход */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={closeAddModal}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Banknote size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Новый расход</h3>
                  <p className="text-xs text-slate-500">Добавьте новый расход для нужд склада.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-4 overflow-y-auto p-6">
                {warehouses.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Склад</label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2.5">
                      <Warehouse size={15} className="text-slate-400" />
                      <select
                        value={selectedWarehouseId}
                        onChange={(event) => setSelectedWarehouseId(event.target.value)}
                        disabled={!isAdmin}
                        className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
                      >
                        <option value="">Выберите склад</option>
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Категория</label>
                    <select
                      value={form.category}
                      onChange={(event) => setForm({ ...form, category: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Дата расхода</label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2">
                      <CalendarDays size={15} className="text-slate-400" />
                      <input
                        type="date"
                        value={form.expenseDate}
                        onChange={(event) => setForm({ ...form, expenseDate: event.target.value })}
                        className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Название расхода</label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="Например: Аренда склада, Доставка товара, Бензин"
                    className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Сумма расхода</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.amount}
                      onChange={(event) => setForm({ ...form, amount: event.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Оплачено сейчас</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.paidAmount}
                      onChange={(event) => setForm({ ...form, paidAmount: event.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                    />
                  </div>
                </div>

                {Number(form.paidAmount || 0) > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Дата оплаты</label>
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-2">
                      <CalendarDays size={15} className="text-emerald-500" />
                      <input
                        type="date"
                        value={form.paymentDate}
                        onChange={(event) => setForm({ ...form, paymentDate: event.target.value })}
                        className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
                      />
                    </div>
                    {form.expenseDate && form.paymentDate && form.paymentDate < form.expenseDate ? (
                      <p className="text-[11px] font-medium text-emerald-600">Оплата будет отмечена как аванс.</p>
                    ) : null}
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Остаток к оплате</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900">
                    {formatMoney(Math.max(0, Number(form.amount || 0) - Number(form.paidAmount || 0)))}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Примечание</label>
                  <textarea
                    value={form.note}
                    onChange={(event) => setForm({ ...form, note: event.target.value })}
                    rows={2}
                    placeholder="Дополнительная информация (необязательно)..."
                    className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-full bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Сохранение...' : 'Сохранить расход'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Оплата расхода */}
      {selectedExpenseForPayment && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={closePaymentModal}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Оплата расхода</h3>
                  <p className="text-xs text-slate-500">{selectedExpenseForPayment.title}</p>
                </div>
              </div>
              <button
                onClick={closePaymentModal}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#f4f5fb] p-3.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Всего</p>
                  <p className="mt-0.5 text-base font-semibold text-slate-900">{formatMoney(selectedExpenseForPayment.amount)}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-amber-500">Остаток</p>
                  <p className="mt-0.5 text-base font-semibold text-amber-700">{formatMoney(getExpenseRemaining(selectedExpenseForPayment))}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Сумма оплаты</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    autoFocus
                    className="mt-1.5 w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-3 text-xl font-bold text-slate-900 outline-none transition-all focus:border-emerald-500 focus:bg-white"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700">Дата оплаты</label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2.5">
                    <CalendarDays size={15} className="text-emerald-500" />
                    <input
                      type="date"
                      value={expensePaymentDate}
                      onChange={(event) => setExpensePaymentDate(event.target.value)}
                      className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(roundMoney(getExpenseRemaining(selectedExpenseForPayment))))}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    Оплатить весь остаток
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(roundMoney(getExpenseRemaining(selectedExpenseForPayment) / 2)))}
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    Половина остатка
                  </button>
                </div>
              </div>

              {Boolean(selectedExpenseForPayment.payments?.length) && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">История платежей</h4>
                  <div className="space-y-1.5">
                    {selectedExpenseForPayment.payments!.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-[#f4f5fb]/60 px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-700">{formatMoney(payment.amount)}</p>
                          <p className="mt-0.5 truncate text-[10px] text-slate-400">
                            {new Date(payment.paymentDate).toLocaleDateString('ru-RU')}
                            {payment.staff_name ? ` · ${payment.staff_name}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCancelExpensePayment(selectedExpenseForPayment, payment)}
                          disabled={cancellingPaymentId === payment.id}
                          className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {cancellingPaymentId === payment.id ? 'Отмена...' : 'Отменить'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closePaymentModal}
                className="flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAddPayment}
                disabled={payingExpenseId === selectedExpenseForPayment.id || !paymentAmount}
                className="flex-1 rounded-full bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {payingExpenseId === selectedExpenseForPayment.id ? 'Сохранение...' : 'Внести оплату'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Возврат расхода */}
      {selectedExpenseForRefund && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={closeRefundModal}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Возврат расхода</h3>
                  <p className="text-xs text-slate-500">{selectedExpenseForRefund.title}</p>
                </div>
              </div>
              <button
                onClick={closeRefundModal}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="rounded-xl bg-[#f4f5fb] p-2.5">
                  <p className="text-[10px] uppercase text-slate-400">Сумма</p>
                  <p className="mt-0.5 font-semibold text-slate-900">{formatMoney(selectedExpenseForRefund.amount)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5">
                  <p className="text-[10px] uppercase text-emerald-500">Оплачено</p>
                  <p className="mt-0.5 font-semibold text-emerald-700">{formatMoney(selectedExpenseForRefund.paidAmount || 0)}</p>
                </div>
                <div className="rounded-xl bg-sky-50 p-2.5">
                  <p className="text-[10px] uppercase text-sky-500">Можно</p>
                  <p className="mt-0.5 font-semibold text-sky-700">{formatMoney(getExpenseRefundLimit(selectedExpenseForRefund))}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Сумма возврата</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={refundAmount}
                    onChange={(event) => setRefundAmount(event.target.value)}
                    autoFocus
                    className="mt-1.5 w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-3 text-xl font-bold text-slate-900 outline-none transition-all focus:border-sky-500 focus:bg-white"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700">Дата возврата</label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2.5">
                    <CalendarDays size={15} className="text-sky-500" />
                    <input
                      type="date"
                      value={refundDate}
                      onChange={(event) => setRefundDate(event.target.value)}
                      className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700">Примечание</label>
                  <textarea
                    value={refundNote}
                    onChange={(event) => setRefundNote(event.target.value)}
                    rows={2}
                    className="mt-1.5 w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                    placeholder="Например: поставщик вернул часть суммы"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeRefundModal}
                className="flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAddRefund}
                disabled={payingExpenseId === selectedExpenseForRefund.id || !refundAmount}
                className="flex-1 rounded-full bg-sky-600 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-sky-700 disabled:opacity-50"
              >
                {payingExpenseId === selectedExpenseForRefund.id ? 'Сохранение...' : 'Сохранить возврат'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Редактировать расход */}
      {selectedExpenseForEdit && (
        <div
          className="fixed inset-0 z-75 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={closeEditModal}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Редактировать расход</h3>
                  <p className="text-xs text-slate-500">Измените детали расхода без удаления записи.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateExpense} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-4 overflow-y-auto p-6">
                {warehouses.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Склад</label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2.5">
                      <Warehouse size={15} className="text-slate-400" />
                      <select
                        value={editForm.warehouseId}
                        onChange={(event) => setEditForm({ ...editForm, warehouseId: event.target.value })}
                        className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
                      >
                        <option value="">Выберите склад</option>
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Категория</label>
                    <select
                      value={editForm.category}
                      onChange={(event) => setEditForm({ ...editForm, category: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Дата</label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2">
                      <CalendarDays size={15} className="text-slate-400" />
                      <input
                        type="date"
                        value={editForm.expenseDate}
                        onChange={(event) => setEditForm({ ...editForm, expenseDate: event.target.value })}
                        className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Название расхода</label>
                  <input
                    value={editForm.title}
                    onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                    placeholder="Например: Аренда склада, Доставка товара, Бензин"
                    className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Сумма расхода</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editForm.amount}
                      onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Оплачено</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editForm.paidAmount}
                      readOnly
                      className="w-full rounded-2xl border border-slate-200/70 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500 outline-none"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Остаток к оплате</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900">
                    {formatMoney(Math.max(0, Number(editForm.amount || 0) - Number(editForm.paidAmount || 0)))}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Примечание</label>
                  <textarea
                    value={editForm.note}
                    onChange={(event) => setEditForm({ ...editForm, note: event.target.value })}
                    rows={2}
                    className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                  />
                </div>
              </div>

              <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:p-6">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 font-bold text-slate-700 transition-all hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingExpense}
                  className="flex-1 rounded-2xl bg-sky-600 py-3.5 font-black text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-700 disabled:opacity-50"
                >
                  {isUpdatingExpense ? 'Сохраняем...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(selectedExpenseForDelete)}
        onClose={() => setSelectedExpenseForDelete(null)}
        onConfirm={handleDeleteExpense}
        title="Удалить расход?"
        message={
          selectedExpenseForDelete
            ? `Расход "${selectedExpenseForDelete.title}" будет удалён из истории. Это действие нельзя отменить.`
            : ''
        }
        confirmText="Удалить"
        cancelText="Отмена"
        type="danger"
      />
    </div>
  );
}
