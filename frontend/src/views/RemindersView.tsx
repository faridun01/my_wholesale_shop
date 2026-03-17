import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import client from '../api/client';
import { getCurrentUser, isAdminUser } from '../utils/userAccess';

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ReminderFormState = {
  title: string;
  description: string;
  dueDate: string;
  type: string;
};

const EMPTY_FORM: ReminderFormState = {
  title: '',
  description: '',
  dueDate: '',
  type: 'general',
};

export default function RemindersView() {
  const currentUser = getCurrentUser();
  const canDeleteReminder = isAdminUser(currentUser);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<any>(null);
  const [reminderForm, setReminderForm] = useState<ReminderFormState>(EMPTY_FORM);

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

  const resetForm = () => {
    setSelectedReminder(null);
    setReminderForm(EMPTY_FORM);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openReminderModal = (reminder: any) => {
    setSelectedReminder(reminder);
    setReminderForm({
      title: reminder.title || '',
      description: reminder.description || '',
      dueDate: String(reminder.dueDate || '').slice(0, 10),
      type: reminder.type || 'general',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...reminderForm,
        dueDate: `${reminderForm.dueDate}T12:00:00`,
      };

      if (selectedReminder?.id) {
        await client.put(`/reminders/${selectedReminder.id}`, payload);
        toast.success('Напоминание обновлено');
      } else {
        await client.post('/reminders', payload);
        toast.success('Напоминание создано');
      }

      closeModal();
      fetchReminders();
    } catch {
      toast.error(selectedReminder ? 'Ошибка при обновлении напоминания' : 'Ошибка при создании напоминания');
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await client.put(`/reminders/${id}/complete`);
      toast.success('Напоминание выполнено');
      if (selectedReminder?.id === id) {
        closeModal();
      }
      fetchReminders();
    } catch {
      toast.error('Ошибка');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/reminders/${id}`);
      toast.success('Удалено');
      if (selectedReminder?.id === id) {
        closeModal();
      }
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
    return 'text-amber-600 bg-amber-50';
  };

  return (
    <div className="app-page-shell app-page-pad">
      <div className="mx-auto max-w-4xl space-y-6 md:space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Напоминания</h1>
          <p className="mt-1 text-slate-500">Нажмите на карточку напоминания, чтобы открыть форму и быстро изменить запись.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="hidden items-center space-x-2 rounded-2xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 md:flex"
        >
          <Plus size={20} />
          <span>Добавить</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center font-bold text-slate-400">Загрузка...</div>
      ) : (
        <div className="grid gap-3 md:gap-4">
          <AnimatePresence>
            {sortedReminders.map((reminder) => (
              <motion.button
                key={reminder.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                onClick={() => openReminderModal(reminder)}
                className={clsx(
                  'group w-full rounded-3xl border p-4 text-left shadow-sm transition-all hover:shadow-md md:p-6',
                  reminder.isCompleted
                    ? 'border-slate-100 bg-white opacity-70'
                    : 'border-rose-100 bg-rose-50/55'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3 md:gap-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!reminder.isCompleted) {
                          handleComplete(reminder.id);
                        }
                      }}
                      className={clsx(
                        'mt-0.5 rounded-xl p-2 transition-all',
                        reminder.isCompleted
                          ? 'text-emerald-500'
                          : 'text-rose-400 hover:bg-white hover:text-rose-600'
                      )}
                    >
                      {reminder.isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>

                    <div className="min-w-0">
                      <h3 className={clsx('font-bold text-slate-900', reminder.isCompleted && 'line-through')}>
                        {reminder.title}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-2 md:gap-3">
                        <span
                          className={clsx(
                            'flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest',
                            getStatusColor(reminder.dueDate, reminder.isCompleted)
                          )}
                        >
                          <Clock size={10} className="mr-1" />
                          {new Date(reminder.dueDate).toLocaleDateString('ru-RU')}
                        </span>

                        {reminder.description && (
                          <p className={clsx('line-clamp-2 text-xs leading-5 md:line-clamp-1', reminder.isCompleted ? 'text-slate-400' : 'text-rose-500')}>
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

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="rounded-xl bg-white/80 p-2 text-slate-400">
                      <Pencil size={16} />
                    </div>
                    {canDeleteReminder && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(reminder.id);
                        }}
                        className="rounded-xl p-2 text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-600 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>

          {sortedReminders.length === 0 && (
            <div className="rounded-3xl border border-slate-100 bg-white py-20 text-center">
              <Bell size={48} className="mx-auto mb-4 text-slate-200" />
              <h3 className="text-xl font-bold text-slate-900">Нет напоминаний</h3>
              <p className="mt-1 text-slate-500">Все текущие напоминания завершены.</p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={openCreateModal}
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-[0_18px_40px_rgba(79,70,229,0.35)] transition-all hover:bg-indigo-700 md:hidden"
      >
        <Plus size={22} />
      </button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm md:items-center md:p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:max-w-md md:rounded-3xl"
            >
              <div className="border-b border-slate-100 bg-indigo-50/50 p-4 md:p-8">
                <div className="mb-3 flex justify-center md:hidden">
                  <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center space-x-2 text-lg font-bold text-slate-900 md:text-2xl">
                    <Bell className="text-indigo-600" size={22} />
                    <span>{selectedReminder ? 'Напоминание' : 'Новое напоминание'}</span>
                  </h3>
                  <button type="button" onClick={closeModal} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-slate-700">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 p-4 md:space-y-6 md:p-8">
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Заголовок</label>
                    <input
                      type="text"
                      required
                      placeholder="Напр: Позвонить клиенту"
                      value={reminderForm.title}
                      onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 md:px-4 md:py-3"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Описание</label>
                    <textarea
                      placeholder="Дополнительные детали..."
                      value={reminderForm.description}
                      onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })}
                      className="h-24 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 md:px-4 md:py-3"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Дата</label>
                    <input
                      type="date"
                      required
                      value={reminderForm.dueDate}
                      onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 md:px-4 md:py-3"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2 md:gap-3 md:pt-4">
                  {selectedReminder && !selectedReminder.isCompleted && (
                    <button
                      type="button"
                      onClick={() => handleComplete(selectedReminder.id)}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100 md:px-6 md:py-3"
                    >
                      Выполнить
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50 md:px-6 md:py-3"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 md:px-8 md:py-3"
                  >
                    {selectedReminder ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
