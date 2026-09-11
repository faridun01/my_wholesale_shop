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
  X,
  KeyRound,
  FileText,
  AlertCircle
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

  const enabledTwoFactorCount = users.filter((u) => u.twoFactorEnabled).length;
  const adminCount = users.filter((u) => String(u.role || '').toUpperCase() === 'ADMIN').length;
  const currentUserWarehouseLabel = currentUser?.warehouse?.name || 'Все склады';
  const defaultWarehouse = warehouses.find((w) => w.isDefault);

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

  const tabs = [
    { id: 'warehouses' as const, label: 'Склады и точки', icon: Warehouse, count: warehouses.length, visible: true },
    { id: 'users' as const, label: 'Пользователи и роли', icon: Users, count: users.length, visible: canViewUsers },
    { id: 'general' as const, label: 'Профиль компании', icon: Building2, visible: canManageSettings },
    { id: 'profile' as const, label: 'Мой профиль', icon: User, visible: true },
  ].filter((t) => t.visible);

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-4 pb-12">
        {/* Header with inline action button on the right */}
        <div className="flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-900 text-white shadow-xs">
              <SettingsIcon size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 truncate">Настройки системы</h1>
              <p className="hidden sm:block text-xs text-slate-500 truncate">Склады, доступ, безопасность и реквизиты компании</p>
            </div>
          </div>

          {/* Quick Context Action Button (right of Настройки системы) */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'warehouses' && isAdmin && (
              <button
                type="button"
                onClick={() => { resetWarehouseForm(); setShowAddWarehouse(true); }}
                className="inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl bg-slate-900 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 active:scale-95 transition-all shrink-0"
              >
                <Plus size={14} />
                <span>Новый склад</span>
              </button>
            )}
            {activeTab === 'users' && isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddUser(true)}
                className="inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl bg-slate-900 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 active:scale-95 transition-all shrink-0"
              >
                <Plus size={14} />
                <span className="hidden xs:inline">Новый </span>
                <span>пользователь</span>
              </button>
            )}
            {activeTab === 'general' && canManageSettings && (
              <button
                type="button"
                onClick={() => (document.getElementById('company-profile-form') as HTMLFormElement | null)?.requestSubmit()}
                disabled={isSubmittingForm}
                className="inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl bg-slate-900 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                <CheckCircle2 size={14} />
                <span>{isSubmittingForm ? 'Сохранение...' : 'Сохранить реквизиты'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Compact Segmented Tabs Strip */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1 shadow-2xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shrink-0',
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={clsx(
                      'ml-0.5 rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold',
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: WAREHOUSES */}
        {activeTab === 'warehouses' && (
          <div className="space-y-3.5">
            {/* Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2 shadow-2xs text-xs">
              <div className="flex items-center gap-4">
                <span className="text-slate-500">
                  Всего складов: <strong className="text-slate-900 font-bold">{warehouses.length}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  Основной склад: <strong className="text-emerald-700 font-bold">{defaultWarehouse?.name || 'Не назначен'}</strong>
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => { resetWarehouseForm(); setShowAddWarehouse(true); }}
                  className="sm:hidden inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline"
                >
                  <Plus size={13} />
                  <span>Добавить</span>
                </button>
              )}
            </div>

            {/* Warehouses Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedWarehouses.map((w) => (
                <div
                  key={w.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                          <Warehouse size={16} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{w.name}</h3>
                          {w.isDefault && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200/70">
                              <Star size={10} className="fill-amber-500 text-amber-500" />
                              Основной
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWarehouse(w);
                            setWarehouseForm({
                              name: w.name || '',
                              city: w.city || '',
                              address: w.address || '',
                              phone: w.phone || '',
                            });
                            setShowEditWarehouse(true);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          title="Редактировать"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingWarehouse}
                          onClick={() => openDeleteWarehouseConfirm(w)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-40"
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{[w.city, w.address].filter(Boolean).join(', ') || 'Адрес не указан'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{w.phone || 'Телефон не указан'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  {isAdmin && !w.isDefault && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSetDefaultWarehouse(w.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                      >
                        <Star size={12} />
                        <span>Сделать основным</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Add warehouse card placeholder */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => { resetWarehouseForm(); setShowAddWarehouse(true); }}
                  className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 p-4 text-slate-400 hover:border-sky-300 hover:bg-sky-50/40 hover:text-sky-700 transition-all group"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-700 transition-colors">
                    <Plus size={16} />
                  </div>
                  <span className="text-xs font-semibold">Добавить новый склад</span>
                </button>
              )}
            </div>

            {/* Centered Pagination */}
            {warehouses.length > warehousesPageSize && (
              <div className="pt-2">
                <PaginationControls
                  currentPage={warehousePage}
                  totalPages={warehousesTotalPages}
                  totalItems={warehouses.length}
                  pageSize={warehousesPageSize}
                  onPageChange={setWarehousePage}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USERS & ROLES */}
        {activeTab === 'users' && (
          <div className="space-y-3.5">
            {/* Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2 shadow-2xs text-xs">
              <div className="flex items-center gap-4">
                <span className="text-slate-500">
                  Всего: <strong className="text-slate-900 font-bold">{users.length}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  Администраторы: <strong className="text-violet-700 font-bold">{adminCount}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  2FA защита: <strong className="text-emerald-700 font-bold">{enabledTwoFactorCount}</strong>
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAddUser(true)}
                  className="sm:hidden inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline"
                >
                  <Plus size={13} />
                  <span>Добавить</span>
                </button>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3.5 py-2.5">Пользователь</th>
                    <th className="px-3.5 py-2.5">Роль</th>
                    <th className="px-3.5 py-2.5">Склад доступа</th>
                    <th className="px-3.5 py-2.5">2FA</th>
                    <th className="px-3.5 py-2.5">Разрешения</th>
                    <th className="px-3.5 py-2.5 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((u) => {
                    const uRole = String(u.role || '').toUpperCase();
                    return (
                      <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 font-bold text-xs text-slate-700">
                              {u.username[0]?.toUpperCase()}
                            </div>
                            <span>{u.username}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                              uRole === 'ADMIN'
                                ? 'bg-violet-100 text-violet-700'
                                : uRole === 'MANAGER'
                                ? 'bg-sky-100 text-sky-700'
                                : uRole === 'CUSTOMER'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {u.warehouse?.name || 'Все склады'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold',
                              u.twoFactorEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            <ShieldCheck size={12} className={u.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-400'} />
                            <span>{u.twoFactorEnabled ? 'Включена' : 'Выкл'}</span>
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {u.canCancelInvoices && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200/60">
                                Отмена накл.
                              </span>
                            )}
                            {u.canDeleteData && (
                              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200/60">
                                Удаление
                              </span>
                            )}
                            {!u.canCancelInvoices && !u.canDeleteData && (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setShowUserTwoFactorModal(true);
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                                title="2FA защита"
                              >
                                <ShieldCheck size={14} />
                              </button>
                            )}
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
                                    canDeleteData: !!u.canDeleteData,
                                  });
                                  setShowEditUser(true);
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                title="Редактировать"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setShowDeleteUserConfirm(true);
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                title="Удалить"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-2.5 md:hidden">
              {users.map((u) => {
                const uRole = String(u.role || '').toUpperCase();
                return (
                  <div key={u.id} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                          {u.username[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{u.username}</p>
                          <span
                            className={clsx(
                              'inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider',
                              uRole === 'ADMIN'
                                ? 'bg-violet-100 text-violet-700'
                                : uRole === 'MANAGER'
                                ? 'bg-sky-100 text-sky-700'
                                : uRole === 'CUSTOMER'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {u.role}
                          </span>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setShowUserTwoFactorModal(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                          >
                            <ShieldCheck size={14} />
                          </button>
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
                                canDeleteData: !!u.canDeleteData,
                              });
                              setShowEditUser(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setShowDeleteUserConfirm(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {u.warehouse?.name || 'Все склады'}
                      </span>
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold',
                          u.twoFactorEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        <ShieldCheck size={12} />
                        <span>{u.twoFactorEnabled ? '2FA вкл' : '2FA выкл'}</span>
                      </span>
                      {u.canCancelInvoices && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          Отмена
                        </span>
                      )}
                      {u.canDeleteData && (
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          Удаление
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: COMPANY PROFILE (GENERAL) */}
        {activeTab === 'general' && canManageSettings && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.9fr]">
            {/* Form Column */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <MapPin size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Реквизиты компании для печати</h3>
                  <p className="text-xs text-slate-500">Автоматически подставляются в печатные чеки и накладные</p>
                </div>
              </div>

              <form id="company-profile-form" onSubmit={handleSaveCompanyProfile} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Название компании</label>
                  <input
                    type="text"
                    required
                    value={companyProfile.name}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                    placeholder='Напр: ООО "Оптовая База"'
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Страна</label>
                    <input
                      type="text"
                      value={companyProfile.country}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, country: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                      placeholder="Таджикистан"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Область / регион</label>
                    <input
                      type="text"
                      value={companyProfile.region}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, region: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                      placeholder="Согдийская область"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Город</label>
                    <input
                      type="text"
                      value={companyProfile.city}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, city: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                      placeholder="Душанбе"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Телефон</label>
                    <input
                      type="text"
                      value={companyProfile.phone}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                      placeholder="+992..."
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Адрес</label>
                  <input
                    type="text"
                    value={companyProfile.addressLine}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, addressLine: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                    placeholder="ул. Ленина, склад №4"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Примечание в чеке</label>
                  <textarea
                    rows={2}
                    value={companyProfile.note}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, note: e.target.value })}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                    placeholder="Спасибо за покупку! Товар возврату не подлежит."
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmittingForm ? 'Сохранение...' : 'Сохранить данные компании'}
                  </button>
                </div>
              </form>
            </div>

            {/* Sidebar Column: Preview & System Options */}
            <div className="space-y-4">
              {/* Receipt Preview Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <FileText size={15} className="text-slate-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Вид в шапке накладной</h4>
                </div>
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3.5 text-center font-mono text-[11px] leading-relaxed text-slate-700">
                  <p className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                    {companyProfile.name || 'Название компании'}
                  </p>
                  <p className="text-slate-500">
                    {[companyProfile.city, companyProfile.addressLine].filter(Boolean).join(', ') || 'Город, Адрес'}
                  </p>
                  <p className="text-slate-500">Тел: {companyProfile.phone || '+992 ...'}</p>
                  {companyProfile.note && (
                    <p className="mt-1.5 pt-1.5 border-t border-slate-200 text-[10px] text-slate-400 italic">
                      "{companyProfile.note}"
                    </p>
                  )}
                </div>
              </div>

              {/* Price Visibility Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                  <Eye size={15} className="text-slate-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Цены в каталоге</h4>
                </div>
                <div className="space-y-1.5">
                  {[
                    { id: 'everyone', label: 'Всем', desc: 'Цены видны всем посетителям' },
                    { id: 'in_stock', label: 'Только в наличии', desc: 'Скрывать, если остаток 0' },
                    { id: 'nobody', label: 'Никому', desc: 'Цены скрыты для гостей' },
                  ].map((option) => {
                    const isSelected = (settings.priceVisibility || 'everyone') === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleUpdateSetting('priceVisibility', option.id)}
                        className={clsx(
                          'flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all',
                          isSelected
                            ? 'border-amber-400 bg-amber-50/60 shadow-2xs'
                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                        )}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">{option.label}</p>
                          <p className="text-[10px] text-slate-500">{option.desc}</p>
                        </div>
                        <div
                          className={clsx(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                            isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'
                          )}
                        >
                          {isSelected && <CheckCircle2 size={12} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Security Hint */}
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-100 bg-amber-50/60 p-3 text-xs text-amber-800">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-snug">
                  Реквизиты и видимость цен обновляются сразу для всех сотрудников и клиентов в каталоге.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MY PROFILE */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Account Info & Password Form */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <User size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Учётные данные</h3>
                  <p className="text-xs text-slate-500">Изменение логина и пароля текущей сессии</p>
                </div>
              </div>

              {/* User Overview Badges */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center text-xs">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Логин</p>
                  <p className="mt-0.5 font-bold text-slate-900 truncate">{currentUser.username || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Роль</p>
                  <p className="mt-0.5 font-bold text-slate-900 truncate">{role}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Склад</p>
                  <p className="mt-0.5 font-bold text-slate-900 truncate">{currentUserWarehouseLabel}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Логин</label>
                  <input
                    type="text"
                    required
                    value={profileForm.username}
                    onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Новый пароль <span className="text-slate-400 font-normal">(если меняете)</span>
                  </label>
                  <input
                    type="password"
                    value={profileForm.password}
                    onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Повтор нового пароля</label>
                  <input
                    type="password"
                    required={Boolean(profileForm.password)}
                    value={profileForm.confirmPassword}
                    onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-slate-300 focus:bg-white"
                    placeholder="••••••••"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmittingForm ? 'Сохранение...' : 'Обновить профиль'}
                  </button>
                </div>
              </form>
            </div>

            {/* 2FA Card */}
            <div>
              <TwoFactorSettingsCard currentUser={currentUser} />
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT WAREHOUSE */}
      <AnimatePresence>
        {(showAddWarehouse || showEditWarehouse) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeWarehouseModal}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-2 backdrop-blur-xs sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <Warehouse size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {showEditWarehouse ? 'Редактировать склад' : 'Новый склад'}
                    </h3>
                    <p className="text-[11px] text-slate-400">Данные точки хранения</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeWarehouseModal}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={showEditWarehouse ? handleEditWarehouse : handleAddWarehouse} className="space-y-3 p-4 sm:p-5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Название склада</label>
                  <input
                    type="text"
                    required
                    value={warehouseForm.name}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-sky-300 focus:bg-white"
                    placeholder="Напр: Основной склад"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Город</label>
                    <input
                      type="text"
                      required
                      value={warehouseForm.city}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, city: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-sky-300 focus:bg-white"
                      placeholder="Душанбе"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Телефон</label>
                    <input
                      type="text"
                      value={warehouseForm.phone}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-sky-300 focus:bg-white"
                      placeholder="+992..."
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Адрес</label>
                  <input
                    type="text"
                    value={warehouseForm.address}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-sky-300 focus:bg-white"
                    placeholder="ул. Складская, 12"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeWarehouseModal}
                    className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmittingForm ? 'Сохранение...' : showEditWarehouse ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD / EDIT USER */}
      <AnimatePresence>
        {(showAddUser || showEditUser) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeUserModal}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-2 backdrop-blur-xs sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {showEditUser ? 'Редактировать пользователя' : 'Новый пользователь'}
                    </h3>
                    <p className="text-[11px] text-slate-400">Роль, склад и права доступа</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeUserModal}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={showEditUser ? handleEditUser : handleAddUser} className="space-y-3 p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Логин</label>
                    <input
                      type="text"
                      required
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-violet-300 focus:bg-white"
                      placeholder="username"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Роль</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-violet-300 focus:bg-white"
                    >
                      <option value="ADMIN">Администратор</option>
                      <option value="MANAGER">Менеджер</option>
                      <option value="SELLER">Продавец</option>
                      <option value="CUSTOMER">Клиент</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      {showEditUser ? 'Новый пароль (необяз.)' : 'Пароль'}
                    </label>
                    <input
                      type="password"
                      required={!showEditUser}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-violet-300 focus:bg-white"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Повтор пароля</label>
                    <input
                      type="password"
                      required={!showEditUser || Boolean(newUser.password)}
                      value={newUser.confirmPassword}
                      onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-violet-300 focus:bg-white"
                      placeholder="••••••••"
                    />
                  </div>

                  {warehouses.length > 1 && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Склад доступа</label>
                      <select
                        value={newUser.warehouseId}
                        onChange={(e) => setNewUser({ ...newUser, warehouseId: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-violet-300 focus:bg-white"
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

                  {String(newUser.role || '').toUpperCase() === 'CUSTOMER' && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Привязать к клиенту</label>
                      <select
                        value={newUser.customerId}
                        onChange={(e) => setNewUser({ ...newUser, customerId: e.target.value })}
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-violet-300 focus:bg-white"
                      >
                        <option value="">Выберите клиента</option>
                        {customerOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {String(newUser.role || '').toUpperCase() !== 'CUSTOMER' &&
                    String(newUser.role || '').toUpperCase() !== 'ADMIN' && (
                      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Дополнительные права</p>
                        <label className="flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer">
                          <span>Может отменять накладные</span>
                          <input
                            type="checkbox"
                            checked={newUser.canCancelInvoices}
                            onChange={(e) => setNewUser({ ...newUser, canCancelInvoices: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                        </label>
                        <label className="flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer">
                          <span>Может удалять данные</span>
                          <input
                            type="checkbox"
                            checked={newUser.canDeleteData}
                            onChange={(e) => setNewUser({ ...newUser, canDeleteData: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                        </label>
                      </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeUserModal}
                    className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmittingForm ? 'Сохранение...' : showEditUser ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION & 2FA MODALS */}
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

      <UserTwoFactorModal
        isOpen={showUserTwoFactorModal}
        user={selectedUser}
        onClose={closeUserTwoFactor}
        onUpdated={() => {
          closeUserTwoFactor();
          fetchData();
        }}
      />
    </div>
  );
}
