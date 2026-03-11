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
    phone: '',
    role: 'SELLER', 
    warehouseId: '',
    canCancelInvoices: false,
    canDeleteData: false
  });

  const [profileForm, setProfileForm] = useState({
    username: '',
    password: '',
    phone: ''
  });

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';

  useEffect(() => {
    fetchData();
    setProfileForm({
      username: currentUser.username || '',
      password: '',
      phone: currentUser.phone || ''
    });
  }, []);

  const fetchData = async () => {
    try {
      const wData = await getWarehouses();
      setWarehouses(wData);
      
      const sRes = await client.get('/settings');
      setSettings(sRes.data);
      
      if (isAdmin) {
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
    try {
      await client.post('/auth/register', {
        ...newUser,
        warehouseId: newUser.warehouseId ? Number(newUser.warehouseId) : undefined
      });
      toast.success('Пользователь создан');
      setShowAddUser(false);
      setNewUser({ 
        username: '', 
        password: '', 
        phone: '',
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
    try {
      await client.put(`/auth/users/${selectedUser.id}`, {
        ...newUser,
        warehouseId: newUser.warehouseId ? Number(newUser.warehouseId) : null
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
      const data: any = { username: profileForm.username, phone: profileForm.phone };
      if (profileForm.password) data.password = profileForm.password;
      
      const res = await client.put(`/auth/users/${currentUser.id}`, data);
      toast.success('Профиль обновлен. Пожалуйста, войдите снова, если вы изменили логин или пароль.');
      
      // Update local storage if needed, but safer to just let them re-login if they changed sensitive info
      const updatedUser = { ...currentUser, ...res.data };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setProfileForm({ ...profileForm, password: '' });
    } catch (err) {
      toast.error('Ошибка при обновлении профиля');
    }
  };

  const handleUpdateUserPermission = async (userId: number, field: string, value: boolean) => {
    try {
      await client.put(`/auth/users/${userId}`, { [field]: value });
      toast.success('Права обновлены');
      fetchData();
    } catch (err) {
      toast.error('Ошибка при обновлении прав');
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      await client.post('/settings', { key, value });
      setSettings({ ...settings, [key]: value });
      toast.success('Настройки сохранены');
    } catch (err) {
      toast.error('Ошибка при сохранении настроек');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Настройки</h1>
        <p className="text-slate-500 mt-1 font-medium">Настройте параметры системы и управляйте доступом.</p>
      </div>

      <div className="flex space-x-1 bg-slate-200/50 p-1.5 rounded-[1.5rem] w-fit">
        <button 
          onClick={() => setActiveTab('warehouses')}
          className={`flex items-center space-x-2 px-8 py-3 rounded-2xl font-black transition-all ${activeTab === 'warehouses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Warehouse size={18} />
          <span>Склады</span>
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 px-8 py-3 rounded-2xl font-black transition-all ${activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={18} />
          <span>Пользователи</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex items-center space-x-2 px-8 py-3 rounded-2xl font-black transition-all ${activeTab === 'profile' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <User size={18} />
          <span>Профиль</span>
        </button>
        {isAdmin && (
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center space-x-2 px-8 py-3 rounded-2xl font-black transition-all ${activeTab === 'general' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <SettingsIcon size={18} />
            <span>Общие</span>
          </button>
        )}
      </div>

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
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl">
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
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
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
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
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
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                      placeholder="Напр: ул. Рудаки 10"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-6">
                  <button type="button" onClick={() => { setShowAddWarehouse(false); setShowEditWarehouse(false); }} className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Отмена</button>
                  <button type="submit" className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
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
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl">
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
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
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
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Телефон (для восстановления)</label>
                    <input 
                      type="text" 
                      value={newUser.phone}
                      onChange={e => setNewUser({...newUser, phone: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                      placeholder="+992 000 000 000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Роль</label>
                    <select 
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold appearance-none bg-white"
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
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold appearance-none bg-white"
                    >
                      <option value="">Все склады</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-8 p-6 bg-slate-50 rounded-3xl">
                  <label className="flex items-center space-x-4 cursor-pointer group">
                    <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${newUser.canCancelInvoices ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/30' : 'bg-white border-slate-200 group-hover:border-indigo-400'}`}>
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
                  <button type="submit" className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
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
            <div key={w.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
              <div className="flex justify-between items-start mb-8">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
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
                    className="p-3 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 transition-all"
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
            className="border-4 border-dashed border-slate-100 rounded-[2.5rem] p-8 flex flex-col items-center justify-center space-y-4 text-slate-300 hover:border-indigo-200 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all group"
          >
            <div className="p-5 bg-slate-50 rounded-3xl group-hover:bg-white group-hover:shadow-lg transition-all duration-500">
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
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center space-x-2 active:scale-95"
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
                className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl mb-8 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
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
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
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
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Роль</label>
                      <select 
                        value={newUser.role}
                        onChange={e => setNewUser({...newUser, role: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold appearance-none bg-white"
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
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold appearance-none bg-white"
                      >
                        <option value="">Все склады</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-8 p-6 bg-slate-50 rounded-3xl">
                    <label className="flex items-center space-x-4 cursor-pointer group">
                      <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${newUser.canCancelInvoices ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/30' : 'bg-white border-slate-200 group-hover:border-indigo-400'}`}>
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
                    <button type="submit" className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all">Создать аккаунт</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
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
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-lg group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
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
                          u.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'
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
                          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${u.canCancelInvoices ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-50 text-slate-400 border border-transparent opacity-50'}`}
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
                              phone: u.phone || '',
                              role: u.role || 'SELLER',
                              warehouseId: u.warehouseId ? String(u.warehouseId) : '',
                              canCancelInvoices: !!u.canCancelInvoices,
                              canDeleteData: !!u.canDeleteData
                            });
                            setShowEditUser(true);
                          }}
                          className="text-slate-300 hover:text-indigo-600 p-3 hover:bg-indigo-50 rounded-xl transition-all"
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
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3 mb-8">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
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
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                />
              </div>
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Новый пароль (оставьте пустым, если не хотите менять)</label>
                <input 
                  type="password" 
                  value={profileForm.password}
                  onChange={e => setProfileForm({...profileForm, password: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Телефон (для восстановления пароля)</label>
                <input 
                  type="text" 
                  value={profileForm.phone}
                  onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                  placeholder="+992 000 000 000"
                />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
                  Сохранить изменения
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {activeTab === 'general' && (
        <div className="max-w-2xl space-y-8">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
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
                  className={`flex items-center justify-between p-8 rounded-[2rem] border-2 transition-all text-left group ${settings.priceVisibility === option.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-50 hover:border-slate-200 hover:bg-slate-50/50'}`}
                >
                  <div>
                    <p className="font-black text-slate-900 text-lg">{option.label}</p>
                    <p className="text-sm text-slate-500 font-medium mt-1">{option.desc}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${settings.priceVisibility === option.id ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/30' : 'border-slate-200'}`}>
                    {settings.priceVisibility === option.id && <CheckCircle2 size={18} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
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
  );
}
