import React from 'react';
import { Camera, Edit, Loader2, Package, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
          >
            {/* Mobile Drag Indicator */}
            <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
              <div className="h-1 w-9 rounded-full bg-slate-300" />
            </div>

            {/* Compact Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5 sm:py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
                  {isEditMode ? <Edit size={15} /> : <Package size={15} />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {isEditMode ? 'Редактировать товар' : 'Новый товар'}
                  </h3>
                  {isEditMode && formData.name && (
                    <p className="text-[11px] font-medium text-slate-500 truncate max-w-[220px] sm:max-w-xs">
                      {formatProductName(formData.name)}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors active:scale-95"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Compact Form Body */}
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col bg-white">
              <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5">
                {/* Row 1: Name */}
                <div>
                  <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">
                    Наименование товара <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(event) => {
                      setIsCategoryManual(false);
                      setFormData({ ...formData, name: event.target.value });
                    }}
                    className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                    placeholder="Например: SKIF 280гр"
                  />
                </div>

                {/* Row 2: Category & Warehouse */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">
                      Категория <span className="text-rose-500">*</span>
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
                      className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
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
                      <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">
                        Склад <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.warehouseId}
                        onChange={(event) => setFormData({ ...formData, warehouseId: event.target.value })}
                        className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
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

                {/* Row 3: Unit & Packaging Toggle */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 items-start">
                  <div>
                    <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">
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
                      className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
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
                        'flex h-8.5 w-full items-center justify-between rounded-xl border px-3 text-xs font-semibold transition-all',
                        formData.packagingEnabled
                          ? 'border-indigo-200 bg-indigo-50/80 text-indigo-900'
                          : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100',
                      )}
                    >
                      <span>{formData.packagingEnabled ? 'Включена' : 'Только поштучно'}</span>
                      <span
                        className={clsx(
                          'rounded-md px-1.5 py-0.5 text-[9px] font-bold',
                          formData.packagingEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {formData.packagingEnabled ? 'Да' : 'Нет'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Expanded Packaging Inputs inline */}
                {formData.packagingEnabled && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-semibold text-indigo-950">Тип упаковки</label>
                      <select
                        value={formData.packageName}
                        onChange={(event) =>
                          setFormData({ ...formData, packageName: normalizeOcrPackageName(event.target.value) || 'коробка' })
                        }
                        className="h-7.5 w-full rounded-lg border border-indigo-200 bg-white px-2 text-xs font-medium text-slate-900 outline-none"
                      >
                        <option value="коробка">Коробка</option>
                        <option value="мешок">Мешок</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-semibold text-indigo-950 truncate">
                        Вместимость ({formData.baseUnitName || 'шт'})
                      </label>
                      <input
                        type="number"
                        min="2"
                        step="1"
                        required={formData.packagingEnabled}
                        value={formData.unitsPerPackage}
                        onChange={(event) => setFormData({ ...formData, unitsPerPackage: event.target.value })}
                        className="h-7.5 w-full rounded-lg border border-indigo-200 bg-white px-2 text-xs font-semibold text-slate-900 outline-none"
                        placeholder="24"
                      />
                    </div>
                  </div>
                )}

                {/* Row 4: Prices */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {isAdmin && (
                    <div>
                      <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">
                        Себестоимость за 1 {formData.baseUnitName || 'шт'} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.costPrice}
                        onChange={(event) => setFormData({ ...formData, costPrice: event.target.value })}
                        onBlur={(event) => setFormData({ ...formData, costPrice: formatPriceInput(event.target.value) })}
                        className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">
                      Цена продажи за 1 {formData.baseUnitName || 'шт'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.sellingPrice}
                      onChange={(event) => setFormData({ ...formData, sellingPrice: event.target.value })}
                      onBlur={(event) => setFormData({ ...formData, sellingPrice: formatPriceInput(event.target.value) })}
                      className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Row 4b: Low-stock threshold */}
                <div>
                  <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">
                    Мин. остаток для предупреждения ({formData.baseUnitName || 'шт'})
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.minStock}
                    onChange={(event) => setFormData({ ...formData, minStock: event.target.value })}
                    className="h-8.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                    placeholder="0"
                  />
                </div>

                {/* Row 5: Photo */}
                <div>
                  <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Фото товара</label>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-1.5">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors">
                      {isPhotoUploading ? (
                        <Loader2 size={14} className="animate-spin text-slate-500" />
                      ) : (
                        <Camera size={14} className="text-slate-500" />
                      )}
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
              </div>

              {/* Compact Footer Actions */}
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-5 sm:py-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 active:scale-95 transition-all"
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
