import React, { useState } from 'react';
import { UserPlus, Shield, ShieldOff, Trash2, Plus, Edit } from 'lucide-react';
import { Card, Badge } from '../components/UI';

interface SettingsViewProps {
  users: any[];
  settings: any;
  fetchData: () => void;
  warehouses: any[];
  user: any;
}

export const SettingsView = ({ users, settings, fetchData, warehouses, user }: SettingsViewProps) => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [newWarehouse, setNewWarehouse] = useState({
    city: '',
    name_address: '',
    note: ''
  });

  React.useEffect(() => {
    if (editingWarehouse) {
      setNewWarehouse({
        city: editingWarehouse.city || '',
        name_address: editingWarehouse.name_address || '',
        note: editingWarehouse.note || ''
      });
    } else {
      setNewWarehouse({ city: '', name_address: '', note: '' });
    }
  }, [editingWarehouse]);

  const updateSetting = async (key: string, value: string) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    fetchData();
  };

  const updateUser = async (userId: number, data: any) => {
    await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    fetchData();
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouse.city || !newWarehouse.name_address) return;
    
    if (editingWarehouse) {
      await fetch(`/api/warehouses/${editingWarehouse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWarehouse)
      });
    } else {
      await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWarehouse)
      });
    }
    
    setNewWarehouse({ city: '', name_address: '', note: '' });
    setShowAddWarehouse(false);
    setEditingWarehouse(null);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <Card title="Настройки каталога">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Отображение цен в каталоге</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: 'all', label: 'Показывать всем' },
                { id: 'in_stock', label: 'Только если в наличии' },
                { id: 'none', label: 'Скрыть все цены' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => updateSetting('catalog_show_prices', opt.id)}
                  className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                    settings.catalog_show_prices === opt.id 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Управление складами">
        <div className="space-y-4">
          <div className="flex justify-end">
            <button 
              onClick={() => {
                setEditingWarehouse(null);
                setShowAddWarehouse(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
            >
              <Plus size={18} />
              <span>Добавить склад</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map(w => (
              <div key={w.id} className="p-4 border border-slate-200 rounded-xl flex justify-between items-start bg-slate-50 group relative">
                <div>
                  <p className="font-bold text-slate-900">{w.name_address}</p>
                  <p className="text-sm text-slate-600">{w.city}</p>
                  {w.note && <p className="text-xs text-slate-400 mt-1 italic">{w.note}</p>}
                  <p className="text-[10px] text-slate-400 mt-2 font-mono">ID: {w.id}</p>
                </div>
                <div className="flex flex-col space-y-1">
                  <button 
                    onClick={() => {
                      setEditingWarehouse(w);
                      setShowAddWarehouse(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 p-1.5 bg-white rounded-lg shadow-sm"
                  >
                    <Edit size={16} />
                  </button>
                  {warehouses.length > 1 && (
                    <button 
                      onClick={async () => {
                        if (confirm(`Удалить склад ${w.name_address}?`)) {
                          const res = await fetch(`/api/warehouses/${w.id}?user_role=${user?.role}`, { method: 'DELETE' });
                          if (!res.ok) {
                            const err = await res.json();
                            alert(err.error);
                          } else {
                            fetchData();
                          }
                        }
                      }}
                      className="text-rose-600 hover:text-rose-800 p-1.5 bg-white rounded-lg shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Управление пользователями">
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => setShowAddUser(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
            >
              <UserPlus size={18} />
              <span>Добавить сотрудника</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-sm font-semibold text-slate-600">Имя пользователя</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-600">Роль</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-600">Склад</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-600">Права</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="px-4 py-4 font-medium text-slate-900">{u.username}</td>
                    <td className="px-4 py-4">
                      <Badge variant={u.role === 'admin' ? 'indigo' : 'slate' as any}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <select 
                        className="text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={u.warehouse_id || ''}
                        onChange={(e) => updateUser(u.id, { warehouse_id: Number(e.target.value) })}
                      >
                        <option value="">Не назначен</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_address}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={!!u.can_cancel} 
                            onChange={(e) => updateUser(u.id, { can_cancel: e.target.checked ? 1 : 0 })}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="text-xs text-slate-600 group-hover:text-indigo-600">Отмена</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={!!u.can_delete} 
                            onChange={(e) => updateUser(u.id, { can_delete: e.target.checked ? 1 : 0 })}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="text-xs text-slate-600 group-hover:text-indigo-600">Удаление</span>
                        </label>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right space-x-2">
                      <button 
                        onClick={() => {
                          setEditingUser(u);
                          setShowAddUser(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 p-2"
                      >
                        <Edit size={18} />
                      </button>
                      {(u.role !== 'admin' || user?.role === 'admin') && u.id !== user?.id && (
                        <button 
                          onClick={async () => {
                            if (confirm(`Удалить пользователя ${u.username}?`)) {
                              await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
                              fetchData();
                            }
                          }}
                          className="text-rose-600 hover:text-rose-800 p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">{editingUser ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h3>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              
              const payload = {
                ...data,
                can_cancel: data.can_cancel === 'on' ? 1 : 0,
                can_delete: data.can_delete === 'on' ? 1 : 0
              };

              if (editingUser) {
                await fetch(`/api/users/${editingUser.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
              } else {
                await fetch('/api/users', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
              }
              
              fetchData();
              setShowAddUser(false);
              setEditingUser(null);
            }}>
              <div>
                <label className="block text-sm font-medium mb-1">Логин</label>
                <input name="username" defaultValue={editingUser?.username} required className="w-full px-4 py-2 rounded-lg border border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{editingUser ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}</label>
                <input name="password" type="password" required={!editingUser} className="w-full px-4 py-2 rounded-lg border border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Роль</label>
                <select name="role" defaultValue={editingUser?.role || 'staff'} required className="w-full px-4 py-2 rounded-lg border border-slate-200">
                  <option value="staff">Сотрудник</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Склад</label>
                <select name="warehouse_id" defaultValue={editingUser?.warehouse_id || ''} required className="w-full px-4 py-2 rounded-lg border border-slate-200">
                  <option value="">Не назначен</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_address}</option>)}
                </select>
              </div>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input name="can_cancel" type="checkbox" defaultChecked={!!editingUser?.can_cancel} className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm text-slate-600">Отмена накладных</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input name="can_delete" type="checkbox" defaultChecked={!!editingUser?.can_delete} className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm text-slate-600">Удаление данных</span>
                </label>
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => { setShowAddUser(false); setEditingUser(null); }} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg">Отмена</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">{editingUser ? 'Сохранить' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddWarehouse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">{editingWarehouse ? 'Редактировать склад' : 'Новый склад'}</h3>
            <form className="space-y-4" onSubmit={handleAddWarehouse}>
              <div>
                <label className="block text-sm font-medium mb-1">Город</label>
                <input 
                  value={newWarehouse.city}
                  onChange={e => setNewWarehouse({ ...newWarehouse, city: e.target.value })}
                  required 
                  className="w-full px-4 py-2 rounded-lg border border-slate-200" 
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Название / Адрес</label>
                <input 
                  value={newWarehouse.name_address}
                  onChange={e => setNewWarehouse({ ...newWarehouse, name_address: e.target.value })}
                  required 
                  className="w-full px-4 py-2 rounded-lg border border-slate-200" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Заметка</label>
                <textarea 
                  value={newWarehouse.note}
                  onChange={e => setNewWarehouse({ ...newWarehouse, note: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200" 
                  rows={2}
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => { setShowAddWarehouse(false); setEditingWarehouse(null); }} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg">Отмена</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg">{editingWarehouse ? 'Сохранить' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
