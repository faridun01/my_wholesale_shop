import React from 'react';
import { Camera, Loader2, Plus } from 'lucide-react';
import { clsx } from 'clsx';

interface ProductsPageHeaderProps {
  isAdmin: boolean;
  isScanning: boolean;
  selectedWarehouseId: string;
  onAddProduct: () => void;
  onScanInvoice: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ProductsPageHeader({
  isAdmin,
  isScanning,
  selectedWarehouseId,
  onAddProduct,
  onScanInvoice,
}: ProductsPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Товары</h1>
        <p className="mt-0.5 text-xs text-slate-500">Управление ассортиментом, ценами и остатками.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {isAdmin && (
          <label
            className={clsx(
              'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-900 hover:text-white',
              !selectedWarehouseId && 'cursor-not-allowed opacity-50',
            )}
          >
            {isScanning ? (
              <Loader2 size={16} className="animate-spin text-slate-600" />
            ) : (
              <Camera size={16} />
            )}
            <span>{isScanning ? 'Чтение накладной...' : 'Загрузить накладную'}</span>
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={onScanInvoice}
              disabled={isScanning || !selectedWarehouseId}
            />
          </label>
        )}

        {isAdmin && (
          <button
            onClick={onAddProduct}
            disabled={!selectedWarehouseId}
            className={clsx(
              'inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800',
              !selectedWarehouseId && 'cursor-not-allowed opacity-50',
            )}
          >
            <Plus size={16} />
            <span>Добавить товар</span>
          </button>
        )}
      </div>
    </div>
  );
}
