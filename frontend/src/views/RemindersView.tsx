import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Boxes,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  Filter,
  Layers,
  LucideIcon,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Truck,
  User,
  Wallet,
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

type CategoryMeta = {
  label: string;
  icon: LucideIcon;
  tone: string;
  badgeTone: string;
  dot: string;
  cardActive: string;
};

const TYPE_META: Record<string, CategoryMeta> = {
  general: {
    label: 'Общее',
    icon: FileText,
    tone: 'text-slate-700 bg-slate-100/90 border-slate-200/80',
    badgeTone: 'bg-slate-100 text-slate-700 border border-slate-200/70',
    dot: 'bg-slate-500',
    cardActive: 'border-slate-800 bg-slate-50 ring-1 ring-slate-800',
  },
  call: {
    label: 'Звонки клиентам',
    icon: Phone,
    tone: 'text-sky-700 bg-sky-50 border-sky-200/80',
    badgeTone: 'bg-sky-50 text-sky-700 border border-sky-200/70',
    dot: 'bg-sky-500',
    cardActive: 'border-sky-600 bg-sky-50/70 ring-1 ring-sky-600',
  },
  supplier: {
    label: 'Заказы поставщикам',
    icon: Truck,
    tone: 'text-amber-800 bg-amber-50 border-amber-200/80',
    badgeTone: 'bg-amber-50 text-amber-800 border border-amber-200/70',
    dot: 'bg-amber-500',
    cardActive: 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-600',
  },
  stock: {
    label: 'Склад и учет',
    icon: Boxes,
    tone: 'text-emerald-800 bg-emerald-50 border-emerald-200/80',
    badgeTone: 'bg-emerald-50 text-emerald-800 border border-emerald-200/70',
    dot: 'bg-emerald-600',
    cardActive: 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600',
  },
  finance: {
    label: 'Финансы',
    icon: Wallet,
    tone: 'text-purple-800 bg-purple-50 border-purple-200/80',
    badgeTone: 'bg-purple-50 text-purple-800 border border-purple-200/70',
    dot: 'bg-purple-600',
    cardActive: 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-600',
  },
};

