import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, Plus, Search, Trash2, Warehouse } from 'lucide-react';
import toast from 'react-hot-toast';
import { createExpense, deleteExpense, getExpenses } from '../api/expenses.api';
import { getWarehouses } from '../api/warehouses.api';
import { formatMoney } from '../utils/format';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { getDefaultWarehouseId } from '../utils/warehouse';

type ExpenseRow = {
  id: number;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  note?: string | null;
  warehouse?: { id: number; name: string };
  user?: { id: number; username: string };
  userId?: number;
};

const categories = ['Аренда', 'Зарплата', 'Доставка', 'Транспорт', 'Коммунальные', 'Ремонт', 'Прочее'];

const todayValue = new Date().toISOString().slice(0, 10);

export default function ExpensesView() {
  const user = React.useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(user);
  const userWarehouseId = getUserWarehouseId(user);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(userWarehouseId ? String(userWarehouseId) : '');
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'Прочее',
    amount: '',
    expenseDate: todayValue,
    note: '',
  });

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
    getWarehouses()
      .then((data) => {
        const filtered = filterWarehousesForUser(Array.isArray(data) ? data : [], user);
        setWarehouses(filtered);
        const defaultWarehouseId = getDefaultWarehouseId(filtered);
        const nextWarehouseId = userWarehouseId
          ? String(userWarehouseId)
          : selectedWarehouseId || (defaultWarehouseId ? String(defaultWarehouseId) : '');
        if (nextWarehouseId !== selectedWarehouseId) {
          setSelectedWarehouseId(nextWarehouseId);
          fetchExpenses(nextWarehouseId);
          return;
        }
        fetchExpenses(nextWarehouseId);
      })
      .catch(() => {
        setWarehouses([]);
        fetchExpenses(selectedWarehouseId);
      });
  }, []);

  useEffect(() => {
    fetchExpenses(selectedWarehouseId);
  }, [selectedWarehouseId]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return expenses;
    }

    return expenses.filter((expense) =>
      [expense.title, expense.category, expense.note, expense.warehouse?.name, expense.user?.username]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [expenses, search]);

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

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

    setIsSubmitting(true);
    try {
      await createExpense({
        warehouseId,
        title: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        note: form.note.trim(),
      });
      toast.success('Расход добавлен');
      setForm({
        title: '',
        category: 'Прочее',
        amount: '',
        expenseDate: todayValue,
        note: '',
      });
      await fetchExpenses(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при добавлении расхода');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expense: ExpenseRow) => {
    if (!window.confirm(`Удалить расход "${expense.title}"?`)) {
      return;
    }

    try {
      await deleteExpense(expense.id);
      toast.success('Расход удалён');
      await fetchExpenses(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при удалении расхода');
    }
  };

  return (
    <div className="app-page-shell">
      <div className="w-full space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-medium tracking-tight text-slate-900">Расходы</h1>
              <p className="mt-1 text-slate-500">Учитывайте расходы по каждому складу отдельно.</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-right">
              <p className="text-[11px] uppercase tracking-[0.16em] text-rose-400">Всего за период</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(totalAmount)}</p>
            </div>
          </div>

          <div className="grid gap-6 p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <Banknote size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Новый расход</h2>
                  <p className="text-sm text-slate-500">Добавьте расход для нужд склада.</p>
                </div>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-slate-600">Склад</label>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <Warehouse size={16} className="text-slate-400" />
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-transparent text-sm text-slate-700 outline-none"
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

                <div className="space-y-2">
                  <label className="text-sm text-slate-600">Категория</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-600">Название расхода</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Например: аренда, бензин, грузчики"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600">Сумма</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600">Дата</label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <CalendarDays size={16} className="text-slate-400" />
                      <input
                        type="date"
                        value={form.expenseDate}
                        onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                        className="w-full bg-transparent text-sm text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-600">Примечание</label>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  <Plus size={16} />
                  <span>{isSubmitting ? 'Сохраняем...' : 'Добавить расход'}</span>
                </button>
              </form>
            </section>

            <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">История расходов</h2>
                  <p className="text-sm text-slate-500">{filteredExpenses.length} записей</p>
                </div>
                <div className="relative w-full lg:max-w-sm">
                  <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по расходам..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50 text-left text-sm text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Дата</th>
                      <th className="px-5 py-3 font-medium">Расход</th>
                      <th className="px-5 py-3 font-medium">Категория</th>
                      <th className="px-5 py-3 font-medium">Склад</th>
                      <th className="px-5 py-3 font-medium">Сумма</th>
                      <th className="px-5 py-3 font-medium">Кто добавил</th>
                      <th className="px-5 py-3 font-medium text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="border-t border-slate-100 text-sm text-slate-700">
                        <td className="px-5 py-4">{new Date(expense.expenseDate).toLocaleDateString('ru-RU')}</td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900">{expense.title}</div>
                          {expense.note ? <div className="mt-1 text-xs text-slate-400">{expense.note}</div> : null}
                        </td>
                        <td className="px-5 py-4">{expense.category}</td>
                        <td className="px-5 py-4">{expense.warehouse?.name || '—'}</td>
                        <td className="px-5 py-4 font-medium text-rose-600">{formatMoney(expense.amount)}</td>
                        <td className="px-5 py-4">{expense.user?.username || '—'}</td>
                        <td className="px-5 py-4 text-right">
                          {(isAdmin || expense.user?.id === user.id) && (
                            <button
                              onClick={() => handleDeleteExpense(expense)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!filteredExpenses.length && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                          Расходы пока не добавлены.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
