import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, setDefaultWarehouse } from '../api/warehouses.api';
import {
  Warehouse,
  Users,
  User,
  Shield,
  ShieldCheck,
  Star,
  Plus,
  Trash2,
  Edit,
  MapPin,
  Phone,
  Settings as SettingsIcon,
  Eye,
  Lock,
  CheckCircle2,
  ChevronDown,
  Building2,
  ShieldAlert,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { getCurrentUser } from '../utils/userAccess';
import { updateStoredUser } from '../utils/authStorage';
import TwoFactorSettingsCard from '../components/settings/TwoFactorSettingsCard';
import UserTwoFactorModal from '../components/settings/UserTwoFactorModal';
import { invalidateSettingsReferenceCache } from '../api/settings-reference.api';
import PaginationControls from '../components/common/PaginationControls';

export default function SettingsView() {
  const warehousesPageSize = 6;
  const ConfirmationModal = React.lazy(() => import('../components/common/ConfirmationModal'));
  const emptyUserForm = {
    username: '',
    password: '',
    confirmPassword: '',
    role: 'SELLER',
    warehouseId: '',
    customerId: '',
    canCancelInvoices: false,
    canDeleteData: false,
  };
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [customerOptions, setCustomerOptions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [companyProfile, setCompanyProfile] = useState({
    name: '',
    country: '',
    region: '',
    city: '',
    addressLine: '',
    phone: '',
    note: '',
  });
  const [activeTab, setActiveTab] = useState<'warehouses' | 'users' | 'general' | 'profile'>('warehouses');
  
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [showEditWarehouse, setShowEditWarehouse] = useState(false);
  const [showDeleteWarehouseConfirm, setShowDeleteWarehouseConfirm] = useState(false);
  const [isDeletingWarehouse, setIsDeletingWarehouse] = useState(false);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    city: '',
    address: '',
    phone: ''
  });

  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showUserTwoFactorModal, setShowUserTwoFactorModal] = useState(false);
  const [newUser, setNewUser] = useState(emptyUserForm);
  const [warehousePage, setWarehousePage] = useState(1);

  const [profileForm, setProfileForm] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const currentUser = getCurrentUser();
  const role = String(currentUser.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN';
  const canManageSettings = role === 'ADMIN' || role === 'MANAGER';
  const canViewUsers = role === 'ADMIN' || role === 'MANAGER';
  const tabTheme = {
    warehouses: 'bg-sky-500 text-white shadow-lg shadow-sky-500/20',
    users: 'bg-violet-500 text-white shadow-lg shadow-violet-500/20',
    profile: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
    general: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20',
  } as const;
  const enabledTwoFactorCount = users.filter((user) => user.twoFactorEnabled).length;
  const adminCount = users.filter((user) => String(user.role || '').toUpperCase() === 'ADMIN').length;
  const currentUserWarehouseLabel = currentUser?.warehouse?.name || 'Все склады';
  const companyPreviewLines = [
    companyProfile.name,
    companyProfile.country,
    [companyProfile.region, companyProfile.city].filter(Boolean).join(', '),
    companyProfile.addressLine,
    companyProfile.phone,
  ].filter(Boolean);
  const activeTabMeta = {
    warehouses: {
      title: 'Точки продаж и склады',
      description: 'Управляйте филиалами, адресами и основным складом системы.',
      icon: Warehouse,
      accent: 'text-sky-600 bg-sky-50 border-sky-100',
    },
    users: {
      title: 'Пользователи и роли',
      description: 'Контролируйте доступ команды, роли сотрудников и двухфакторную защиту.',
      icon: Users,
      accent: 'text-violet-600 bg-violet-50 border-violet-100',
    },
    profile: {
      title: 'Профиль и безопасность',
      description: 'Обновляйте логин, пароль и персональные параметры входа.',
      icon: User,
      accent: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
    general: {
      title: 'Профиль компании',
      description: 'Реквизиты компании и системные параметры для печати и каталога.',
      icon: SettingsIcon,
      accent: 'text-amber-600 bg-amber-50 border-amber-100',
    },
  } as const;
  const currentTabMeta = activeTabMeta[activeTab];
  const warehousesTotalPages = Math.max(1, Math.ceil(warehouses.length / warehousesPageSize));
  const paginatedWarehouses = React.useMemo(
    () => warehouses.slice((warehousePage - 1) * warehousesPageSize, warehousePage * warehousesPageSize),
    [warehousePage, warehouses],
  );

  const closeWarehouseModal = () => {
    setShowAddWarehouse(false);
    setShowEditWarehouse(false);
    resetWarehouseForm();
  };

  const closeUserModal = () => {
    setShowAddUser(false);
    setShowEditUser(false);
    setSelectedUser(null);
    setNewUser(emptyUserForm);
  };

  const closeUserTwoFactor = () => {
    setShowUserTwoFactorModal(false);
    setSelectedUser(null);
  };

  useEffect(() => {
    fetchData();
    setProfileForm({
      username: currentUser.username || '',
      password: '',
      confirmPassword: ''
    });
  }, []);

  useEffect(() => {
    if (
      !showAddWarehouse &&
      !showEditWarehouse &&
      !showAddUser &&
      !showEditUser &&
      !showDeleteWarehouseConfirm &&
      !showDeleteUserConfirm &&
      !showUserTwoFactorModal
    ) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (showDeleteWarehouseConfirm) {
        setShowDeleteWarehouseConfirm(false);
        setSelectedWarehouse(null);
        return;
      }

      if (showDeleteUserConfirm) {
        setShowDeleteUserConfirm(false);
        setSelectedUser(null);
        return;
      }

      if (showUserTwoFactorModal) return closeUserTwoFactor();
      if (showAddUser || showEditUser) return closeUserModal();
      if (showAddWarehouse || showEditWarehouse) return closeWarehouseModal();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showAddUser,
    showAddWarehouse,
    showDeleteUserConfirm,
    showDeleteWarehouseConfirm,
    showEditUser,
    showEditWarehouse,
    showUserTwoFactorModal,
  ]);

  useEffect(() => {
    setWarehousePage(1);
  }, [activeTab]);

  useEffect(() => {
    if (warehousePage > warehousesTotalPages) {
      setWarehousePage(warehousesTotalPages);
    }
  }, [warehousePage, warehousesTotalPages]);

  const fetchData = async () => {
    try {
      const wData = await getWarehouses();
      setWarehouses(wData);
      
      if (canManageSettings) {
        const sRes = await client.get('/settings');
        setSettings(sRes.data);
        const companyRes = await client.get('/settings/company-profile');
        setCompanyProfile({
          name: companyRes.data?.name || '',
          country: companyRes.data?.country || '',
          region: companyRes.data?.region || '',
          city: companyRes.data?.city || '',
          addressLine: companyRes.data?.addressLine || '',
          phone: companyRes.data?.phone || '',
          note: companyRes.data?.note || '',
        });
      }
      
      if (canViewUsers) {
        const uRes = await client.get('/auth/users');
        setUsers(uRes.data || []);
        const cRes = await client.get('/customers');
        setCustomerOptions(Array.isArray(cRes.data) ? cRes.data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingForm) return;
    try {
      setIsSubmittingForm(true);
      await createWarehouse(warehouseForm);
      toast.success('Склад успешно создан');
      setShowAddWarehouse(false);
      resetWarehouseForm();
      fetchData();
    } catch (err) {
      toast.error('Ошибка при создании склада');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleEditWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse || isSubmittingForm) return;
    try {
      setIsSubmittingForm(true);
      await updateWarehouse(selectedWarehouse.id, warehouseForm);
      toast.success('Склад обновлен');
      setShowEditWarehouse(false);
      resetWarehouseForm();
      fetchData();
    } catch (err) {
      toast.error('Ошибка при обновлении склада');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleDeleteWarehouse = async (warehouseToDelete = selectedWarehouse) => {
    if (!warehouseToDelete) return;
    if (isDeletingWarehouse) {
      setShowDeleteWarehouseConfirm(false);
      setSelectedWarehouse(null);
      return;
    }

    setIsDeletingWarehouse(true);
    setShowDeleteWarehouseConfirm(false);
    setSelectedWarehouse(null);

    try {
      await deleteWarehouse(warehouseToDelete.id);
      toast.success('Склад удален', { id: 'warehouse-delete' });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Ошибка при удалении склада', { id: 'warehouse-delete' });
    } finally {
      setShowDeleteWarehouseConfirm(false);
      setSelectedWarehouse(null);
      setIsDeletingWarehouse(false);
    }
  };

  const closeDeleteWarehouseConfirm = () => {
    setShowDeleteWarehouseConfirm(false);
    setSelectedWarehouse(null);
  };

  const openDeleteWarehouseConfirm = (warehouse: any) => {
    if (isDeletingWarehouse) return;
    setSelectedWarehouse(warehouse);
    setShowDeleteWarehouseConfirm(true);
  };

  const resetWarehouseForm = () => {
    setWarehouseForm({ name: '', city: '', address: '', phone: '' });
    setSelectedWarehouse(null);
  };

  const handleSetDefaultWarehouse = async (warehouseId: number) => {
    try {
      await setDefaultWarehouse(warehouseId);
      toast.success('Основной склад обновлен');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при выборе основного склада');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!isAdmin) {
      toast.error('Недостаточно прав');
      return;
    }
    try {
      await client.delete(`/auth/users/${selectedUser.id}`);
      toast.success('Пользователь удален');
      setShowDeleteUserConfirm(false);
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      toast.error('Ошибка при удалении пользователя');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Недостаточно прав');
      return;
    }
    if (newUser.password !== newUser.confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    if (isSubmittingForm) return;
    try {
      setIsSubmittingForm(true);
      const { confirmPassword, ...payload } = newUser;
      const effectiveWarehouseId = payload.warehouseId || (warehouses.length === 1 ? String(warehouses[0].id) : '');
      await client.post('/auth/register', {
        ...payload,
        warehouseId: effectiveWarehouseId ? Number(effectiveWarehouseId) : undefined,
        customerId: payload.customerId ? Number(payload.customerId) : undefined,
      });
      toast.success('Пользователь создан');
      closeUserModal();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при создании пользователя');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!isAdmin) {
      toast.error('Недостаточно прав');
      return;
    }
    if (newUser.password && newUser.password !== newUser.confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    if (isSubmittingForm) return;
    try {
      setIsSubmittingForm(true);
      const { confirmPassword, ...payload } = newUser;
      const effectiveWarehouseId = payload.warehouseId || (warehouses.length === 1 ? String(warehouses[0].id) : '');
      await client.put(`/auth/users/${selectedUser.id}`, {
        ...payload,
        warehouseId: effectiveWarehouseId ? Number(effectiveWarehouseId) : null,
        customerId: payload.customerId ? Number(payload.customerId) : null,
      });
      toast.success('Пользователь обновлен');
      closeUserModal();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при обновлении пользователя');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingForm) return;
    try {
      if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
        toast.error('Пароли не совпадают');
        return;
      }

      setIsSubmittingForm(true);
      const data: any = { username: profileForm.username };
      if (profileForm.password) data.password = profileForm.password;

      const res = await client.put(`/auth/users/${currentUser.id}`, data);
      toast.success('Профиль обновлен. Пожалуйста, войдите снова, если вы изменили логин или пароль.');

      // Update local storage if needed, but safer to just let them re-login if they changed sensitive info
      const updatedUser = { ...currentUser, ...res.data };
      updateStoredUser(updatedUser);

      setProfileForm({ ...profileForm, password: '', confirmPassword: '' });
    } catch (err) {
      toast.error('Ошибка при обновлении профиля');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    if (!canManageSettings) {
      toast.error('Недостаточно прав');
      return;
    }
    try {
      await client.post('/settings', { key, value });
      invalidateSettingsReferenceCache();
      setSettings({ ...settings, [key]: value });
      toast.success('Настройки сохранены');
    } catch (err) {
      toast.error('Ошибка при сохранении настроек');
    }
  };

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) {
      toast.error('Недостаточно прав');
      return;
    }
    if (isSubmittingForm) return;

    try {
      setIsSubmittingForm(true);
      await client.post('/settings/company-profile', companyProfile);
      invalidateSettingsReferenceCache();
      toast.success('Данные компании сохранены');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при сохранении данных компании');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <div className="app-page-shell">
      <div className="w-full pb-20">
        <section className="rounded-4xl border border-white/80 bg-bg-main shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200/60 bg-white px-6 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className={clsx('flex h-14 w-14 items-center justify-center rounded-2xl border shadow-xs', currentTabMeta.accent)}>
                <currentTabMeta.icon size={26} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Настройки системы</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{currentTabMeta.title}</h1>
                <p className="mt-1 text-sm text-slate-500">{currentTabMeta.description}</p>
              </div>
            </div>

            {activeTab === 'general' && canManageSettings ? (
              <button
                type="button"
                onClick={() => (document.getElementById('company-profile-form') as HTMLFormElement | null)?.requestSubmit()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition-all hover:from-amber-600 hover:to-orange-600 active:scale-95"
              >
                <CheckCircle2 size={18} />
                <span>Сохранить изменения</span>
              </button>
            ) : null}
          </div>

          <div className="grid gap-6 p-4 xl:items-start xl:grid-cols-[280px_minmax(0,1fr)] xl:p-6">
            <aside className="self-start space-y-4 xl:sticky xl:top-6">
              <div className="rounded-[28px] border border-slate-200/80 bg-white p-3 shadow-xs">
                <div className="space-y-1.5">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Разделы настроек</p>
                  {canManageSettings && (
                    <button
                      onClick={() => setActiveTab('general')}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all',
                        activeTab === 'general'
                          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                          : 'text-slate-600 hover:bg-amber-50/80 hover:text-amber-700',
                      )}
                    >
                      <SettingsIcon size={18} />
                      <span>Профиль компании</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('warehouses')}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all',
                      activeTab === 'warehouses'
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                        : 'text-slate-600 hover:bg-sky-50/80 hover:text-sky-700',
                    )}
                  >
                    <Warehouse size={18} />
                    <span>Склады и точки</span>
                  </button>
                  {canViewUsers && (
                    <button
                      onClick={() => setActiveTab('users')}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all',
                        activeTab === 'users'
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
                          : 'text-slate-600 hover:bg-violet-50/80 hover:text-violet-700',
                      )}
                    >
                      <Users size={18} />
                      <span>Пользователи и роли</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all',
                      activeTab === 'profile'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'text-slate-600 hover:bg-emerald-50/80 hover:text-emerald-700',
                    )}
                  >
                    <User size={18} />
                    <span>Профиль</span>
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Текущий раздел</p>
                <div className={clsx('mt-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border shadow-2xs', currentTabMeta.accent)}>
                  <currentTabMeta.icon size={22} />
                </div>
                <p className="mt-3 text-base font-bold text-slate-900">{currentTabMeta.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{currentTabMeta.description}</p>
              </div>
            </aside>

            <div className="min-w-0 space-y-8">

      <AnimatePresence>
        {(showAddWarehouse || showEditWarehouse) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeWarehouseModal}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-4xl bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 sm:max-h-[92vh] sm:rounded-[2.5rem]"
            >
              <div className="relative overflow-hidden border-b border-slate-100 bg-linear-to-br from-sky-50 via-white to-white p-5 sm:p-8">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-200/30 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <h3 className="flex items-center space-x-3.5">
                    <div className="rounded-2xl bg-linear-to-br from-sky-500 to-sky-600 p-3 text-white shadow-lg shadow-sky-500/30 ring-4 ring-sky-500/10">
                      <Warehouse size={22} />
                    </div>
                    <span className="flex flex-col">
                      <span className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                        {showEditWarehouse ? 'Редактировать склад' : 'Новый склад'}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        {showEditWarehouse ? 'Обновите данные точки хранения' : 'Добавьте новую точку хранения'}
                      </span>
                    </span>
                  </h3>
                  <button
                    onClick={closeWarehouseModal}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <form onSubmit={showEditWarehouse ? handleEditWarehouse : handleAddWarehouse} className="space-y-4 p-5 sm:p-8">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Название</label>
                    <div className="relative">
                      <Building2 size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={warehouseForm.name}
                        onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        placeholder="Напр: Основной склад"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Город</label>
                      <div className="relative">
                        <MapPin size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={warehouseForm.city}
                          onChange={e => setWarehouseForm({...warehouseForm, city: e.target.value})}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                          placeholder="Душанбе"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Телефон</label>
                      <div className="relative">
                        <Phone size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={warehouseForm.phone}
                          onChange={e => setWarehouseForm({...warehouseForm, phone: e.target.value})}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                          placeholder="+992 900 00 00 00"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Адрес</label>
                    <div className="relative">
                      <MapPin size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={warehouseForm.address}
                        onChange={e => setWarehouseForm({...warehouseForm, address: e.target.value})}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        placeholder="ул. Рудаки 10"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end sm:gap-3 sm:pt-4">
                  <button type="button" onClick={closeWarehouseModal} className="rounded-2xl px-6 py-3.5 font-semibold text-slate-500 transition-all hover:bg-slate-50">Отмена</button>
                  <button type="submit" disabled={isSubmittingForm} className="rounded-2xl bg-linear-to-br from-sky-500 to-sky-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:shadow-xl hover:shadow-sky-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmittingForm ? 'Сохранение...' : showEditWarehouse ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {(showAddUser || showEditUser) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeUserModal}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-4xl bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 sm:max-h-[88vh] sm:rounded-[2.5rem]"
            >
              <div className="relative overflow-hidden border-b border-slate-100 bg-linear-to-br from-violet-50 via-white to-white p-5 sm:p-6">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-200/30 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <h3 className="flex items-center space-x-3.5">
                    <div className="rounded-2xl bg-linear-to-br from-violet-500 to-violet-600 p-3 text-white shadow-lg shadow-violet-500/30 ring-4 ring-violet-500/10">
                      <Users size={20} />
                    </div>
                    <span className="flex flex-col">
                      <span className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                        {showEditUser ? 'Редактировать пользователя' : 'Новый пользователь'}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        {showEditUser ? 'Обновите роль, склад и права доступа' : 'Создайте учётную запись сотрудника'}
                      </span>
                    </span>
                  </h3>
                  <button
                    onClick={closeUserModal}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <form onSubmit={showEditUser ? handleEditUser : handleAddUser} className="space-y-4 p-5 sm:space-y-5 sm:p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Логин</label>
                    <div className="relative">
                      <User size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value})}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        placeholder="username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {showEditUser ? 'Новый пароль (необязательно)' : 'Пароль'}
                    </label>
                    <div className="relative">
                      <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        required={!showEditUser}
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        placeholder="••••••••"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] font-medium leading-5 text-slate-400">
                      Минимум 8 символов: большая, маленькая буква и цифра.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Повтор нового пароля</label>
                    <div className="relative">
                      <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        required={!showEditUser || Boolean(newUser.password)}
                        value={newUser.confirmPassword}
                        onChange={e => setNewUser({...newUser, confirmPassword: e.target.value})}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Роль</label>
                    <div className="relative">
                      <Shield size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        value={newUser.role}
                        onChange={e => setNewUser({...newUser, role: e.target.value})}
                        className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-10 font-medium text-slate-900 outline-none transition-all focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                      >
                        <option value="ADMIN">Админ</option>
                        <option value="MANAGER">Менеджер</option>
                        <option value="SELLER">Продавец</option>
                        <option value="CUSTOMER">Клиент</option>
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                  {warehouses.length > 1 && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Склад</label>
                      <div className="relative">
                        <Warehouse size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={newUser.warehouseId}
                          onChange={e => setNewUser({...newUser, warehouseId: e.target.value})}
                          className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-10 font-medium text-slate-900 outline-none transition-all focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        >
                          <option value="">Все склады</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  )}
                  {String(newUser.role || '').toUpperCase() !== 'CUSTOMER' && String(newUser.role || '').toUpperCase() !== 'ADMIN' && (
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:col-span-2">
                      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <ShieldAlert size={14} className="text-slate-400" />
                        Дополнительные права
                      </label>
                      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5 shadow-xs">
                        <span className="text-sm font-medium text-slate-700">Может отменять накладные</span>
                        <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                          <input
                            type="checkbox"
                            checked={newUser.canCancelInvoices}
                            onChange={e => setNewUser({ ...newUser, canCancelInvoices: e.target.checked })}
                            className="peer sr-only"
                          />
                          <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-violet-500" />
                          <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5 shadow-xs">
                        <span className="text-sm font-medium text-slate-700">Может удалять данные</span>
                        <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                          <input
                            type="checkbox"
                            checked={newUser.canDeleteData}
                            onChange={e => setNewUser({ ...newUser, canDeleteData: e.target.checked })}
                            className="peer sr-only"
                          />
                          <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-violet-500" />
                          <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                        </span>
                      </label>
                    </div>
                  )}
                  {String(newUser.role || '').toUpperCase() === 'CUSTOMER' && (
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Клиент</label>
                      <div className="relative">
                        <User size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={newUser.customerId}
                          onChange={e => setNewUser({...newUser, customerId: e.target.value})}
                          required
                          className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-11 pr-10 font-medium text-slate-900 outline-none transition-all focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        >
                          <option value="">Выберите клиента</option>
                          {customerOptions.map(customer => (
                            <option key={customer.id} value={customer.id}>{customer.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end sm:gap-3 sm:pt-6">
                  <button type="button" onClick={closeUserModal} className="rounded-2xl px-6 py-3 font-semibold text-slate-500 transition-all hover:bg-slate-50">Отмена</button>
                  <button type="submit" disabled={isSubmittingForm} className="rounded-2xl bg-linear-to-br from-violet-500 to-violet-600 px-8 py-3 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmittingForm ? 'Сохранение...' : showEditUser ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <React.Suspense fallback={null}>
        <ConfirmationModal 
          key={selectedWarehouse?.id || 'delete-warehouse'}
          isOpen={Boolean(showDeleteWarehouseConfirm && selectedWarehouse)}
          onClose={closeDeleteWarehouseConfirm}
          onConfirm={() => {
            const warehouseToDelete = selectedWarehouse;
            closeDeleteWarehouseConfirm();
            return handleDeleteWarehouse(warehouseToDelete);
          }}
          title="Удалить склад?"
          message={`Вы уверены, что хотите удалить склад "${selectedWarehouse?.name}"? Это действие нельзя отменить.`}
          closeOnConfirmStart
        />

        <ConfirmationModal
          isOpen={showDeleteUserConfirm}
          onClose={() => {
            setShowDeleteUserConfirm(false);
            setSelectedUser(null);
          }}
          onConfirm={handleDeleteUser}
          title="Удалить пользователя?"
          message={`Вы уверены, что хотите удалить пользователя "${selectedUser?.username}"? Это действие нельзя отменить.`}
        />
      </React.Suspense>

      {activeTab === 'warehouses' && (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-linear-to-br from-sky-50 via-white to-slate-50 shadow-[0_16px_40px_-30px_rgba(14,165,233,0.24)]">
            <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-[1.4fr_0.9fr]">
              <div className="rounded-3xl border border-white/80 bg-white/80 p-5 backdrop-blur">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/20 ring-4 ring-sky-100">
                  <Warehouse size={26} />
                </div>
                <h3 className="mt-4 text-2xl font-medium tracking-tight text-slate-900">Склады и точки</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Управляйте филиалами, адресами и основным складом в одном аккуратном списке.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-inner transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Всего складов</p>
                  <p className="mt-2 text-xl font-medium text-slate-900">{warehouses.length}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-inner transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Основной склад</p>
                  <p className="mt-2 text-xl font-medium text-slate-900">{warehouses.find((warehouse) => warehouse.isDefault)?.name || 'Не выбран'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {paginatedWarehouses.map(w => (
            <div key={w.id} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-8">
              <div className="mb-6 flex items-start justify-between sm:mb-8">
                <div className="rounded-2xl bg-sky-100 p-4 text-sky-700 shadow-inner transition-all duration-500 group-hover:bg-sky-500 group-hover:text-white">
                  <Warehouse size={28} />
                </div>
                <div className="flex space-x-1 opacity-100 transition-all sm:opacity-0 sm:group-hover:opacity-100">
                  <button 
                    onClick={() => {
                      setSelectedWarehouse(w);
                      setWarehouseForm({ 
                        name: w.name || '', 
                        city: w.city || '', 
                        address: w.address || '',
                        phone: w.phone || ''
                      });
                      setShowEditWarehouse(true);
                    }}
                    className="p-3 bg-white text-slate-400 hover:text-slate-700 rounded-xl shadow-sm border border-slate-100 transition-all"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    type="button"
                    disabled={isDeletingWarehouse}
                    onClick={() => {
                      openDeleteWarehouseConfirm(w);
                    }}
                    className="p-3 bg-white text-slate-400 hover:text-rose-600 rounded-xl shadow-sm border border-slate-100 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <h3 className="wrap-break-word text-xl font-semibold text-slate-900">{w.name}</h3>
                {w.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                    <Star size={12} />
                    Основной
                  </span>
                )}
              </div>
              <div className="mt-6 space-y-4">
                <div className="flex items-start text-slate-500 font-medium">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center mr-3 text-slate-400">
                    <MapPin size={16} />
                  </div>
                  <span className="wrap-break-word">{[w.city, w.address].filter(Boolean).join(', ') || 'Адрес не указан'}</span>
                </div>
                <div className="flex items-start text-slate-500 font-medium">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center mr-3 text-slate-400">
                    <Phone size={16} />
                  </div>
                  <span className="wrap-break-word">{w.phone || 'Телефон не указан'}</span>
                </div>
                {isAdmin && !w.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefaultWarehouse(w.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-100"
                  >
                    <Star size={16} />
                    Сделать основным
                  </button>
                )}
              </div>
            </div>
          ))}
          <button 
            onClick={() => { resetWarehouseForm(); setShowAddWarehouse(true); }}
            className="flex flex-col items-center justify-center space-y-4 rounded-3xl border-2 border-dashed border-sky-200 p-8 text-sky-300 transition-all group hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
          >
            <div className="rounded-3xl bg-sky-50 p-5 transition-all duration-500 group-hover:bg-white group-hover:shadow-lg">
              <Plus size={32} />
            </div>
            <span className="font-semibold uppercase tracking-widest text-sm">Добавить склад</span>
          </button>
        </div>

          {warehouses.length > warehousesPageSize && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <PaginationControls
                currentPage={warehousePage}
                totalPages={warehousesTotalPages}
                totalItems={warehouses.length}
                pageSize={warehousesPageSize}
                onPageChange={setWarehousePage}
                className="border-t-0"
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-violet-100 bg-linear-to-br from-violet-50 via-white to-slate-50 shadow-[0_16px_40px_-30px_rgba(124,58,237,0.28)]">
            <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-[1.35fr_0.85fr]">
              <div className="rounded-3xl border border-white/80 bg-white/80 p-5 backdrop-blur">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/20 ring-4 ring-violet-100">
                  <Users size={26} />
                </div>
                <h2 className="mt-4 text-2xl font-medium tracking-tight text-slate-900">Пользователи системы</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Управляйте ролями, складами доступа и статусом двухфакторной защиты в одном месте.
                </p>
              </div>
              {isAdmin && (
                <div className="rounded-3xl border border-white/80 bg-white/80 p-4 backdrop-blur">
                  <button
                    onClick={() => setShowAddUser(true)}
                    className="inline-flex min-h-22 w-full items-center justify-center gap-2.5 rounded-[18px] bg-violet-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:bg-violet-600 active:scale-95"
                  >
                    <Plus size={18} />
                    <span>Добавить пользователя</span>
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 border-t border-violet-100/80 bg-white/70 p-5 sm:grid-cols-3 sm:p-6">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-inner transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Всего пользователей</p>
                <p className="mt-2 text-xl font-medium text-slate-900">{users.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-4 shadow-inner transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600">2FA включена</p>
                <p className="mt-2 text-xl font-medium text-emerald-700">{enabledTwoFactorCount}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-4 shadow-inner transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-600">Администраторы</p>
                <p className="mt-2 text-xl font-medium text-violet-700">{adminCount}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 md:hidden">
            {users.map(u => (
              <div key={u.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-500">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-slate-900">{u.username}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {u.warehouse?.name || 'Все склады'}
                        </span>
                        <span className={clsx(
                          "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                          String(u.role || '').toUpperCase() === 'ADMIN'
                            ? 'bg-violet-100 text-violet-700'
                            : String(u.role || '').toUpperCase() === 'MANAGER'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-600'
                        )}>
                          {u.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setNewUser({
                          username: u.username || '',
                          password: '',
                          confirmPassword: '',
                          role: u.role || 'SELLER',
                          warehouseId: u.warehouseId ? String(u.warehouseId) : '',
                          customerId: u.customerId ? String(u.customerId) : '',
                          canCancelInvoices: !!u.canCancelInvoices,
                          canDeleteData: !!u.canDeleteData
                        });
                        setShowEditUser(true);
                      }}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"
                    >
                      <Edit size={18} />
                    </button>
                  )}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Роль</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{u.role}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">2FA</p>
                    <p className={`mt-1 text-sm font-medium ${u.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {u.twoFactorEnabled ? 'Включена' : 'Выключена'}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setShowDeleteUserConfirm(true);
                      }}
                      className="rounded-2xl border border-rose-100 px-4 py-3 text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-semibold uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-10 py-6">Пользователь</th>
                  <th className="px-10 py-6">Роль</th>
                  <th className="px-10 py-6">2FA</th>
                  <th className="px-10 py-6 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="group transition-colors hover:bg-violet-50/20">
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-5">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-semibold text-lg group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                          {u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-lg">{u.username}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {u.warehouse?.name || 'Все склады'}
                            </span>
                            <span className={clsx(
                              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                              String(u.role || '').toUpperCase() === 'ADMIN'
                                ? 'bg-violet-100 text-violet-700'
                                : String(u.role || '').toUpperCase() === 'MANAGER'
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'bg-slate-100 text-slate-600'
                            )}>
                              {u.role}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-3">
                        <div className={clsx(
                          "p-2 rounded-xl",
                          u.role === 'ADMIN' ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
                        )}>
                          <Shield size={18} />
                        </div>
                        <span className="font-semibold text-slate-600 tracking-tight">{u.role}</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-3">
                        <div className={clsx(
                          'p-2 rounded-xl',
                          u.twoFactorEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                        )}>
                          <ShieldCheck size={18} />
                        </div>
                        <span className={clsx(
                          'font-semibold tracking-tight',
                          u.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-500'
                        )}>
                          {u.twoFactorEnabled ? 'Включена' : 'Выключена'}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end space-x-2 opacity-100 transition-all duration-300 sm:opacity-0 sm:group-hover:opacity-100">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setShowUserTwoFactorModal(true);
                            }}
                            className="text-slate-300 hover:text-violet-600 p-3 hover:bg-violet-50 rounded-xl transition-all"
                            title="Управлять 2FA"
                          >
                            <ShieldCheck size={20} />
                          </button>
                        ) : null}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setNewUser({
                                username: u.username || '',
                                password: '',
                                confirmPassword: '',
                                role: u.role || 'SELLER',
                                warehouseId: u.warehouseId ? String(u.warehouseId) : '',
                                customerId: u.customerId ? String(u.customerId) : '',
                                canCancelInvoices: !!u.canCancelInvoices,
                                canDeleteData: !!u.canDeleteData
                              });
                              setShowEditUser(true);
                            }}
                            className="text-slate-300 hover:text-slate-700 p-3 hover:bg-slate-100 rounded-xl transition-all"
                          >
                            <Edit size={20} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setShowDeleteUserConfirm(true);
                            }}
                            className="text-slate-300 hover:text-rose-600 p-3 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <UserTwoFactorModal
        isOpen={showUserTwoFactorModal}
        user={selectedUser}
        onClose={() => {
          closeUserTwoFactor();
        }}
        onUpdated={() => {
          fetchData();
        }}
      />

      {activeTab === 'profile' && (
        <div className="max-w-4xl space-y-8">
          <div className="overflow-hidden rounded-[28px] border border-emerald-100 bg-linear-to-br from-emerald-50 via-white to-slate-50 shadow-[0_16px_40px_-30px_rgba(16,185,129,0.28)]">
            <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-[1.4fr_0.9fr]">
              <div className="rounded-3xl border border-white/80 bg-white/80 p-5 backdrop-blur">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-100">
                  <User size={26} />
                </div>
                <h3 className="mt-4 text-2xl font-medium tracking-tight text-slate-900">Мой профиль</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Изменяйте данные входа и держите аккаунт защищённым без лишних переходов между экранами.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-inner transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Текущий логин</p>
                  <p className="mt-2 text-xl font-medium text-slate-900">{profileForm.username || '—'}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-inner transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Склад доступа</p>
                  <p className="mt-2 text-xl font-medium text-slate-900">{currentUserWarehouseLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.18)] sm:p-10">
            <h3 className="mb-8 flex items-center space-x-3 text-2xl font-medium text-slate-900">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <Shield size={28} />
              </div>
              <span>Данные входа</span>
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Логин</label>
                <input 
                  type="text" 
                  required 
                  value={profileForm.username}
                  onChange={e => setProfileForm({...profileForm, username: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-medium" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Новый пароль (оставьте пустым, если не хотите менять)</label>
                <input 
                  type="password" 
                  value={profileForm.password}
                  onChange={e => setProfileForm({...profileForm, password: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-medium" 
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Повтор нового пароля</label>
                <input 
                  type="password" 
                  required={Boolean(profileForm.password)}
                  value={profileForm.confirmPassword}
                  onChange={e => setProfileForm({...profileForm, confirmPassword: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-medium" 
                  placeholder="••••••••"
                />
              </div>
              <div className="pt-4">
                <button type="submit" disabled={isSubmittingForm} className="w-full rounded-2xl bg-emerald-500 py-5 font-semibold text-white shadow-xl shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmittingForm ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
          <TwoFactorSettingsCard currentUser={currentUser} />
        </div>
      )}
      {activeTab === 'general' && (
          <div className="max-w-5xl space-y-8">
            <div className="overflow-hidden rounded-[28px] border border-amber-100 bg-linear-to-br from-amber-50 via-white to-slate-50 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.28)]">
              <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-3xl border border-white/80 bg-white/80 p-5 backdrop-blur">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 ring-4 ring-amber-100">
                    <SettingsIcon size={26} />
                  </div>
                  <h3 className="mt-4 text-2xl font-medium tracking-tight text-slate-900">Общие настройки</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Здесь находятся реквизиты компании для печати, параметры каталога и важные системные напоминания.
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-inner transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Предпросмотр печати</p>
                  <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                    {companyPreviewLines.length > 0 ? (
                      companyPreviewLines.map((line) => (
                        <p key={line} className="wrap-break-word">{line}</p>
                      ))
                    ) : (
                      <p className="text-slate-400">Данные компании пока не заполнены</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-10 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.18)] sm:p-10">
              <div>
                <h3 className="flex items-center space-x-3 text-2xl font-medium text-slate-900">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <MapPin size={28} />
                  </div>
                  <span>Данные компании для печати</span>
                </h3>
                <p className="text-slate-500 mt-3 font-medium">Эти данные будут подставляться в печатную накладную. После изменения новые данные будут печататься автоматически.</p>
              </div>

              <form id="company-profile-form" onSubmit={handleSaveCompanyProfile} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Название компании</label>
                    <input
                      type="text"
                      required
                      value={companyProfile.name}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, name: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-medium"
                      placeholder='Например: ООО "Имдоди Шифо"'
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Страна</label>
                    <input
                      type="text"
                      value={companyProfile.country}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, country: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-medium"
                      placeholder="Республика Таджикистан"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Область / регион</label>
                    <input
                      type="text"
                      value={companyProfile.region}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, region: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-medium"
                      placeholder="Согдийская область"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Город</label>
                    <input
                      type="text"
                      value={companyProfile.city}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, city: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-medium"
                      placeholder="г. Истаравшан"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Телефон</label>
                    <input
                      type="text"
                      value={companyProfile.phone}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, phone: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-medium"
                      placeholder="+992..."
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Адрес</label>
                    <input
                      type="text"
                      value={companyProfile.addressLine}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, addressLine: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-medium"
                      placeholder="Дж. Гули Сурх, т/ц Хочи Хаит"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-widest">Примечание</label>
                    <textarea
                      rows={3}
                      value={companyProfile.note}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, note: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-medium resize-none"
                      placeholder="Дополнительная строка для печати, если нужна"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isSubmittingForm} className="rounded-2xl bg-emerald-500 px-6 py-4 font-semibold text-white shadow-xl shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmittingForm ? 'Сохранение...' : 'Сохранить данные компании'}
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-10 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.18)] sm:p-10">
              <div>
                <h3 className="flex items-center space-x-3 text-2xl font-medium text-slate-900">
                <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
                  <Eye size={28} />
                </div>
                <span>Видимость цен в каталоге</span>
              </h3>
              <p className="text-slate-500 mt-3 font-medium">Выберите, кто может видеть цены товаров в публичном каталоге.</p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {[
                { id: 'everyone', label: 'Всем', desc: 'Цены видны всем посетителям каталога' },
                { id: 'in_stock', label: 'Только при наличии', desc: 'Цены видны только для товаров, которые есть на складе' },
                { id: 'nobody', label: 'Никому', desc: 'Цены скрыты для всех посетителей' }
              ].map(option => (
                <button 
                  key={option.id}
                  onClick={() => handleUpdateSetting('priceVisibility', option.id)}
                  className={`flex items-center justify-between p-8 rounded-4xl border-2 transition-all text-left group ${settings.priceVisibility === option.id ? 'border-amber-400 bg-amber-50/80' : 'border-slate-50 hover:border-amber-100 hover:bg-amber-50/40'}`}
                >
                  <div>
                    <p className="font-semibold text-slate-900 text-lg">{option.label}</p>
                    <p className="text-sm text-slate-500 font-medium mt-1">{option.desc}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${settings.priceVisibility === option.id ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/20' : 'border-slate-200'}`}>
                    {settings.priceVisibility === option.id && <CheckCircle2 size={18} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.18)] sm:p-10">
            <h3 className="mb-8 flex items-center space-x-3 text-2xl font-medium text-slate-900">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Lock size={28} />
              </div>
              <span>Безопасность</span>
            </h3>
            <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 flex items-start space-x-4">
              <Shield className="text-rose-600 shrink-0 mt-1" size={24} />
              <p className="text-sm text-rose-700 font-medium leading-relaxed">
                Некоторые настройки прав доступа могут повлиять на целостность данных. Рекомендуется выдавать права на удаление только доверенным администраторам.
              </p>
            </div>
          </div>
        </div>
      )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
