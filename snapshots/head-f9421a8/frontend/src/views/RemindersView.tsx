import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Clock, 
  AlertCircle,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function RemindersView() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    dueDate: '',
    type: 'general'
  });

  const fetchReminders = async () => {
    try {
      const res = await client.get('/reminders');
      setReminders(res.data);
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
      await client.post('/reminders', newReminder);
      toast.success('Напоминание создано!');
      setShowAddModal(false);
      setNewReminder({ title: '', description: '', dueDate: '', type: 'general' });
      fetchReminders();
    } catch (err) {
      toast.error('Ошибка при создании напоминания');
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await client.put(`/reminders/${id}/complete`);
      toast.success('Напоминание выполнено!');
      fetchReminders();
    } catch (err) {
      toast.error('Ошибка');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/reminders/${id}`);
      toast.success('Удалено');
      fetchReminders();
    } catch (err) {
      toast.error('Ошибка');
    }
  };

  const getStatusColor = (dueDate: string, isCompleted: boolean) => {
    if (isCompleted) return 'text-emerald-500 bg-emerald-50';
    const now = new Date();
    const due = new Date(dueDate);
    if (due < now) return 'text-rose-500 bg-rose-50';
    return 'text-amber-500 bg-amber-50';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Напоминания</h1>
          <p className="text-slate-500 mt-1">Запланированные задачи и уведомления.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Добавить</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold">Загрузка...</div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {reminders.map((reminder) => (
              <motion.div 
                key={reminder.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={clsx(
                  "bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group transition-all hover:shadow-md",
                  reminder.isCompleted && "opacity-60"
                )}
              >
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => !reminder.isCompleted && handleComplete(reminder.id)}
                    className={clsx(
                      "p-2 rounded-xl transition-all",
                      reminder.isCompleted ? "text-emerald-500" : "text-slate-300 hover:text-indigo-600 hover:bg-indigo-50"
                    )}
                  >
                    {reminder.isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  <div>
                    <h3 className={clsx("font-bold text-slate-900", reminder.isCompleted && "line-through")}>
                      {reminder.title}
                    </h3>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className={clsx(
                        "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center space-x-1",
                        getStatusColor(reminder.dueDate, reminder.isCompleted)
                      )}>
                        <Clock size={10} className="mr-1" />
                        {new Date(reminder.dueDate).toLocaleDateString()} {new Date(reminder.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {reminder.description && (
                        <p className="text-xs text-slate-400 line-clamp-1">{reminder.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(reminder.id)}
                  className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={20} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {reminders.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
              <Bell size={48} className="mx-auto text-slate-200 mb-4" />
              <h3 className="text-xl font-bold text-slate-900">Нет напоминаний</h3>
              <p className="text-slate-500 mt-1">Вы всё выполнили! Отличная работа.</p>
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
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 bg-indigo-50/50">
                <h3 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
                  <Bell className="text-indigo-600" size={24} />
                  <span>Новое напоминание</span>
                </h3>
              </div>
              <form onSubmit={handleCreate} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Заголовок</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Напр: Позвонить клиенту"
                      value={newReminder.title}
                      onChange={e => setNewReminder({ ...newReminder, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Описание</label>
                    <textarea 
                      placeholder="Дополнительные детали..."
                      value={newReminder.description}
                      onChange={e => setNewReminder({ ...newReminder, description: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Дата и время</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={newReminder.dueDate}
                      onChange={e => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Отмена</button>
                  <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all">Создать</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function clsx(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
