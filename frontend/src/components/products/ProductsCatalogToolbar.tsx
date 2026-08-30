import { Filter, Search } from 'lucide-react';

interface WarehouseOption {
  id: string | number;
  name: string;
}

interface ProductsCatalogToolbarProps {
  search: string;
  warehouses: WarehouseOption[];
  isAdmin: boolean;
  selectedWarehouseId: string;
  filteredProductsCount: number;
  duplicateProductsCount: number;
  isMergingDuplicates: boolean;
  onSearchChange: (value: string) => void;
  onWarehouseChange: (value: string) => void;
  onExportStockReport?: () => void;
  onExportPriceList?: () => void;
  onMergeExactDuplicates: () => void;
}

export default function ProductsCatalogToolbar({
  search,
  warehouses,
  isAdmin,
  selectedWarehouseId,
  filteredProductsCount,
  duplicateProductsCount,
  isMergingDuplicates,
  onSearchChange,
  onWarehouseChange,
  onMergeExactDuplicates,
}: ProductsCatalogToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:max-w-4xl lg:flex-1">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Поиск по названию или штрихкоду..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] py-2.5 pl-11 pr-4 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
          />
        </div>

        {warehouses.length > 1 && (
          <div className="relative w-full sm:w-60">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <select
              value={selectedWarehouseId}
              onChange={(event) => onWarehouseChange(event.target.value)}
              disabled={!isAdmin}
              className="w-full appearance-none rounded-2xl border border-slate-200/70 bg-[#f4f5fb] py-2.5 pl-11 pr-4 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
            >
              <option value="">Все склады</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
          Товаров: {filteredProductsCount}
        </div>
        {duplicateProductsCount > 0 ? (
          <>
            <div className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
              Дублей: {duplicateProductsCount}
            </div>
            <button
              type="button"
              onClick={onMergeExactDuplicates}
              disabled={isMergingDuplicates}
              className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isMergingDuplicates ? 'Объединение...' : 'Объединить дубликаты'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
