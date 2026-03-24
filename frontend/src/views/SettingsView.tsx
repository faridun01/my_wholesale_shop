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
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { getCurrentUser } from '../utils/userAccess';
import { updateStoredUser } from '../utils/authStorage';
import TwoFactorSettingsCard from '../components/settings/TwoFactorSettingsCard';

export default function SettingsView() {
  const ConfirmationModal = React.lazy(() => import('../components/common/ConfirmationModal'));
  const [warehouses, setWarehouses] = useState<any[]>([]);
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
  
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [showEditWarehouse, setShowEditWarehouse] = useState(false);
  const [showDeleteWarehouseConfirm, setShowDeleteWarehouseConfirm] = useState(false);
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
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    confirmPassword: '',
    role: 'SELLER', 
    warehouseId: '',
    canCancelInvoices: false,
    canDeleteData: false
  });

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

  useEffect(() => {
    fetchData();
    setProfileForm({
      username: currentUser.username || '',
      password: '',
      confirmPassword: ''
    });
  }, []);

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
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWarehouse(warehouseForm);
      toast.success('Склад успешно создан');
      setShowAddWarehouse(false);
      resetWarehouseForm();
      fetchData();
    } catch (err) {
      toast.error('Ошибка при создании склада');
    }
  };

  const handleEditWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    try {
      await updateWarehouse(selectedWarehouse.id, warehouseForm);
      toast.success('Склад обновлен');
      setShowEditWarehouse(false);
      resetWarehouseForm();
      fetchData();
    } catch (err) {
      toast.error('Ошибка при обновлении склада');
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!selectedWarehouse) return;
    try {
      await deleteWarehouse(selectedWarehouse.id);
      toast.success('Склад удален');
      fetchData();
    } catch (err) {
      toast.error('Ошибка при удалении склада');
    }
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
    try {
      const { confirmPassword, ...payload } = newUser;
      await client.post('/auth/register', {
        ...payload,
        warehouseId: payload.warehouseId ? Number(payload.warehouseId) : undefined
      });
      toast.success('Пользователь создан');
      setShowAddUser(false);
      setNewUser({ 
        username: '', 
        password: '', 
        confirmPassword: '',
        role: 'SELLER', 
        warehouseId: '',
        canCancelInvoices: false,
        canDeleteData: false
      });
      fetchData();
    } catch (err) {
      toast.error('Ошибка при создании пользователя');
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
    try {
      const { confirmPassword, ...payload } = newUser;
      await client.put(`/auth/users/${selectedUser.id}`, {
        ...payload,
        warehouseId: payload.warehouseId ? Number(payload.warehouseId) : null
      });
      toast.success('Пользователь обновлен');
      setShowEditUser(false);
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      toast.error('Ошибка при обновлении пользователя');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
        toast.error('Пароли не совпадают');
        return;
      }

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
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    if (!canManageSettings) {
      toast.error('Недостаточно прав');
      return;
    }
    try {
      await client.post('/settings', { key, value });
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

    try {
      await client.post('/settings/company-profile', companyProfile);
      toast.success('Данные компании сохранены');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при сохранении данных компании');
    }
  };

  return (
    <div className="app-page-shell app-page-pad">
      <div className="mx-auto max-w-6xl space-y-6 pb-20">
      <section className="app-surface p-5 sm:px-6 sm:py-6">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Система</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Настройки</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">Управление складами, пользователями, профилем и общими параметрами системы.</p>
        </div>
      </section>
      <div className="hidden">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Настройки</h1>
        <p className="text-slate-500 mt-1 font-medium">Настройте параметры системы и управляйте доступом.</p>
      </div>

      <section className="space-y-4">
      <div className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-white bg-white p-1 shadow-sm sm:flex sm:w-fit sm:flex-wrap">
        <button 
          onClick={() => setActiveTab('warehouses')}
          className={`flex items-center justify-center space-x-2 rounded-xl px-4 py-3 text-sm font-medium transition-all sm:justify-start sm:px-5 sm:py-2.5 ${activeTab === 'warehouses' ? tabTheme.warehouses : 'text-slate-500 hover:bg-sky-50 hover:text-sky-700'}`}
        >
          <Warehouse size={18} />
          <span>Склады</span>
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center justify-center space-x-2 rounded-xl px-4 py-3 text-sm font-medium transition-all sm:justify-start sm:px-5 sm:py-2.5 ${activeTab === 'users' ? tabTheme.users : 'text-slate-500 hover:bg-violet-50 hover:text-violet-700'}`}
        >
          <Users size={18} />
          <span>Пользователи</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex items-center justify-center space-x-2 rounded-xl px-4 py-3 text-sm font-medium transition-all sm:justify-start sm:px-5 sm:py-2.5 ${activeTab === 'profile' ? tabTheme.profile : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}
        >
          <User size={18} />
          <span>Профиль</span>
        </button>
        {canManageSettings && (
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center justify-center space-x-2 rounded-xl px-4 py-3 text-sm font-medium transition-all sm:justify-start sm:px-5 sm:py-2.5 ${activeTab === 'general' ? tabTheme.general : 'text-slate-500 hover:bg-amber-50 hover:text-amber-700'}`}
          >
            <SettingsIcon size={18} />
            <span>Общие</span>
          </button>
        )}
      </div>
      </section>

      <AnimatePresence>
        {(showAddWarehouse || showEditWarehouse) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowAddWarehouse(false);
              setShowEditWarehouse(false);
            }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white shadow-2xl sm:rounded-[2.5rem]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5 sm:p-8">
                <h3 className="flex items-center space-x-3 text-xl font-black text-slate-900 sm:text-2xl">
                  <div className="rounded-2xl bg-sky-500 p-2.5 text-white shadow-lg shadow-sky-500/20 sm:p-3">
                    <Warehouse size={24} />
                  </div>
                  <span>{showEditWarehouse ? 'Редактировать склад' : 'Новый склад'}</span>
                </h3>
                <button onClick={() => { setShowAddWarehouse(false); setShowEditWarehouse(false); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={showEditWarehouse ? handleEditWarehouse : handleAddWarehouse} className="space-y-5 p-5 sm:p-8">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Название</label>
                    <input 
                      type="text" 
                      required 
                      value={warehouseForm.name}
                      onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold" 
                      placeholder="Напр: Основной склад"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Город</label>
                    <input 
                      type="text" 
                      required 
                      value={warehouseForm.city}
                      onChange={e => setWarehouseForm({...warehouseForm, city: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold" 
                      placeholder="Напр: Душанбе"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Адрес</label>
                    <input 
                      type="text" 
                      required 
                      value={warehouseForm.address}
                      onChange={e => setWarehouseForm({...warehouseForm, address: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold" 
                      placeholder="Напр: ул. Рудаки 10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Телефон</label>
                    <input
                      type="text"
                      value={warehouseForm.phone}
                      onChange={e => setWarehouseForm({...warehouseForm, phone: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold"
                      placeholder="Напр: +992 900 00 00 00"
                    />
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end sm:space-x-3 sm:gap-0 sm:pt-4">
                  <button type="button" onClick={() => { setShowAddWarehouse(false); setShowEditWarehouse(false); }} className="rounded-2xl px-8 py-4 font-bold text-slate-500 transition-all hover:bg-slate-50">Отмена</button>
                  <button type="submit" className="rounded-2xl bg-sky-500 px-10 py-4 font-bold text-white shadow-xl shadow-sky-500/20 transition-all hover:bg-sky-600 active:scale-95">
                    {showEditWarehouse ? 'Сохранить' : 'Создать'}
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
            onClick={() => {
              setShowAddUser(false);
              setShowEditUser(false);
              setSelectedUser(null);
            }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl sm:rounded-[2.5rem]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <h3 className="flex items-center space-x-3 text-lg font-black text-slate-900 sm:text-xl">
                  <div className="rounded-2xl bg-violet-500 p-2.5 text-white shadow-lg shadow-violet-500/20">
                    <Users size={20} />
                  </div>
                  <span>{showEditUser ? 'Редактировать пользователя' : 'Новый пользователь'}</span>
                </h3>
                <button onClick={() => { setShowAddUser(false); setShowEditUser(false); setSelectedUser(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={showEditUser ? handleEditUser : handleAddUser} className="space-y-4 p-5 sm:space-y-5 sm:p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Логин</label>
                    <input 
                      type="text" 
                      required 
                      value={newUser.username}
                      onChange={e => setNewUser({...newUser, username: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold" 
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">
                      {showEditUser ? 'Новый пароль (оставьте пустым)' : 'Пароль'}
                    </label>
                    <input 
                      type="password" 
                      required={!showEditUser}
                      value={newUser.password}
                      onChange={e => setNewUser({...newUser, password: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold" 
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Повтор нового пароля</label>
                    <input 
                      type="password" 
                      required={!showEditUser || Boolean(newUser.password)}
                      value={newUser.confirmPassword}
                      onChange={e => setNewUser({...newUser, confirmPassword: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold" 
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Роль</label>
                    <select 
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold appearance-none bg-white"
                    >
                      <option value="ADMIN">Админ</option>
                      <option value="MANAGER">Менеджер</option>
                      <option value="SELLER">Продавец</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Склад</label>
                    <select 
                      value={newUser.warehouseId}
                      onChange={e => setNewUser({...newUser, warehouseId: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold appearance-none bg-white"
                    >
                      <option value="">Все склады</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end sm:space-x-3 sm:gap-0 sm:pt-6">
                  <button type="button" onClick={() => { setShowAddUser(false); setShowEditUser(false); setSelectedUser(null); }} className="rounded-2xl px-6 py-3 font-bold text-slate-500 transition-all hover:bg-slate-50">Отмена</button>
                  <button type="submit" className="rounded-2xl bg-violet-500 px-8 py-3 font-bold text-white shadow-xl shadow-violet-500/20 transition-all hover:bg-violet-600 active:scale-95">
                    {showEditUser ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <React.Suspense fallback={null}>
        <ConfirmationModal 
          isOpen={showDeleteWarehouseConfirm}
          onClose={() => setShowDeleteWarehouseConfirm(false)}
          onConfirm={handleDeleteWarehouse}
          title="Удалить склад?"
          message={`Вы уверены, что хотите удалить склад "${selectedWarehouse?.name}"? Это действие нельзя отменить.`}
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {warehouses.map(w => (
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
                    onClick={() => {
                      setSelectedWarehouse(w);
                      setShowDeleteWarehouseConfirm(true);
                    }}
                    className="p-3 bg-white text-slate-400 hover:text-rose-600 rounded-xl shadow-sm border border-slate-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <h3 className="break-words text-xl font-black text-slate-900">{w.name}</h3>
                {w.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                    <Star size={12} />
                    Основной
                  </span>
                )}
              </div>
              <div className="mt-6 space-y-4">
                <div className="flex items-start text-slate-500 font-bold">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center mr-3 text-slate-400">
                    <MapPin size={16} />
                  </div>
                  <span className="break-words">{[w.city, w.address].filter(Boolean).join(', ') || 'Адрес не указан'}</span>
                </div>
                <div className="flex items-start text-slate-500 font-bold">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center mr-3 text-slate-400">
                    <Phone size={16} />
                  </div>
                  <span className="break-words">{w.phone || 'Телефон не указан'}</span>
                </div>
                {isAdmin && !w.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefaultWarehouse(w.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 transition-all hover:bg-amber-100"
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
            <span className="font-black uppercase tracking-widest text-sm">Добавить склад</span>
          </button>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => setShowAddUser(true)}
              className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-violet-500 px-6 py-4 font-black text-white shadow-xl shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:bg-violet-600 active:scale-95 sm:w-auto sm:px-8"
            >
              <Plus size={20} />
              <span>Добавить пользователя</span>
            </button>
          </div>

          <div className="space-y-4 md:hidden">
            {users.map(u => (
              <div key={u.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-500">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xl font-black text-slate-900">{u.username}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{u.warehouse?.name || 'Все склады'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUser(u);
                      setNewUser({
                        username: u.username || '',
                        password: '',
                        confirmPassword: '',
                        role: u.role || 'SELLER',
                        warehouseId: u.warehouseId ? String(u.warehouseId) : '',
                        canCancelInvoices: !!u.canCancelInvoices,
                        canDeleteData: !!u.canDeleteData
                      });
                      setShowEditUser(true);
                    }}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"
                  >
                    <Edit size={18} />
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Роль</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{u.role}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">2FA</p>
                    <p className={`mt-1 text-sm font-bold ${u.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {u.twoFactorEnabled ? 'Включена' : 'Выключена'}
                    </p>
                  </div>
                </div>
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
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-10 py-6">Пользователь</th>
                  <th className="px-10 py-6">Роль</th>
                  <th className="px-10 py-6">2FA</th>
                  <th className="px-10 py-6 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-5">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-lg group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                          {u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-lg">{u.username}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{u.warehouse?.name || 'Все склады'}</p>
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
                        <span className="font-black text-slate-600 tracking-tight">{u.role}</span>
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
                          'font-black tracking-tight',
                          u.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-500'
                        )}>
                          {u.twoFactorEnabled ? 'Включена' : 'Выключена'}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            setSelectedUser(u);
                            setNewUser({
                              username: u.username || '',
                              password: '',
                              confirmPassword: '',
                              role: u.role || 'SELLER',
                              warehouseId: u.warehouseId ? String(u.warehouseId) : '',
                              canCancelInvoices: !!u.canCancelInvoices,
                              canDeleteData: !!u.canDeleteData
                            });
                            setShowEditUser(true);
                          }}
                          className="text-slate-300 hover:text-slate-700 p-3 hover:bg-slate-100 rounded-xl transition-all"
                        >
                          <Edit size={20} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedUser(u);
                            setShowDeleteUserConfirm(true);
                          }}
                          className="text-slate-300 hover:text-rose-600 p-3 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="max-w-2xl space-y-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3 mb-8">
              <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
                <User size={28} />
              </div>
              <span>Мой профиль</span>
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Логин</label>
                <input 
                  type="text" 
                  required 
                  value={profileForm.username}
                  onChange={e => setProfileForm({...profileForm, username: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold" 
                />
              </div>
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Новый пароль (оставьте пустым, если не хотите менять)</label>
                <input 
                  type="password" 
                  value={profileForm.password}
                  onChange={e => setProfileForm({...profileForm, password: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold" 
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Повтор нового пароля</label>
                <input 
                  type="password" 
                  required={Boolean(profileForm.password)}
                  value={profileForm.confirmPassword}
                  onChange={e => setProfileForm({...profileForm, confirmPassword: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold" 
                  placeholder="••••••••"
                />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full rounded-2xl bg-emerald-500 py-5 font-black text-white shadow-xl shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95">
                  Сохранить изменения
                </button>
              </div>
            </form>
          </div>
          <TwoFactorSettingsCard currentUser={currentUser} />
        </div>
      )}
        {activeTab === 'general' && (
          <div className="max-w-2xl space-y-8">
            <div className="space-y-10 rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <MapPin size={28} />
                  </div>
                  <span>Данные компании для печати</span>
                </h3>
                <p className="text-slate-500 mt-3 font-medium">Эти данные будут подставляться в печатную накладную. После изменения новые данные будут печататься автоматически.</p>
              </div>

              <form onSubmit={handleSaveCompanyProfile} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Название компании</label>
                    <input
                      type="text"
                      required
                      value={companyProfile.name}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, name: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-bold"
                      placeholder='Например: ООО "Имдоди Шифо"'
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Страна</label>
                    <input
                      type="text"
                      value={companyProfile.country}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, country: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-bold"
                      placeholder="Республика Таджикистан"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Область / регион</label>
                    <input
                      type="text"
                      value={companyProfile.region}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, region: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-bold"
                      placeholder="Согдийская область"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Город</label>
                    <input
                      type="text"
                      value={companyProfile.city}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, city: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-bold"
                      placeholder="г. Истаравшан"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Телефон</label>
                    <input
                      type="text"
                      value={companyProfile.phone}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, phone: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-bold"
                      placeholder="+992..."
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Адрес</label>
                    <input
                      type="text"
                      value={companyProfile.addressLine}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, addressLine: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-bold"
                      placeholder="Дж. Гули Сурх, т/ц Хочи Хаит"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Примечание</label>
                    <textarea
                      rows={3}
                      value={companyProfile.note}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, note: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-300 transition-all font-bold resize-none"
                      placeholder="Дополнительная строка для печати, если нужна"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" className="rounded-2xl bg-emerald-500 px-6 py-4 font-black text-white shadow-xl shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95">
                    Сохранить данные компании
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-10 rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3">
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
                  className={`flex items-center justify-between p-8 rounded-[2rem] border-2 transition-all text-left group ${settings.priceVisibility === option.id ? 'border-amber-400 bg-amber-50/80' : 'border-slate-50 hover:border-amber-100 hover:bg-amber-50/40'}`}
                >
                  <div>
                    <p className="font-black text-slate-900 text-lg">{option.label}</p>
                    <p className="text-sm text-slate-500 font-medium mt-1">{option.desc}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${settings.priceVisibility === option.id ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/20' : 'border-slate-200'}`}>
                    {settings.priceVisibility === option.id && <CheckCircle2 size={18} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3 mb-8">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Lock size={28} />
              </div>
              <span>Безопасность</span>
            </h3>
            <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 flex items-start space-x-4">
              <Shield className="text-rose-600 shrink-0 mt-1" size={24} />
              <p className="text-sm text-rose-700 font-bold leading-relaxed">
                Некоторые настройки прав доступа могут повлиять на целостность данных. Рекомендуется выдавать права на удаление только доверенным администраторам.
              </p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}



