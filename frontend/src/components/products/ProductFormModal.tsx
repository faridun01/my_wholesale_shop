import React from 'react';
import {
  Camera,
  Edit,
  Loader2,
  Package,
  Trash2,
  X,
  Tag,
  FolderTree,
  Warehouse,
  Layers,
  TrendingUp,
  AlertTriangle,
  Check,
  Image as ImageIcon
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { clsx } from 'clsx';
import { handleBrokenImage, resolveMediaUrl } from '../../utils/media';
import { formatProductName } from '../../utils/productName';
import {
  formatPriceInput,
  normalizeOcrBaseUnit,
  normalizeOcrPackageName,
  type ProductFormData,
} from '../../utils/productsViewUtils';

interface ProductFormModalProps {
  isOpen: boolean;
  isEditMode: boolean;
  isAdmin: boolean;
  formData: ProductFormData;
  categoryInput: string;
  visibleCategories: any[];
  warehouses: any[];
  isPhotoUploading: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  setCategoryInput: (value: string) => void;
  setIsCategoryManual: (value: boolean) => void;
  onPhotoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ProductFormModal({
  isOpen,
  isEditMode,
  isAdmin,
  formData,
  categoryInput,
  visibleCategories,
  warehouses,
  isPhotoUploading,
  onClose,
  onSubmit,
  setFormData,
  setCategoryInput,
  setIsCategoryManual,
  onPhotoUpload,
}: ProductFormModalProps) {
  if (!isOpen) return null;

  const cost = Number(formData.costPrice || 0);
  const sell = Number(formData.sellingPrice || 0);
  const marginPercent = sell > 0 && cost > 0 ? ((sell - cost) / sell) * 100 : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-3"
        >
          <m.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] sm:max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-2xl"
          >
            {/* Mobile Drag Indicator */}
            <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>

            {/* Compact Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3.5 py-2.5 sm:px-5 sm:py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={clsx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-xs',
                  isEditMode
                    ? 'bg-linear-to-br from-blue-600 to-indigo-600'
                    : 'bg-linear-to-br from-slate-900 to-slate-800'
                )}>
                  {isEditMode ? <Edit size={15} /> : <Package size={15} />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                    {isEditMode ? 'Редактировать товар' : 'Новый товар'}
                  </h3>
                  {isEditMode && formData.name ? (
                    <p className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px] sm:max-w-xs mt-0.5">
                      {formatProductName(formData.name)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Параметры и цены товара
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                title="Закрыть"
              >
                <X size={15} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col bg-slate-50/40">
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                {/* Block 1: Basic Information */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 space-y-2 shadow-2xs">
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      <Tag size={11} className="text-slate-400" />
                      <span>Наименование товара</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(event) => {
                        setIsCategoryManual(false);
                        setFormData({ ...formData, name: event.target.value });
                      }}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                      placeholder="Например: SKIF 280гр или Сахар белый 50кг"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        <FolderTree size={11} className="text-slate-400" />
                        <span>Категория</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        list="product-categories"
                        required
                        value={categoryInput}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          const matchedCategory = visibleCategories.find(
                            (category) => String(category?.name || '').trim().toLowerCase() === nextValue.trim().toLowerCase(),
                          );

                          setIsCategoryManual(Boolean(nextValue.trim()));
                          setCategoryInput(nextValue);
                          setFormData({
                            ...formData,
                            categoryId: matchedCategory?.id ? String(matchedCategory.id) : '',
                          });
                        }}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 text-xs font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                        placeholder="Выберите категорию"
                      />
                      <datalist id="product-categories">
                        {visibleCategories.map((category) => (
                          <option key={category.id} value={category.name} />
                        ))}
                      </datalist>
                    </div>

                    {warehouses.length > 1 ? (
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          <Warehouse size={11} className="text-slate-400" />
                          <span>Склад</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={formData.warehouseId}
                          onChange={(event) => setFormData({ ...formData, warehouseId: event.target.value })}
                          className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 text-xs font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                        >
                          <option value="">Выберите склад</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Block 2: Packaging & Units */}
                <div className="rounded-xl border border-indigo-100/90 bg-linear-to-br from-indigo-50/30 via-white to-indigo-50/15 p-2.5 sm:p-3 space-y-2 shadow-2xs">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 items-end">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-indigo-950">
                        Базовая единица <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.baseUnitName}
                        onChange={(event) => {
                          const nextBaseUnit = normalizeOcrBaseUnit(event.target.value);
                          setFormData({
                            ...formData,
                            baseUnitName: nextBaseUnit,
                            unit: nextBaseUnit,
                          });
                        }}
                        className="h-8 w-full rounded-lg border border-indigo-200/80 bg-white px-2.5 text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                      >
                        <option value="шт">Штука (шт)</option>
                        <option value="кг">Килограмм (кг)</option>
                        <option value="литр">Литр</option>
                        <option value="бутылка">Бутылка</option>
                        <option value="флакон">Флакон</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-indigo-950">
                        Оптовая упаковка
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            packagingEnabled: !prev.packagingEnabled,
                            packageName: prev.packageName || 'коробка',
                            unitsPerPackage: prev.packagingEnabled ? '' : prev.unitsPerPackage,
                          }))
                        }
                        className={clsx(
                          'h-8 flex w-full items-center justify-between rounded-lg border px-2.5 text-xs font-bold transition-all shadow-2xs active:scale-95',
                          formData.packagingEnabled
                            ? 'border-indigo-300 bg-indigo-600 text-white shadow-indigo-600/20'
                            : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers size={13} />
                          <span>{formData.packagingEnabled ? 'Упаковка вкл' : 'Только штучно'}</span>
                        </span>
                        <span
                          className={clsx(
                            'rounded px-1.5 py-0.5 text-[9px] font-black',
                            formData.packagingEnabled ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {formData.packagingEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Packaging Inputs */}
                  {formData.packagingEnabled && (
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-indigo-200/70 bg-indigo-50/60 p-2">
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-indigo-950">
                          Тип тары
                        </label>
                        <select
                          value={formData.packageName}
                          onChange={(event) =>
                            setFormData({ ...formData, packageName: normalizeOcrPackageName(event.target.value) || 'коробка' })
                          }
                          className="h-7.5 w-full rounded-md border border-indigo-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                        >
                          <option value="коробка">Коробка</option>
                          <option value="мешок">Мешок</option>
                          <option value="блок">Блок</option>
                          <option value="пачка">Пачка</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-indigo-950 truncate">
                          Вместимость ({formData.baseUnitName || 'шт'})
                        </label>
                        <input
                          type="number"
                          min="2"
                          step="1"
                          required={formData.packagingEnabled}
                          value={formData.unitsPerPackage}
                          onChange={(event) => setFormData({ ...formData, unitsPerPackage: event.target.value })}
                          className="h-7.5 w-full rounded-md border border-indigo-200 bg-white px-2 font-mono text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                          placeholder="Напр. 24"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Block 3: Pricing & Margin */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Ценообразование
                    </span>
                    {marginPercent !== null && (
                      <span className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black border',
                        marginPercent > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      )}>
                        <TrendingUp size={10} />
                        Маржа: {marginPercent > 0 ? '+' : ''}{marginPercent.toFixed(1)}%
                      </span>
                    )}
                  </div>

                  <div className={clsx('grid gap-2', isAdmin ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
                    {isAdmin && (
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600 truncate">
                          Себестоимость за 1 {formData.baseUnitName || 'шт'} <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={formData.costPrice}
                            onChange={(event) => setFormData({ ...formData, costPrice: event.target.value })}
                            onBlur={(event) => setFormData({ ...formData, costPrice: formatPriceInput(event.target.value) })}
                            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-2.5 pr-8 font-mono text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                            placeholder="0.00"
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                            TJS
                          </span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-slate-600 truncate">
                        Цена продажи за 1 {formData.baseUnitName || 'шт'} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={formData.sellingPrice}
                          onChange={(event) => setFormData({ ...formData, sellingPrice: event.target.value })}
                          onBlur={(event) => setFormData({ ...formData, sellingPrice: formatPriceInput(event.target.value) })}
                          className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-2.5 pr-8 font-mono text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                          placeholder="0.00"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          TJS
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Block 4: Stock Limits & Photo */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                    <div>
                      <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-slate-600 truncate">
                        <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                        <span>Мин. остаток ({formData.baseUnitName || 'шт'})</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={formData.minStock}
                        onChange={(event) => setFormData({ ...formData, minStock: event.target.value })}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 font-mono text-xs font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 shadow-2xs"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                        <ImageIcon size={11} className="text-slate-400 shrink-0" />
                        <span>Фото товара</span>
                      </label>
                      <div className="flex h-8 items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-2 shadow-2xs">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors">
                          {isPhotoUploading ? (
                            <Loader2 size={13} className="animate-spin text-indigo-600" />
                          ) : (
                            <Camera size={13} className="text-indigo-600" />
                          )}
                          <span className="text-[11px]">{isPhotoUploading ? 'Загрузка...' : 'Выбрать фото'}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={onPhotoUpload}
                            disabled={isPhotoUploading}
                          />
                        </label>

                        {formData.photoUrl ? (
                          <div className="flex items-center gap-1.5">
                            <img
                              src={resolveMediaUrl(formData.photoUrl, formData.name || 'preview')}
                              alt="Фото товара"
                              className="h-6 w-6 rounded-md object-cover border border-slate-200 shadow-2xs"
                              referrerPolicy="no-referrer"
                              onError={(event) => handleBrokenImage(event, formData.name || 'preview')}
                            />
                            <button
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, photoUrl: '' }))}
                              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Удалить фото"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Нет фото</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-3.5 py-2 sm:px-5 sm:py-2.5 shadow-xs">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8.5 rounded-lg border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 text-xs font-black uppercase tracking-wider text-white shadow-xs active:scale-95 transition-all"
                >
                  {isEditMode ? <Edit size={13} /> : <Check size={13} />}
                  <span>{isEditMode ? 'Сохранить' : 'Создать'}</span>
                </button>
              </div>
            </form>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