const PRIORITY_META = {
  overdue: {
    label: 'Просрочено',
    tone: 'bg-rose-50 text-rose-700 border border-rose-200/90',
    accentBorder: 'border-l-4 border-l-rose-500 border-rose-200/90',
    dot: 'bg-rose-500',
  },
  today: {
    label: 'Сегодня',
    tone: 'bg-amber-50 text-amber-800 border border-amber-200/90',
    accentBorder: 'border-l-4 border-l-amber-500 border-amber-200/90',
    dot: 'bg-amber-500',
  },
  upcoming: {
    label: 'Скоро',
    tone: 'bg-sky-50 text-sky-700 border border-sky-200/90',
    accentBorder: 'border-l-4 border-l-sky-500 border-slate-200/80',
    dot: 'bg-sky-500',
  },
  completed: {
    label: 'Выполнено',
    tone: 'bg-emerald-50 text-emerald-700 border border-emerald-200/90',
    accentBorder: 'border-l-4 border-l-emerald-500 border-slate-200/60 bg-slate-50/40',
    dot: 'bg-emerald-500',
  },
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

function formatRelativeDue(value: string, bucket: 'overdue' | 'today' | 'upcoming' | 'completed', now: Date) {
  const date = parseReminderDate(value);
  const diffDays = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / (1000 * 60 * 60 * 24));

  if (bucket === 'today') {
    return 'Сегодня';
  }
  if (diffDays === 1) {
    return 'Завтра';
  }
  if (diffDays === -1) {
    return 'Вчера (просрочено)';
  }
  if (diffDays < -1) {
    return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} (${Math.abs(diffDays)} дн. назад)`;
  }
  if (diffDays <= 7) {
    return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} (через ${diffDays} дн.)`;
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function getTypeMeta(type?: string | null): CategoryMeta {
  return TYPE_META[String(type || 'general').toLowerCase()] || TYPE_META.general;
}

export default function RemindersView() {
  const reminderPageSize = 8;
  const currentUser = getCurrentUser();
  const canDeleteReminder = isAdminUser(currentUser);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null);
  const [reminderForm, setReminderForm] = useState<ReminderFormState>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [activeMonth, setActiveMonth] = useState(() => startOfDay(new Date()));
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dropdown menus state
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStatusDropdownOpen(false);
        setCategoryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

      if (selectedCategory !== 'all') {
        const itemType = String(item.type || 'general').toLowerCase();
        if (itemType !== selectedCategory) {
          return false;
        }
      }

      if (selectedCalendarDate) {
        const itemDate = parseReminderDate(item.dueDate);
        if (!sameDay(itemDate, selectedCalendarDate)) {
          return false;
        }
      }

      if (!query) return true;

      const titleMatch = item.title.toLowerCase().includes(query);
      const descMatch = (item.description || '').toLowerCase().includes(query);
      const typeLabel = getTypeMeta(item.type).label.toLowerCase();
      const typeMatch = typeLabel.includes(query);
      const userMatch = (item.user?.username || '').toLowerCase().includes(query);

      return titleMatch || descMatch || typeMatch || userMatch;
    });
  }, [filterTab, now, reminders, searchTerm, selectedCategory, selectedCalendarDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchTerm, selectedCategory, selectedCalendarDate]);

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

  const handleToggleComplete = async (reminder: ReminderItem) => {
    try {
      if (!reminder.isCompleted) {
        await client.put(`/reminders/${reminder.id}/complete`);
        toast.success('Задача выполнена!');
      } else {
        await client.put(`/reminders/${reminder.id}`, { isCompleted: false });
        toast.success('Задача возвращена в активные');
      }
      void fetchReminders();
    } catch (err) {
      console.error(err);
      toast.error('Не удалось обновить статус задачи');
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
      dueDate: formatDateInputValue(selectedCalendarDate || new Date()),
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

  const handleQuickDate = (offsetDays: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    setReminderForm((prev) => ({
      ...prev,
      dueDate: formatDateInputValue(target),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reminderForm.title.trim() || !reminderForm.dueDate) {
      toast.error('Укажите название и дату задачи');
      return;
    }

    setIsSubmitting(true);
    try {
      const isoDueDate = parseReminderDate(reminderForm.dueDate).toISOString();

      if (selectedReminder) {
        await client.put(`/reminders/${selectedReminder.id}`, {
          title: reminderForm.title.trim(),
          description: reminderForm.description.trim() || undefined,
          dueDate: isoDueDate,
          type: reminderForm.type,
        });
        toast.success('Задача обновлена');
      } else {
        await client.post('/reminders', {
          title: reminderForm.title.trim(),
          description: reminderForm.description.trim() || undefined,
          dueDate: isoDueDate,
          type: reminderForm.type,
        });
        toast.success('Задача создана');
      }

      closeModal();
      void fetchReminders();
    } catch (err) {
      console.error(err);
      toast.error('Ошибка при сохранении задачи');
    } finally {
      setIsSubmitting(false);
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

  const activeCount = groupedReminders.today.length + groupedReminders.overdue.length + groupedReminders.upcoming.length;
  const completionPercent = reminders.length > 0
    ? Math.round((groupedReminders.completed.length / reminders.length) * 100)
    : 0;

  const sections = [
    { key: 'overdue', title: 'Просрочено', items: paginatedGroupedReminders.overdue, accent: 'text-rose-700 bg-rose-50 border-rose-200' },
    { key: 'today', title: 'Сегодня', items: paginatedGroupedReminders.today, accent: 'text-amber-800 bg-amber-50 border-amber-200' },
    { key: 'upcoming', title: 'Предстоящие', items: paginatedGroupedReminders.upcoming, accent: 'text-sky-700 bg-sky-50 border-sky-200' },
    { key: 'completed', title: 'Выполнены', items: paginatedGroupedReminders.completed, accent: 'text-slate-600 bg-slate-100 border-slate-200' },
  ] as const;

  const reminderTabs: Array<{
    key: 'all' | 'today' | 'overdue' | 'upcoming' | 'completed';
    label: string;
    count: number;
    badgeTone?: string;
  }> = [
    { key: 'all', label: 'Все задачи', count: reminders.length },
    { key: 'today', label: 'Сегодня', count: groupedReminders.today.length, badgeTone: groupedReminders.today.length > 0 ? 'bg-amber-100 text-amber-800' : '' },
    { key: 'overdue', label: 'Просрочены', count: groupedReminders.overdue.length, badgeTone: groupedReminders.overdue.length > 0 ? 'bg-rose-100 text-rose-700 font-bold' : '' },
    { key: 'upcoming', label: 'Скоро', count: groupedReminders.upcoming.length },
    { key: 'completed', label: 'Выполнены', count: groupedReminders.completed.length },
  ];

  const currentTab = reminderTabs.find((t) => t.key === filterTab) || reminderTabs[0];
  const CurrentStatusIcon =
    currentTab.key === 'all'
      ? Layers
      : currentTab.key === 'today'
      ? Clock3
      : currentTab.key === 'overdue'
      ? AlertCircle
      : currentTab.key === 'upcoming'
      ? CalendarIcon
      : CheckCircle2;

  const isAllCategory = selectedCategory === 'all';
  const currentCategoryMeta = TYPE_META[selectedCategory];
  const CurrentCategoryIcon = isAllCategory ? Filter : currentCategoryMeta?.icon || Filter;
  const currentCategoryLabel = isAllCategory ? 'Все категории' : currentCategoryMeta?.label || 'Категория';
  const currentCategoryCount = isAllCategory ? reminders.length : categoryCounts[selectedCategory] || 0;

  return (
    <div className="min-h-screen bg-[#f4f5fb]/80 p-3 sm:p-5 lg:p-6 font-sans">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        
        {/* Header Hero Card */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-500/20">
                <Bell size={24} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                    Задачи и Напоминания
                  </h1>
                  <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/80 font-mono">
                    {activeCount} активных
                  </span>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                  Контроль звонков, заказов поставщикам, складских задач и финансов
                </p>
              </div>
            </div>

            {/* Search & Action Button */}
            <div className="flex flex-row items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск по названию или описанию..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9.5 pr-8 text-xs sm:text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-3 focus:ring-emerald-500/10 shadow-2xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Очистить поиск"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-all"
              >
                <Plus size={17} />
                <span>Новая задача</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5 pt-4 border-t border-slate-100">
            {/* 1. All */}
            <div 
              onClick={() => setFilterTab('all')}
              className={clsx(
                'group cursor-pointer rounded-2xl border p-3 sm:p-3.5 transition-all hover:shadow-xs',
                filterTab === 'all' ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={clsx('text-xs font-bold', filterTab === 'all' ? 'text-slate-300' : 'text-slate-500')}>
                  Всего задач
                </span>
                <span className={clsx('flex h-7 w-7 items-center justify-center rounded-xl', filterTab === 'all' ? 'bg-white/10 text-white' : 'bg-white text-slate-500 border border-slate-200/70 shadow-2xs')}>
                  <Layers size={14} />
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <p className="font-mono text-xl sm:text-2xl font-black tracking-tight tabular-nums">
                  {reminders.length}
                </p>
                <span className={clsx('text-[11px] font-semibold', filterTab === 'all' ? 'text-slate-400' : 'text-slate-400')}>
                  {activeCount} активных
                </span>
              </div>
            </div>

            {/* 2. Overdue */}
            <div 
              onClick={() => setFilterTab('overdue')}
              className={clsx(
                'group cursor-pointer rounded-2xl border p-3 sm:p-3.5 transition-all hover:shadow-xs',
                filterTab === 'overdue' 
                  ? 'border-rose-600 bg-rose-600 text-white' 
                  : groupedReminders.overdue.length > 0
                    ? 'border-rose-200 bg-rose-50/70 hover:bg-rose-50' 
                    : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={clsx('text-xs font-bold', filterTab === 'overdue' ? 'text-rose-100' : groupedReminders.overdue.length > 0 ? 'text-rose-700' : 'text-slate-500')}>
                  Просрочено
                </span>
                <span className={clsx('flex h-7 w-7 items-center justify-center rounded-xl', filterTab === 'overdue' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600')}>
                  <AlertCircle size={14} />
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <p className={clsx('font-mono text-xl sm:text-2xl font-black tracking-tight tabular-nums', filterTab === 'overdue' ? 'text-white' : 'text-rose-600')}>
                  {groupedReminders.overdue.length}
                </p>
                <span className={clsx('text-[11px] font-semibold', filterTab === 'overdue' ? 'text-rose-200' : groupedReminders.overdue.length > 0 ? 'text-rose-600' : 'text-slate-400')}>
                  {groupedReminders.overdue.length > 0 ? 'Срочно!' : 'Все в срок'}
                </span>
              </div>
            </div>

            {/* 3. Today */}
            <div 
              onClick={() => setFilterTab('today')}
              className={clsx(
                'group cursor-pointer rounded-2xl border p-3 sm:p-3.5 transition-all hover:shadow-xs',
                filterTab === 'today'
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : groupedReminders.today.length > 0
                    ? 'border-amber-200 bg-amber-50/70 hover:bg-amber-50'
                    : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={clsx('text-xs font-bold', filterTab === 'today' ? 'text-amber-100' : groupedReminders.today.length > 0 ? 'text-amber-800' : 'text-slate-500')}>
                  На сегодня
                </span>
                <span className={clsx('flex h-7 w-7 items-center justify-center rounded-xl', filterTab === 'today' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')}>
                  <Clock3 size={14} />
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <p className={clsx('font-mono text-xl sm:text-2xl font-black tracking-tight tabular-nums', filterTab === 'today' ? 'text-white' : 'text-amber-700')}>
                  {groupedReminders.today.length}
                </p>
                <span className={clsx('text-[11px] font-semibold', filterTab === 'today' ? 'text-amber-200' : 'text-slate-400')}>
                  {groupedReminders.today.length > 0 ? 'План на день' : 'Свободно'}
                </span>
              </div>
            </div>

            {/* 4. Completed */}
            <div 
              onClick={() => setFilterTab('completed')}
              className={clsx(
                'group cursor-pointer rounded-2xl border p-3 sm:p-3.5 transition-all hover:shadow-xs',
                filterTab === 'completed' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={clsx('text-xs font-bold', filterTab === 'completed' ? 'text-emerald-100' : 'text-emerald-700')}>
                  Выполнено
                </span>
                <span className={clsx('flex h-7 w-7 items-center justify-center rounded-xl', filterTab === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700')}>
                  <CheckCircle2 size={14} />
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <p className={clsx('font-mono text-xl sm:text-2xl font-black tracking-tight tabular-nums', filterTab === 'completed' ? 'text-white' : 'text-emerald-700')}>
                  {groupedReminders.completed.length}
                </p>
                <span className={clsx('text-[11px] font-semibold font-mono', filterTab === 'completed' ? 'text-emerald-200' : 'text-emerald-600')}>
                  {completionPercent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Navigation: Dropdown Menus */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Dropdown 1: Статус задач */}
              <div className="relative" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setStatusDropdownOpen(!statusDropdownOpen);
                    setCategoryDropdownOpen(false);
                  }}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all active:scale-95 shadow-2xs',
                    filterTab !== 'all'
                      ? 'border-slate-800 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <CurrentStatusIcon size={14} className={filterTab !== 'all' ? 'text-white' : 'text-slate-500'} />
                  <span>{currentTab.label}</span>
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-black font-mono leading-none',
                      filterTab !== 'all'
                        ? 'bg-white/20 text-white'
                        : currentTab.badgeTone || 'bg-white text-slate-700 border border-slate-200/80'
                    )}
                  >
                    {currentTab.count}
                  </span>
                  <ChevronDown
                    size={14}
                    className={clsx('transition-transform duration-200 text-slate-400', statusDropdownOpen && 'rotate-180')}
                  />
                </button>

                <AnimatePresence>
                  {statusDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-1.5 z-50 w-56 sm:w-60 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl shadow-slate-900/10"
                    >
                      <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Статус задач
                      </div>
                      <div className="space-y-0.5">
                        {reminderTabs.map((tab) => {
                          const isSelected = filterTab === tab.key;
                          const TabIcon =
                            tab.key === 'all'
                              ? Layers
                              : tab.key === 'today'
                              ? Clock3
                              : tab.key === 'overdue'
                              ? AlertCircle
                              : tab.key === 'upcoming'
                              ? CalendarIcon
                              : CheckCircle2;

                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => {
                                setFilterTab(tab.key as typeof filterTab);
                                setStatusDropdownOpen(false);
                              }}
                              className={clsx(
                                'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-bold transition-all text-left',
                                isSelected
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'text-slate-700 hover:bg-slate-50'
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <TabIcon
                                  size={14}
                                  className={clsx(
                                    isSelected
                                      ? 'text-white'
                                      : tab.key === 'overdue'
                                      ? 'text-rose-500'
                                      : tab.key === 'today'
                                      ? 'text-amber-500'
                                      : tab.key === 'completed'
                                      ? 'text-emerald-500'
                                      : 'text-slate-400'
                                  )}
                                />
                                <span className="truncate">{tab.label}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={clsx(
                                    'rounded-full px-1.5 py-0.5 text-[10px] font-mono font-black',
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : tab.badgeTone || 'bg-slate-100 text-slate-600'
                                  )}
                                >
                                  {tab.count}
                                </span>
                                {isSelected && <Check size={13} className="text-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dropdown 2: Категория */}
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryDropdownOpen(!categoryDropdownOpen);
                    setStatusDropdownOpen(false);
                  }}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all active:scale-95 shadow-2xs',
                    selectedCategory !== 'all'
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                      : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <CurrentCategoryIcon size={14} className={selectedCategory !== 'all' ? 'text-white' : 'text-slate-500'} />
                  <span>{currentCategoryLabel}</span>
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-black font-mono leading-none',
                      selectedCategory !== 'all'
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-700 border border-slate-200/80'
                    )}
                  >
                    {currentCategoryCount}
                  </span>
                  <ChevronDown
                    size={14}
                    className={clsx('transition-transform duration-200 text-slate-400', categoryDropdownOpen && 'rotate-180')}
                  />
                </button>

                <AnimatePresence>
                  {categoryDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-1.5 z-50 w-60 sm:w-64 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl shadow-slate-900/10"
                    >
                      <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Категория задач
                      </div>
                      <div className="space-y-0.5">
                        {/* All Categories Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('all');
                            setCategoryDropdownOpen(false);
                          }}
                          className={clsx(
                            'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-bold transition-all text-left',
                            selectedCategory === 'all'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Filter size={14} className={selectedCategory === 'all' ? 'text-white' : 'text-slate-400'} />
                            <span className="truncate">Все категории</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={clsx(
                                'rounded-full px-1.5 py-0.5 text-[10px] font-mono font-black',
                                selectedCategory === 'all'
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {reminders.length}
                            </span>
                            {selectedCategory === 'all' && <Check size={13} className="text-white" />}
                          </div>
                        </button>

                        {/* Individual Categories */}
                        {Object.entries(TYPE_META).map(([key, meta]) => {
                          const Icon = meta.icon;
                          const isSelected = selectedCategory === key;
                          const count = categoryCounts[key] || 0;

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(key);
                                setCategoryDropdownOpen(false);
                              }}
                              className={clsx(
                                'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-bold transition-all text-left',
                                isSelected
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'text-slate-700 hover:bg-slate-50'
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon
                                  size={14}
                                  className={clsx(
                                    isSelected ? 'text-white' : meta.tone?.split(' ')[0] || 'text-slate-500'
                                  )}
                                />
                                <span className="truncate">{meta.label}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={clsx(
                                    'rounded-full px-1.5 py-0.5 text-[10px] font-mono font-black',
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  )}
                                >
                                  {count}
                                </span>
                                {isSelected && <Check size={13} className="text-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Active Filters Clear Button */}
            {(filterTab !== 'all' || selectedCategory !== 'all' || selectedCalendarDate || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setFilterTab('all');
                  setSelectedCategory('all');
                  setSelectedCalendarDate(null);
                  setSearchTerm('');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors shadow-2xs active:scale-95"
                title="Сбросить все фильтры"
              >
                <RotateCcw size={13} />
                <span>Сбросить фильтры</span>
              </button>
            )}
          </div>

          {/* Active Date Filter Notice */}
          {selectedCalendarDate && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs text-emerald-900 animate-in fade-in-50 duration-150">
              <div className="flex items-center gap-2">
                <CalendarIcon size={14} className="text-emerald-700" />
                <span>
                  Показаны задачи на дату: <strong className="font-bold">{selectedCalendarDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCalendarDate(null)}
                className="flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
              >
                <span>Сбросить дату</span>
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Main 2-Column Content Layout */}
        <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          
          {/* Left Column: Tasks List */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white py-24 text-center shadow-xs">
                <div className="h-9 w-9 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                <p className="mt-3 text-xs font-semibold text-slate-500">Загрузка задач...</p>
              </div>
            ) : filteredReminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white py-20 px-4 text-center shadow-xs">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 mb-3.5">
                  <Sparkles size={30} />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {searchTerm ? 'Ничего не найдено' : 'Нет подходящих задач'}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  {searchTerm
                    ? `По запросу «${searchTerm}» задачи не найдены. Попробуйте изменить параметры поиска.`
                    : 'Все задачи в этой категории завершены или ещё не добавлены.'}
                </p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all"
                >
                  <Plus size={15} />
                  <span>Создать задачу</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {sections.map((section) => {
                  if (section.items.length === 0) return null;

                  return (
                    <div key={section.key} className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider', section.accent)}>
                            {section.title}
                          </span>
                          <span className="text-xs font-semibold text-slate-400 font-mono">
                            {section.items.length}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <AnimatePresence>
                          {section.items.map((reminder) => {
                            const typeMeta = getTypeMeta(reminder.type);
                            const CategoryIcon = typeMeta.icon;
                            const bucket = getReminderBucket(reminder, now);
                            const priorityMeta = PRIORITY_META[bucket];

                            return (
                              <motion.div
                                key={reminder.id}
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => openReminderModal(reminder)}
                                className={clsx(
                                  'group relative flex cursor-pointer items-start justify-between gap-3 sm:gap-4 rounded-2xl border bg-white p-3.5 sm:p-4 shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5',
                                  priorityMeta.accentBorder,
                                  reminder.isCompleted && 'opacity-70 bg-slate-50/50'
                                )}
                              >
                                <div className="flex min-w-0 items-start gap-3 sm:gap-3.5 flex-1">
                                  {/* Checkbox Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleToggleComplete(reminder);
                                    }}
                                    className={clsx(
                                      'mt-0.5 flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-90',
                                      reminder.isCompleted
                                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                                        : 'border-slate-300 bg-white text-transparent hover:border-emerald-500 hover:text-emerald-400'
                                    )}
                                    title={reminder.isCompleted ? 'Отметить как невыполненную' : 'Отметить как выполненную'}
                                  >
                                    <Check size={14} className={reminder.isCompleted ? 'stroke-3' : ''} />
                                  </button>

                                  {/* Content */}
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3
                                        className={clsx(
                                          'text-sm sm:text-base font-bold leading-snug text-slate-900 group-hover:text-emerald-800 transition-colors',
                                          reminder.isCompleted && 'line-through text-slate-400 group-hover:text-slate-400'
                                        )}
                                      >
                                        {reminder.title}
                                      </h3>

                                      <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', priorityMeta.tone)}>
                                        {priorityMeta.label}
                                      </span>
                                    </div>

                                    {reminder.description && (
                                      <p className="text-xs sm:text-sm leading-relaxed text-slate-600 line-clamp-2">
                                        {reminder.description}
                                      </p>
                                    )}

                                    {/* Badges Row */}
                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
                                      {/* Due date badge */}
                                      <span className={clsx(
                                        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold border',
                                        bucket === 'overdue' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                        bucket === 'today' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                        'bg-slate-100/80 text-slate-600 border-slate-200/60'
                                      )}>
                                        <Clock3 size={12} className={bucket === 'overdue' ? 'text-rose-500' : bucket === 'today' ? 'text-amber-600' : 'text-slate-400'} />
                                        <span>{formatRelativeDue(reminder.dueDate, bucket, now)}</span>
                                      </span>

                                      {/* Category badge */}
                                      <span className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-medium border', typeMeta.badgeTone)}>
                                        <CategoryIcon size={12} />
                                        <span>{typeMeta.label}</span>
                                      </span>

                                      {/* Creator badge */}
                                      {reminder.user?.username && (
                                        <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                          <User size={11} className="text-slate-400" />
                                          <span>{reminder.user.username}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right Quick Actions */}
                                <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openReminderModal(reminder);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                    title="Редактировать"
                                  >
                                    <Pencil size={14} />
                                  </button>

                                  {canDeleteReminder && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleDelete(reminder.id);
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                      title="Удалить задачу"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}

                {filteredReminders.length > reminderPageSize && (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
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

          {/* Right Column: Calendar & Categories Widgets */}
          <div className="space-y-4">
            
            {/* Calendar Card */}
            <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-emerald-600" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 capitalize">
                    {activeMonthLabel}
                  </h3>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveMonth(new Date())}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors mr-1"
                    title="Текущий месяц"
                  >
                    Сегодня
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                  <span key={day} className="py-1">{day}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day) => {
                  const isCurrentMonth = day.getMonth() === activeMonth.getMonth();
                  const isToday = sameDay(day, now);
                  const isSelected = selectedCalendarDate && sameDay(day, selectedCalendarDate);
                  
                  const dayReminders = reminders.filter((reminder) =>
                    sameDay(parseReminderDate(reminder.dueDate), day)
                  );
                  const hasOverdue = dayReminders.some((r) => getReminderBucket(r, now) === 'overdue');
                  const hasTodayTask = dayReminders.some((r) => getReminderBucket(r, now) === 'today');
                  const hasReminders = dayReminders.length > 0;

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCalendarDate(null);
                        } else {
                          setSelectedCalendarDate(day);
                        }
                      }}
                      className={clsx(
                        'relative flex h-8 sm:h-8.5 flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all active:scale-95',
                        !isCurrentMonth && 'text-slate-300 hover:text-slate-400',
                        isCurrentMonth && !isToday && !isSelected && 'text-slate-700 hover:bg-slate-100',
                        isToday && !isSelected && 'bg-emerald-600 text-white font-black shadow-xs',
                        isSelected && 'border-2 border-emerald-600 bg-emerald-50 text-emerald-900 font-black shadow-xs'
                      )}
                    >
                      <span>{day.getDate()}</span>
                      {hasReminders && !isToday && (
                        <span
                          className={clsx(
                            'absolute bottom-1 h-1 w-1 rounded-full',
                            hasOverdue ? 'bg-rose-500' : hasTodayTask ? 'bg-amber-500' : 'bg-emerald-600'
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedCalendarDate && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Фильтр: <strong>{selectedCalendarDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDate(null)}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Сбросить
                  </button>
                </div>
              )}
            </div>

            {/* Category Breakdown Widget */}
            <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Категории задач
                </h3>
                {selectedCategory !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className="text-[11px] font-bold text-emerald-600 hover:underline"
                  >
                    Показать все
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {Object.entries(TYPE_META).map(([key, meta]) => {
                  const Icon = meta.icon;
                  const count = categoryCounts[key] || 0;
                  const isSelected = selectedCategory === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedCategory(isSelected ? 'all' : key)}
                      className={clsx(
                        'flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-all active:scale-[0.99]',
                        isSelected
                          ? 'border border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 text-slate-700'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={clsx(
                          'flex h-7 w-7 items-center justify-center rounded-lg text-xs',
                          isSelected ? 'bg-white/20 text-white' : meta.tone
                        )}>
                          <Icon size={14} />
                        </span>
                        <span className="text-xs font-bold">{meta.label}</span>
                      </div>

                      <span className={clsx(
                        'rounded-full px-2 py-0.5 text-xs font-bold font-mono',
                        isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-700 border border-slate-200/60 shadow-2xs'
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Create / Edit Task Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 16 }}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl border border-slate-100"
              >
                {/* Modal Header */}
                <div className="border-b border-slate-100 bg-slate-50/90 px-5 sm:px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-2xs">
                        <Bell size={20} />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                          {selectedReminder ? 'Редактировать задачу' : 'Новая задача'}
                        </h3>
                        <p className="text-xs text-slate-500">Укажите детали напоминания и срок выполнения</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
                    {/* Title */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Название задачи <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={reminderForm.title}
                        onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal focus:border-emerald-600 focus:ring-3 focus:ring-emerald-500/15"
                        placeholder="Например: Позвонить поставщику по заказу #1042"
                      />
                    </div>

                    {/* Quick Date Shortcuts + Date Input */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Срок выполнения <span className="text-rose-500">*</span>
                      </label>

                      {/* Quick Buttons */}
                      <div className="mb-2 grid grid-cols-4 gap-1.5">
                        {[
                          { label: 'Сегодня', offset: 0 },
                          { label: 'Завтра', offset: 1 },
                          { label: '+3 дня', offset: 3 },
                          { label: '+1 неделя', offset: 7 },
                        ].map((btn) => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() => handleQuickDate(btn.offset)}
                            className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition-colors active:scale-95"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <input
                          type="date"
                          required
                          value={reminderForm.dueDate}
                          onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-emerald-600 focus:ring-3 focus:ring-emerald-500/15"
                        />
                      </div>
                    </div>

                    {/* Visual Category Selector */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Категория задачи
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(TYPE_META).map(([key, meta]) => {
                          const Icon = meta.icon;
                          const isSelected = reminderForm.type === key;

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setReminderForm({ ...reminderForm, type: key })}
                              className={clsx(
                                'flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all active:scale-95',
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold ring-2 ring-emerald-600/30'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                              )}
                            >
                              <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg text-xs shrink-0', meta.tone)}>
                                <Icon size={14} />
                              </span>
                              <span className="text-xs font-semibold leading-tight line-clamp-1">{meta.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Описание и заметки
                      </label>
                      <textarea
                        value={reminderForm.description}
                        onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })}
                        rows={3}
                        className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-600 focus:ring-3 focus:ring-emerald-500/15"
                        placeholder="Укажите подробности: контакты, сумму, номер накладной или другие детали..."
                      />
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                    {selectedReminder && !selectedReminder.isCompleted ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleToggleComplete(selectedReminder);
                          closeModal();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <Check size={14} />
                        <span>Выполнить</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <span>Сохранение...</span>
                        ) : selectedReminder ? (
                          <span>Сохранить</span>
                        ) : (
                          <span>Создать задачу</span>
                        )}
                      </button>
                    </div>
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
