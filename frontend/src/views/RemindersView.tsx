import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import toast from 'react-hot-toast';
import client from '../api/client';
import PaginationControls from '../components/common/PaginationControls';
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

type ReminderItem = {
  id: number;
  title: string;
  description?: string | null;
  dueDate: string;
  type?: string | null;
  isCompleted?: boolean;
  createdAt?: string;
  user?: { username?: string } | null;
};

const EMPTY_FORM: ReminderFormState = {
  title: '',
  description: '',
  dueDate: '',
  type: 'general',
};

const TYPE_META: Record<string, { label: string; tone: string; dot: string; iconTone: string }> = {
  general: { label: 'Общее', tone: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-500', iconTone: 'bg-slate-100 text-slate-600' },
  call: { label: 'Звонки клиентам', tone: 'bg-sky-50 text-sky-700 border border-sky-200', dot: 'bg-sky-500', iconTone: 'bg-sky-100 text-sky-600' },
  supplier: { label: 'Заказы поставщикам', tone: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500', iconTone: 'bg-amber-100 text-amber-600' },
  stock: { label: 'Склад и учет', tone: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', iconTone: 'bg-emerald-100 text-emerald-600' },
  finance: { label: 'Финансы', tone: 'bg-violet-50 text-violet-700 border border-violet-200', dot: 'bg-violet-500', iconTone: 'bg-violet-100 text-violet-600' },
};

const PRIORITY_META = {
  overdue: { label: 'Просрочено', tone: 'bg-rose-50 text-rose-600 border border-rose-200' },
  today: { label: 'Сегодня', tone: 'bg-amber-50 text-amber-600 border border-amber-200' },
  upcoming: { label: 'Скоро', tone: 'bg-sky-50 text-sky-600 border border-sky-200' },
  completed: { label: 'Выполнено', tone: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseReminderDate(value: string) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  }

  return new Date(normalized);
}

function sameDay(left: Date, right: Date) {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function getReminderBucket(reminder: ReminderItem, now: Date) {
  if (reminder.isCompleted) return 'completed' as const;
  const dueDate = parseReminderDate(reminder.dueDate);
  const today = startOfDay(now);
  const dueStart = startOfDay(dueDate);
  if (dueStart.getTime() < today.getTime()) return 'overdue' as const;
  if (sameDay(dueDate, now)) return 'today' as const;
  return 'upcoming' as const;
}

function buildCalendarDays(activeMonth: Date) {
  const firstDay = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startWeekday);
  return Array.from({ length: 35 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function formatDueLabel(value: string, bucket: 'overdue' | 'today' | 'upcoming' | 'completed') {
  const date = parseReminderDate(value);
  if (bucket === 'today') {
    return 'Сегодня';
  }
  if (bucket === 'overdue') {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function getTypeMeta(type?: string | null) {
  return TYPE_META[String(type || 'general').toLowerCase()] || TYPE_META.general;
}

export default function RemindersView() {
  const reminderPageSize = 6;
  const currentUser = getCurrentUser();
  const canDeleteReminder = isAdminUser(currentUser);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null);
  const [reminderForm, setReminderForm] = useState<ReminderFormState>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed'>('all');
  const [activeMonth, setActiveMonth] = useState(() => startOfDay(new Date()));
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReminders = async () => {
    try {
      const res = await client.get('/reminders');
      setReminders(Array.isArray(res.data) ? res.data : []);
      window.dispatchEvent(new Event('reminders-updated'));
    } catch (err) {
      console.error(err);
      toast.error('Ошибка при загрузке напоминаний');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReminders();
  }, []);

  const now = useMemo(() => new Date(), []);

  const groupedReminders = useMemo(() => {
    const today: ReminderItem[] = [];
    const overdue: ReminderItem[] = [];
    const upcoming: ReminderItem[] = [];
    const completed: ReminderItem[] = [];

    reminders.forEach((item) => {
      const bucket = getReminderBucket(item, now);
      if (bucket === 'completed') completed.push(item);
      else if (bucket === 'overdue') overdue.push(item);
      else if (bucket === 'today') today.push(item);
      else upcoming.push(item);
    });

    return { today, overdue, upcoming, completed };
  }, [now, reminders]);

  const filteredReminders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return reminders.filter((item) => {
      const bucket = getReminderBucket(item, now);
      if (filterTab !== 'all' && bucket !== filterTab) {
        return false;
      }

      if (!query) return true;

      const titleMatch = item.title.toLowerCase().includes(query);
      const descMatch = (item.description || '').toLowerCase().includes(query);
      const typeLabel = getTypeMeta(item.type).label.toLowerCase();
      const typeMatch = typeLabel.includes(query);
      const userMatch = (item.user?.username || '').toLowerCase().includes(query);

      return titleMatch || descMatch || typeMatch || userMatch;
    });
  }, [filterTab, now, reminders, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchTerm]);

  const totalPages = Math.ceil(filteredReminders.length / reminderPageSize) || 1;

  const paginatedReminders = useMemo(() => {
    const start = (currentPage - 1) * reminderPageSize;
    return filteredReminders.slice(start, start + reminderPageSize);
  }, [currentPage, filteredReminders, reminderPageSize]);

  const paginatedGroupedReminders = useMemo(() => {
    const today: ReminderItem[] = [];
    const overdue: ReminderItem[] = [];
    const upcoming: ReminderItem[] = [];
    const completed: ReminderItem[] = [];

    paginatedReminders.forEach((item) => {
      const bucket = getReminderBucket(item, now);
      if (bucket === 'completed') completed.push(item);
      else if (bucket === 'overdue') overdue.push(item);
      else if (bucket === 'today') today.push(item);
      else upcoming.push(item);
    });

    return { today, overdue, upcoming, completed };
  }, [now, paginatedReminders]);

  const handleComplete = async (id: number) => {
    try {
      await client.patch(`/reminders/${id}/toggle`);
      toast.success('Статус задачи обновлен');
      void fetchReminders();
    } catch (err) {
      console.error(err);
      toast.error('Не удалось обновить статус');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить эту задачу?')) return;

    try {
      await client.delete(`/reminders/${id}`);
      toast.success('Задача удалена');
      void fetchReminders();
    } catch (err) {
      console.error(err);
      toast.error('Не удалось удалить задачу');
    }
  };

  const openCreateModal = () => {
    setSelectedReminder(null);
    setReminderForm({
      ...EMPTY_FORM,
      dueDate: formatDateInputValue(new Date()),
    });
    setShowModal(true);
  };

  const openReminderModal = (reminder: ReminderItem) => {
    setSelectedReminder(reminder);
    setReminderForm({
      title: reminder.title,
      description: reminder.description || '',
      dueDate: formatDateInputValue(parseReminderDate(reminder.dueDate)),
      type: reminder.type || 'general',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedReminder(null);
    setReminderForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reminderForm.title.trim() || !reminderForm.dueDate) {
      toast.error('Заполните название и дату');
      return;
    }

    try {
      if (selectedReminder) {
        await client.put(`/reminders/${selectedReminder.id}`, {
          title: reminderForm.title.trim(),
          description: reminderForm.description.trim() || null,
          dueDate: reminderForm.dueDate,
          type: reminderForm.type,
        });
        toast.success('Задача обновлена');
      } else {
        await client.post('/reminders', {
          title: reminderForm.title.trim(),
          description: reminderForm.description.trim() || null,
          dueDate: reminderForm.dueDate,
          type: reminderForm.type,
        });
        toast.success('Задача создана');
      }

      closeModal();
      void fetchReminders();
    } catch (err) {
      console.error(err);
      toast.error('Ошибка при сохранении задачи');
    }
  };

  const categoryCounts = useMemo(() => {
    return reminders.reduce<Record<string, number>>((acc, item) => {
      const key = String(item.type || 'general').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [reminders]);

  const monthDays = useMemo(() => buildCalendarDays(activeMonth), [activeMonth]);
  const activeMonthLabel = activeMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const sections = [
    { key: 'overdue', title: 'Просрочено', items: paginatedGroupedReminders.overdue, accent: 'text-rose-600 bg-rose-50 border-rose-200' },
    { key: 'today', title: 'Сегодня', items: paginatedGroupedReminders.today, accent: 'text-amber-600 bg-amber-50 border-amber-200' },
    { key: 'upcoming', title: 'Предстоящие', items: paginatedGroupedReminders.upcoming, accent: 'text-sky-600 bg-sky-50 border-sky-200' },
    { key: 'completed', title: 'Выполнены', items: paginatedGroupedReminders.completed, accent: 'text-slate-500 bg-slate-100 border-slate-200' },
  ] as const;

  const reminderTabs = [
    { key: 'all', label: 'Все задачи', count: reminders.length },
    { key: 'today', label: 'Сегодня', count: groupedReminders.today.length },
    { key: 'overdue', label: 'Просрочены', count: groupedReminders.overdue.length },
    { key: 'upcoming', label: 'Скоро', count: groupedReminders.upcoming.length },
    { key: 'completed', label: 'Выполнены', count: groupedReminders.completed.length },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 shadow-xs">
                  <Bell size={20} />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Задачи и Напоминания</h1>
              </div>
              <p className="mt-2 text-sm text-slate-500">Управляйте ежедневными задачами, звонками клиентам и складскими делами</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск задач..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                />
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-700 hover:to-indigo-700 hover:shadow-violet-500/30"
              >
                <Plus size={18} />
                Новая задача
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition-all hover:bg-slate-50">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Всего задач</span>
                <Layers size={16} className="text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{reminders.length}</p>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 transition-all hover:bg-rose-50/80">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-600">
                <span>Просрочено</span>
                <AlertCircle size={16} className="text-rose-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">{groupedReminders.overdue.length}</p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 transition-all hover:bg-amber-50/80">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-600">
                <span>На сегодня</span>
                <Clock3 size={16} className="text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">{groupedReminders.today.length}</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 transition-all hover:bg-emerald-50/80">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-600">
                <span>Выполнено</span>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">{groupedReminders.completed.length}</p>
            </div>
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/80 bg-white p-2 shadow-sm">
              <div className="sm:hidden">
                <select
                  value={filterTab}
                  onChange={(e) => setFilterTab(e.target.value as typeof filterTab)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none"
                >
                  {reminderTabs.map((tab) => (
                    <option key={tab.key} value={tab.key}>
                      {tab.label} ({tab.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="hidden grid-cols-5 gap-1.5 sm:grid">
                {reminderTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilterTab(tab.key as typeof filterTab)}
                    className={clsx(
                      'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
                      filterTab === tab.key
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={clsx(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                        filterTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-white bg-white py-20 text-center text-sm font-medium text-slate-400 shadow-sm">
                Загрузка задач...
              </div>
            ) : (
              <div className="space-y-6">
                {sections.map((section) => (
                  <div key={section.key} className="space-y-3">
                    {section.items.length > 0 && (
                      <div className="flex items-center gap-2 px-1">
                        <span className={clsx('rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider', section.accent)}>
                          {section.title} ({section.items.length})
                        </span>
                      </div>
                    )}

                    <AnimatePresence>
                      {section.items.map((reminder) => {
                        const typeMeta = getTypeMeta(reminder.type);
                        const bucket = getReminderBucket(reminder, now);
                        const priorityMeta = PRIORITY_META[bucket];

                        return (
                          <motion.div
                            key={reminder.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            onClick={() => openReminderModal(reminder)}
                            className={clsx(
                              'group relative flex cursor-pointer items-start justify-between gap-4 rounded-3xl border bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md',
                              bucket === 'overdue' && 'border-rose-200/80 hover:border-rose-300',
                              bucket !== 'overdue' && 'border-slate-200/80 hover:border-slate-300',
                              bucket === 'completed' && 'bg-slate-50/50 opacity-80',
                            )}
                          >
                            <div className="flex min-w-0 items-start gap-4">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleComplete(reminder.id);
                                }}
                                className={clsx(
                                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all',
                                  reminder.isCompleted
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 shadow-xs'
                                    : 'border-slate-200 bg-white text-slate-300 hover:border-violet-300 hover:text-violet-600',
                                )}
                                title={reminder.isCompleted ? 'Отметить как невыполнено' : 'Отметить как выполнено'}
                              >
                                {reminder.isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                              </button>

                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3
                                    className={clsx(
                                      'text-base font-semibold leading-snug text-slate-900',
                                      reminder.isCompleted && 'line-through text-slate-400',
                                    )}
                                  >
                                    {reminder.title}
                                  </h3>
                                  <span className={clsx('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', priorityMeta.tone)}>
                                    {priorityMeta.label}
                                  </span>
                                </div>

                                {reminder.description && (
                                  <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
                                    {reminder.description}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                                    <Clock3 size={12} className="text-slate-400" />
                                    {formatDueLabel(reminder.dueDate, bucket)}
                                  </span>

                                  <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium', typeMeta.tone)}>
                                    <span className={clsx('h-1.5 w-1.5 rounded-full', typeMeta.dot)} />
                                    {typeMeta.label}
                                  </span>

                                  {reminder.user?.username && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                                      <User size={11} className="text-slate-400" />
                                      {reminder.user.username}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openReminderModal(reminder);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                title="Редактировать"
                              >
                                <Pencil size={15} />
                              </button>
                              {canDeleteReminder && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDelete(reminder.id);
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                  title="Удалить"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ))}

                {filteredReminders.length === 0 && (
                  <div className="rounded-3xl border border-white bg-white py-16 text-center shadow-sm">
                    <Bell size={40} className="mx-auto mb-3 text-slate-300" />
                    <h3 className="text-lg font-semibold text-slate-900">Нет задач</h3>
                    <p className="mt-1 text-xs text-slate-400">Попробуйте сменить фильтр или создайте новую задачу.</p>
                  </div>
                )}

                {filteredReminders.length > reminderPageSize && (
                  <div className="rounded-2xl border border-white bg-white p-3 shadow-sm">
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredReminders.length}
                      pageSize={reminderPageSize}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 capitalize">
                  {activeMonthLabel}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                  <span key={day} className="py-1">{day}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day) => {
                  const isCurrentMonth = day.getMonth() === activeMonth.getMonth();
                  const isToday = sameDay(day, now);
                  const hasReminders = reminders.some((reminder) => sameDay(parseReminderDate(reminder.dueDate), day));

                  return (
                    <div
                      key={day.toISOString()}
                      className={clsx(
                        'relative flex h-8 items-center justify-center rounded-xl text-xs font-medium transition-all',
                        isCurrentMonth ? 'text-slate-700' : 'text-slate-300',
                        isToday && 'bg-violet-600 font-bold text-white shadow-sm',
                        !isToday && hasReminders && 'bg-violet-50 font-bold text-violet-700',
                      )}
                    >
                      {day.getDate()}
                      {!isToday && hasReminders && (
                        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-violet-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">Категории задач</h3>
              <div className="mt-4 space-y-2">
                {Object.entries(TYPE_META).map(([key, meta]) => (
                  <div key={key} className="flex items-center justify-between rounded-2xl bg-slate-50/80 p-3 transition-colors hover:bg-slate-100/80">
                    <div className="flex items-center gap-2.5">
                      <span className={clsx('flex h-7 w-7 items-center justify-center rounded-xl text-xs', meta.iconTone)}>
                        <CalendarIcon size={14} />
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{meta.label}</span>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-700 shadow-2xs">
                      {categoryCounts[key] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 16 }}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
              >
                <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                        <Bell size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {selectedReminder ? 'Редактировать задачу' : 'Новая задача'}
                        </h3>
                        <p className="text-xs text-slate-500">Заполните подробности напоминания</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-6">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Заголовок *</label>
                    <input
                      type="text"
                      required
                      value={reminderForm.title}
                      onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-500/10"
                      placeholder="Например: Позвонить клиенту по накладной #1042"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Описание</label>
                    <textarea
                      value={reminderForm.description}
                      onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })}
                      className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-500/10"
                      placeholder="Укажите подробности задачи..."
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Срок выполнения *</label>
                      <input
                        type="date"
                        required
                        value={reminderForm.dueDate}
                        onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-500/10"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Категория</label>
                      <select
                        value={reminderForm.type}
                        onChange={(e) => setReminderForm({ ...reminderForm, type: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-500/10"
                      >
                        <option value="general">Общее</option>
                        <option value="call">Звонки клиентам</option>
                        <option value="supplier">Заказы поставщикам</option>
                        <option value="stock">Склад и учет</option>
                        <option value="finance">Финансы</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    {selectedReminder && !selectedReminder.isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleComplete(selectedReminder.id)}
                        className="mr-auto rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        Выполнить
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
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
