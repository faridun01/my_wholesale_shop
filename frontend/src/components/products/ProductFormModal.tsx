import React from 'react';
import { Camera, Edit, Loader2, Package, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { handleBrokenImage, resolveMediaUrl } from '../../utils/media';
import { formatProductName } from '../../utils/productName';
import {
  formatPriceInput,
  normalizeDisplayBaseUnit,
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
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm"
        >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 8 }}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              {isEditMode ? <Edit size={16} /> : <Package size={16} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isEditMode ? 'Редактировать товар' : 'Новый товар'}
              </h3>
              {isEditMode && formData.name && (
                <p className="text-[11px] text-slate-500 truncate max-w-xs">{formatProductName(formData.name)}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Compact Form Body (Single Viewport Fit) */}
        <form onSubmit={onSubmit} className="p-4 space-y-3 bg-white">
          {/* Row 1: Name */}
          <div>
            <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Наименование товара *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(event) => {
                setIsCategoryManual(false);
                setFormData({ ...formData, name: event.target.value });
              }}
              className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
              placeholder="Например: SKIF 280гр"
            />
          </div>

          {/* Row 2: Category & Warehouse */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Категория *</label>
              <input
                list="product-categories"
                required
                value={categoryInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  const matchedCategory = visibleCategories.find(
                    (category) => String(category?.name || '').trim().toLowerCase() === nextValue.trim().toLowerCase()
                  );

                  setIsCategoryManual(Boolean(nextValue.trim()));
                  setCategoryInput(nextValue);
                  setFormData({
                    ...formData,
                    categoryId: matchedCategory?.id ? String(matchedCategory.id) : '',
                  });
                }}
                className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                placeholder="Категория"
              />
              <datalist id="product-categories">
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.name} />
                ))}
              </datalist>
            </div>

            {warehouses.length > 1 ? (
              <div>
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Склад *</label>
                <select
                  required
                  value={formData.warehouseId}
                  onChange={(event) => setFormData({ ...formData, warehouseId: event.target.value })}
                  className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                >
                  <option value="">Выберите склад</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {/* Row 3: Unit & Packaging Toggle */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
            <div>
              <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Базовая единица *</label>
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
                className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
              >
                <option value="шт">Штука (шт)</option>
                <option value="кг">Килограмм (кг)</option>
                <option value="литр">Литр</option>
                <option value="бутылка">Бутылка</option>
                <option value="флакон">Флакон</option>
              </select>
            </div>

            <div>
              <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Упаковка</label>
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
                  'flex h-8 w-full items-center justify-between rounded-xl border px-3 text-xs font-semibold transition-all',
                  formData.packagingEnabled
                    ? 'border-indigo-200 bg-indigo-50/80 text-indigo-900'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                )}
              >
                <span>{formData.packagingEnabled ? 'Включена' : 'Только поштучно'}</span>
                <span className={clsx('rounded-md px-1.5 py-0.5 text-[9px] font-bold', formData.packagingEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600')}>
                  {formData.packagingEnabled ? 'Да' : 'Нет'}
                </span>
              </button>
            </div>
          </div>

          {/* Expanded Packaging Inputs inline */}
          {formData.packagingEnabled && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5">
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold text-indigo-950">Тип упаковки</label>
                <select
                  value={formData.packageName}
                  onChange={(event) => setFormData({ ...formData, packageName: normalizeOcrPackageName(event.target.value) || 'коробка' })}
                  className="h-7 w-full rounded-lg border border-indigo-200 bg-white px-2 text-xs font-medium text-slate-900 outline-none"
                >
                  <option value="коробка">Коробка</option>
                  <option value="мешок">Мешок</option>
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold text-indigo-950">
                  Вмещаемость ({formData.baseUnitName || 'шт'} в 1 {formData.packageName === 'мешок' ? 'мешке' : 'коробке'})
                </label>
                <input
                  type="number"
                  min="2"
                  step="1"
                  required={formData.packagingEnabled}
                  value={formData.unitsPerPackage}
                  onChange={(event) => setFormData({ ...formData, unitsPerPackage: event.target.value })}
                  className="h-7 w-full rounded-lg border border-indigo-200 bg-white px-2 text-xs font-medium text-slate-900 outline-none"
                  placeholder="24"
                />
              </div>
            </div>
          )}

          {/* Row 4: Prices */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isAdmin && (
              <div>
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Себестоимость за 1 {formData.baseUnitName || 'шт'} *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.costPrice}
                  onChange={(event) => setFormData({ ...formData, costPrice: event.target.value })}
                  onBlur={(event) => setFormData({ ...formData, costPrice: formatPriceInput(event.target.value) })}
                  className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                  placeholder="0.00"
                />
              </div>
            )}

            <div>
              <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Цена продажи за 1 {formData.baseUnitName || 'шт'} *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.sellingPrice}
                onChange={(event) => setFormData({ ...formData, sellingPrice: event.target.value })}
                onBlur={(event) => setFormData({ ...formData, sellingPrice: formatPriceInput(event.target.value) })}
                className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Row 4b: Low-stock threshold */}
          <div>
            <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Мин. остаток для предупреждения ({formData.baseUnitName || 'шт'})</label>
            <input
              type="number"
              step="1"
              min="0"
              value={formData.minStock}
              onChange={(event) => setFormData({ ...formData, minStock: event.target.value })}
              className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
              placeholder="0"
            />
          </div>

          {/* Row 5: Photo */}
          <div>
            <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Фото товара</label>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-1.5">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors">
                {isPhotoUploading ? <Loader2 size={14} className="animate-spin text-slate-500" /> : <Camera size={14} className="text-slate-500" />}
                <span>{isPhotoUploading ? 'Загрузка...' : 'Выбрать фото'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onPhotoUpload}
                  disabled={isPhotoUploading}
                />
              </label>

              {formData.photoUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={resolveMediaUrl(formData.photoUrl, formData.name || 'preview')}
                    alt="Фото товара"
                    className="h-7 w-7 rounded-lg object-cover border border-slate-200"
                    referrerPolicy="no-referrer"
                    onError={(event) => handleBrokenImage(event, formData.name || 'preview')}
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, photoUrl: '' }))}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Удалить фото"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Compact Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
            >
              {isEditMode ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
