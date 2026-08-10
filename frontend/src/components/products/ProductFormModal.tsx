import React from 'react';
import { Camera, Edit, Loader2, Package, X } from 'lucide-react';
import { motion } from 'motion/react';
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
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
              {isEditMode ? <Edit size={18} /> : <Package size={18} />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {isEditMode ? 'Редактировать товар' : 'Новый товар'}
              </h3>
              {isEditMode && formData.name && (
                <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md">{formatProductName(formData.name)}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto bg-[#f4f5fb]/40 p-6">
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-xs md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">Название товара</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(event) => {
                  setIsCategoryManual(false);
                  setFormData({ ...formData, name: event.target.value });
                }}
                className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                placeholder="Напр: Чистящее средство SKIF 280гр"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Базовая единица</label>
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
                className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              >
                <option value="шт">Шт</option>
                <option value="кг">Кг</option>
                <option value="литр">Литр</option>
                <option value="бутылка">Бутылка</option>
                <option value="флакон">Флакон</option>
              </select>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                Основная единица учёта товара на складе.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="mb-0.5 block text-xs font-semibold text-amber-900">Упаковка</label>
                  <p className="text-[11px] font-medium text-amber-700/80">Коробки или мешки для учёта остатков.</p>
                </div>
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
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    formData.packagingEnabled
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {formData.packagingEnabled ? 'Коробки / мешки' : 'Только шт'}
                </button>
              </div>

              {formData.packagingEnabled && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-amber-900">Тип упаковки</label>
                    <select
                      value={formData.packageName}
                      onChange={(event) => setFormData({ ...formData, packageName: normalizeOcrPackageName(event.target.value) || 'коробка' })}
                      className="w-full rounded-full border border-amber-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none"
                    >
                      <option value="коробка">Коробка</option>
                      <option value="мешок">Мешок</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-amber-900">
                      Шт в {formData.packageName === 'мешок' ? 'мешке' : 'коробке'}
                    </label>
                    <input
                      type="number"
                      min="2"
                      step="1"
                      required={formData.packagingEnabled}
                      value={formData.unitsPerPackage}
                      onChange={(event) => setFormData({ ...formData, unitsPerPackage: event.target.value })}
                      className="w-full rounded-full border border-amber-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none"
                      placeholder="Напр: 24"
                    />
                  </div>
                  <div className="rounded-full border border-amber-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-900 sm:col-span-2">
                    1 {formData.packageName || 'коробка'} = {Number(formData.unitsPerPackage || 0) || '...'} {normalizeDisplayBaseUnit(formData.baseUnitName || 'шт')}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-xs md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Категория</label>
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
                className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                placeholder="Выберите или введите категорию"
              />
              <datalist id="product-categories">
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.name} />
                ))}
              </datalist>
            </div>

            {warehouses.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Склад по умолчанию</label>
                <select
                  required
                  value={formData.warehouseId}
                  onChange={(event) => setFormData({ ...formData, warehouseId: event.target.value })}
                  className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                >
                  <option value="">Выберите склад</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
            )}

            {isAdmin && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Себестоимость</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.costPrice}
                  onChange={(event) => setFormData({ ...formData, costPrice: event.target.value })}
                  onBlur={(event) => setFormData({ ...formData, costPrice: formatPriceInput(event.target.value) })}
                  className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Цена продажи</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.sellingPrice}
                onChange={(event) => setFormData({ ...formData, sellingPrice: event.target.value })}
                onBlur={(event) => setFormData({ ...formData, sellingPrice: formatPriceInput(event.target.value) })}
                className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">Фото товара</label>
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-[#f4f5fb]/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50">
                  {isPhotoUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
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
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img
                        src={resolveMediaUrl(formData.photoUrl, formData.name || 'preview')}
                        alt="Фото товара"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(event) => handleBrokenImage(event, formData.name || 'preview')}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, photoUrl: '' }))}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Убрать фото
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-2xl">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              {isEditMode ? 'Сохранить изменения' : 'Создать'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
