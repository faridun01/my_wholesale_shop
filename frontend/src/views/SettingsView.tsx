import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../api/warehouses.api';
import { 
  Warehouse, 
  Users, 
  User,
  Shield, 
  Plus, 
  Trash2, 
  Edit,
  MapPin,
  Phone,
  Settings as SettingsIcon,
  Eye,
  Lock,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { getCurrentUser } from '../utils/userAccess';

export default function SettingsView() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'warehouses' | 'users' | 'general' | 'profile'>('warehouses');
  
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [showEditWarehouse, setShowEditWarehouse] = useState(false);
  const [showDeleteWarehouseConfirm, setShowDeleteWarehouseConfirm] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  
  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    city: '',
    address: ''
  });

  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
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
    setWarehouseForm({ name: '', city: '', address: '' });
    setSelectedWarehouse(null);
  };

  const handleDeleteUser = async (id: number) => {
    if (!isAdmin) {
      toast.error('Недостаточно прав');
      return;
    }
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    try {
      await client.delete(`/auth/users/${id}`);
      toast.success('Пользователь удален');
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
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      
      setProfileForm({ ...profileForm, password: '', confirmPassword: '' });
    } catch (err) {
      toast.error('Ошибка при обновлении профиля');
    }
  };

  const handleUpdateUserPermission = async (userId: number, field: string, value: boolean) => {
    if (!isAdmin) {
      toast.error('Недостаточно прав');
      return;
    }
    try {
      await client.put(`/auth/users/${userId}`, { [field]: value });
      toast.success('Права обновлены');
      fetchData();
    } catch (err) {
      toast.error('Ошибка при обновлении прав');
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

  return (
    <div className="rounded-[30px] border border-white/70 bg-[#f4f5fb] p-4 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6 pb-20">
      <section className="rounded-[28px] border border-white bg-white p-5 shadow-sm sm:px-6 sm:py-6">
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
      <div className="flex w-fit flex-wrap gap-1 rounded-2xl border border-white bg-white p-1 shadow-sm">
        <button 
          onClick={() => setActiveTab('warehouses')}
          className={`flex items-center space-x-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${activeTab === 'warehouses' ? tabTheme.warehouses : 'text-slate-500 hover:bg-sky-50 hover:text-sky-700'}`}
        >
          <Warehouse size={18} />
          <span>Склады</span>
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${activeTab === 'users' ? tabTheme.users : 'text-slate-500 hover:bg-violet-50 hover:text-violet-700'}`}
        >
          <Users size={18} />
          <span>Пользователи</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex items-center space-x-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${activeTab === 'profile' ? tabTheme.profile : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}
        >
          <User size={18} />
          <span>Профиль</span>
        </button>
        {canManageSettings && (
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center space-x-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${activeTab === 'general' ? tabTheme.general : 'text-slate-500 hover:bg-amber-50 hover:text-amber-700'}`}
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
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3">
                  <div className="rounded-2xl bg-sky-500 p-3 text-white shadow-lg shadow-sky-500/20">
                    <Warehouse size={24} />
                  </div>
                  <span>{showEditWarehouse ? 'Редактировать склад' : 'Новый склад'}</span>
                </h3>
                <button onClick={() => { setShowAddWarehouse(false); setShowEditWarehouse(false); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={showEditWarehouse ? handleEditWarehouse : handleAddWarehouse} className="p-8 space-y-6">
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
                </div>
                <div className="flex justify-end space-x-3 pt-6">
                  <button type="button" onClick={() => { setShowAddWarehouse(false); setShowEditWarehouse(false); }} className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Отмена</button>
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
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3">
                  <div className="rounded-2xl bg-violet-500 p-3 text-white shadow-lg shadow-violet-500/20">
                    <Users size={24} />
                  </div>
                  <span>{showEditUser ? 'Редактировать пользователя' : 'Новый пользователь'}</span>
                </h3>
                <button onClick={() => { setShowAddUser(false); setShowEditUser(false); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={showEditUser ? handleEditUser : handleAddUser} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div className="flex flex-wrap gap-8 p-6 bg-slate-50 rounded-3xl">
                  <label className="flex items-center space-x-4 cursor-pointer group">
                    <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${newUser.canCancelInvoices ? 'bg-slate-900 border-slate-900 shadow-lg shadow-slate-900/20' : 'bg-white border-slate-200 group-hover:border-slate-400'}`}>
                      {newUser.canCancelInvoices && <CheckCircle2 size={20} className="text-white" />}
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={newUser.canCancelInvoices}
                      onChange={e => setNewUser({...newUser, canCancelInvoices: e.target.checked})}
                    />
                    <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Отмена накладных</span>
                  </label>
                  
                  <label className="flex items-center space-x-4 cursor-pointer group">
                    <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${newUser.canDeleteData ? 'bg-rose-600 border-rose-600 shadow-lg shadow-rose-600/30' : 'bg-white border-slate-200 group-hover:border-rose-400'}`}>
                      {newUser.canDeleteData && <CheckCircle2 size={20} className="text-white" />}
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={newUser.canDeleteData}
                      onChange={e => setNewUser({...newUser, canDeleteData: e.target.checked})}
                    />
                    <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Удаление данных</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                  <button type="button" onClick={() => { setShowAddUser(false); setShowEditUser(false); }} className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Отмена</button>
                  <button type="submit" className="rounded-2xl bg-violet-500 px-10 py-4 font-bold text-white shadow-xl shadow-violet-500/20 transition-all hover:bg-violet-600 active:scale-95">
                    {showEditUser ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={showDeleteWarehouseConfirm}
        onClose={() => setShowDeleteWarehouseConfirm(false)}
        onConfirm={handleDeleteWarehouse}
        title="Удалить склад?"
        message={`Вы уверены, что хотите удалить склад "${selectedWarehouse?.name}"? Это действие нельзя отменить.`}
      />

      {activeTab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {warehouses.map(w => (
            <div key={w.id} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl">
              <div className="flex justify-between items-start mb-8">
                <div className="rounded-2xl bg-sky-100 p-4 text-sky-700 shadow-inner transition-all duration-500 group-hover:bg-sky-500 group-hover:text-white">
                  <Warehouse size={28} />
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => {
                      setSelectedWarehouse(w);
                      setWarehouseForm({ 
                        name: w.name || '', 
                        city: w.city || '', 
                        address: w.address || '' 
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
              <h3 className="text-xl font-black text-slate-900">{w.name}</h3>
              <div className="mt-6 space-y-4">
                <div className="flex items-center text-slate-500 font-bold">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center mr-3 text-slate-400">
                    <MapPin size={16} />
                  </div>
                  <span>{w.city}, {w.address}</span>
                </div>
                <div className="flex items-center text-slate-500 font-bold">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center mr-3 text-slate-400">
                    <Phone size={16} />
                  </div>
                  <span>+992 900 00 00 00</span>
                </div>
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
              className="flex items-center space-x-2 rounded-2xl bg-violet-500 px-8 py-4 font-black text-white shadow-xl shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:bg-violet-600 active:scale-95"
            >
              <Plus size={20} />
              <span>Добавить пользователя</span>
            </button>
          </div>

          <AnimatePresence>
            {showAddUser && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white p-10 shadow-sm"
              >
                <div className="absolute top-0 left-0 h-2 w-full bg-violet-500"></div>
                <h3 className="text-2xl font-black text-slate-900 mb-8">Новый пользователь</h3>
                <form onSubmit={handleAddUser} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Логин</label>
                      <input 
                        type="text" 
                        placeholder="username" 
                        required
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Пароль</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        required
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-slate-300/40 focus:border-slate-300 transition-all font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Роль</label>
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
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Склад</label>
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
                  
                  <div className="flex flex-wrap gap-8 p-6 bg-slate-50 rounded-3xl">
                    <label className="flex items-center space-x-4 cursor-pointer group">
                      <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${newUser.canCancelInvoices ? 'bg-slate-900 border-slate-900 shadow-lg shadow-slate-900/20' : 'bg-white border-slate-200 group-hover:border-slate-400'}`}>
                        {newUser.canCancelInvoices && <CheckCircle2 size={20} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={newUser.canCancelInvoices}
                        onChange={e => setNewUser({...newUser, canCancelInvoices: e.target.checked})}
                      />
                      <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Отмена накладных</span>
                    </label>
                    
                    <label className="flex items-center space-x-4 cursor-pointer group">
                      <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${newUser.canDeleteData ? 'bg-rose-600 border-rose-600 shadow-lg shadow-rose-600/30' : 'bg-white border-slate-200 group-hover:border-rose-400'}`}>
                        {newUser.canDeleteData && <CheckCircle2 size={20} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={newUser.canDeleteData}
                        onChange={e => setNewUser({...newUser, canDeleteData: e.target.checked})}
                      />
                      <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Удаление данных</span>
                    </label>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button type="button" onClick={() => setShowAddUser(false)} className="px-10 py-4 rounded-2xl font-black text-slate-500 hover:bg-slate-50 transition-all">Отмена</button>
                    <button type="submit" className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-900/15 hover:bg-slate-800 transition-all">Создать аккаунт</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-10 py-6">Пользователь</th>
                  <th className="px-10 py-6">Роль</th>
                  <th className="px-10 py-6">Доступ</th>
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
                      <div className="flex items-center space-x-4">
                        <button 
                          onClick={() => handleUpdateUserPermission(u.id, 'canCancelInvoices', !u.canCancelInvoices)}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${u.canCancelInvoices ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-slate-50 text-slate-400 border border-transparent opacity-50'}`}
                        >
                          {u.canCancelInvoices ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          <span>Отмена</span>
                        </button>
                        <button 
                          onClick={() => handleUpdateUserPermission(u.id, 'canDeleteData', !u.canDeleteData)}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${u.canDeleteData ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-400 border border-transparent opacity-50'}`}
                        >
                          {u.canDeleteData ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          <span>Удаление</span>
                        </button>
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
                          onClick={() => handleDeleteUser(u.id)}
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
        </div>
      )}
      {activeTab === 'general' && (
        <div className="max-w-2xl space-y-8">
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



