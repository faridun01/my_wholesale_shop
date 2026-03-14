import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import client from '../api/client';
import { getCurrentUser, isAdminUser } from '../utils/userAccess';

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function RemindersView() {
  const currentUser = getCurrentUser();
  const canDeleteReminder = isAdminUser(currentUser);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    dueDate: '',
    type: 'general',
  });

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => {
      const aTime = new Date(a.createdAt || a.dueDate).getTime();
      const bTime = new Date(b.createdAt || b.dueDate).getTime();
      return bTime - aTime;
    });
  }, [reminders]);

  const fetchReminders = async () => {
    try {
      const res = await client.get('/reminders');
      setReminders(Array.isArray(res.data) ? res.data : []);
      window.dispatchEvent(new Event('reminders-updated'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.post('/reminders', { ...newReminder, dueDate: `${newReminder.dueDate}T12:00:00` });
      toast.success('Напоминание создано');
      setShowAddModal(false);
      setNewReminder({ title: '', description: '', dueDate: '', type: 'general' });
      fetchReminders();
    } catch {
      toast.error('Ошибка при создании напоминания');
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await client.put(`/reminders/${id}/complete`);
      toast.success('Напоминание выполнено');
      fetchReminders();
    } catch {
      toast.error('Ошибка');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/reminders/${id}`);
      toast.success('Удалено');
      fetchReminders();
    } catch (err: any) {
      toast.error(err?.response?.status === 403 ? 'Удалять напоминания может только админ' : 'Ошибка');
    }
  };

  const getStatusColor = (dueDate: string, isCompleted: boolean) => {
    if (isCompleted) return 'text-emerald-500 bg-emerald-50';
    const now = new Date();
    const due = new Date(dueDate);
    if (due < now) return 'text-rose-600 bg-rose-50';
    return 'text-rose-500 bg-rose-50';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Напоминания</h1>
          <p className="mt-1 text-slate-500">Последние объявления сверху. Незавершённые выделены красным.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 rounded-2xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700"
        >
          <Plus size={20} />
          <span>Добавить</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center font-bold text-slate-400">Загрузка...</div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {sortedReminders.map((reminder) => (
              <motion.div
                key={reminder.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={clsx(
                  'group flex items-center justify-between rounded-3xl border p-6 shadow-sm transition-all hover:shadow-md',
                  reminder.isCompleted
                    ? 'border-slate-100 bg-white opacity-60'
                    : 'border-rose-100 bg-rose-50/55'
                )}
              >
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => !reminder.isCompleted && handleComplete(reminder.id)}
                    className={clsx(
                      'rounded-xl p-2 transition-all',
                      reminder.isCompleted
                        ? 'text-emerald-500'
                        : 'text-rose-400 hover:bg-white hover:text-rose-600'
                    )}
                  >
                    {reminder.isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  <div>
                    <h3 className={clsx('font-bold text-slate-900', reminder.isCompleted && 'line-through')}>
                      {reminder.title}
                    </h3>
                    <div className="mt-1 flex items-center space-x-3">
                      <span
                        className={clsx(
                          'flex items-center space-x-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest',
                          getStatusColor(reminder.dueDate, reminder.isCompleted)
                        )}
                      >
                        <Clock size={10} className="mr-1" />
                        {new Date(reminder.dueDate).toLocaleDateString()}
                      </span>
                      {reminder.description && (
                        <p className={clsx('line-clamp-1 text-xs', reminder.isCompleted ? 'text-slate-400' : 'text-rose-500')}>
                          {reminder.description}
                        </p>
                      )}
                    </div>
                    {reminder.user?.username && (
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Создал: {reminder.user.username}
                      </p>
                    )}
                  </div>
                </div>

                {canDeleteReminder && (
                  <button
                    onClick={() => handleDelete(reminder.id)}
                    className="rounded-xl p-2 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {sortedReminders.length === 0 && (
            <div className="rounded-3xl border border-slate-100 bg-white py-20 text-center">
              <Bell size={48} className="mx-auto mb-4 text-slate-200" />
              <h3 className="text-xl font-bold text-slate-900">Нет напоминаний</h3>
              <p className="mt-1 text-slate-500">Все объявления выполнены.</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm md:p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl md:max-w-md md:rounded-3xl"
            >
              <div className="border-b border-slate-100 bg-indigo-50/50 p-5 md:p-8">
                <h3 className="flex items-center space-x-2 text-xl font-bold text-slate-900 md:text-2xl">
                  <Bell className="text-indigo-600" size={22} />
                  <span>Новое напоминание</span>
                </h3>
              </div>
              <form onSubmit={handleCreate} className="space-y-5 p-5 md:space-y-6 md:p-8">
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Заголовок</label>
                    <input
                      type="text"
                      required
                      placeholder="Напр: Позвонить клиенту"
                      value={newReminder.title}
                      onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 md:px-4 md:py-3"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Описание</label>
                    <textarea
                      placeholder="Дополнительные детали..."
                      value={newReminder.description}
                      onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                      className="h-20 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 md:h-24 md:px-4 md:py-3"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Дата и время</label>
                    <input
                      type="date"
                      required
                      value={newReminder.dueDate}
                      onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 md:px-4 md:py-3"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2 md:space-x-3 md:pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50 md:px-6 md:py-3">
                    Отмена
                  </button>
                  <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 md:px-8 md:py-3">
                    Создать
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
