import ProductsCatalogToolbar from './ProductsCatalogToolbar';
import ProductsDesktopTable from './ProductsDesktopTable';
import ProductsMobileList from './ProductsMobileList';
import ProductsPaginationSections from './ProductsPaginationSections';

interface ProductsCatalogSectionProps {
  search: string;
  warehouses: any[];
  isAdmin: boolean;
  isLoading: boolean;
  isAggregateMode: boolean;
  selectedWarehouseId: string;
  filteredProductsCount: number;
  duplicateProductsCount: number;
  isMergingDuplicates: boolean;
  canTransferProducts: boolean;
  products: any[];
  totalItems: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  expandedMobileActionsId: number | null;
  sortConfig: { key: string; direction: 'asc' | 'desc' | null };
  getDuplicateHintCount: (product: any) => number;
  onSearchChange: (value: string) => void;
  onWarehouseChange: (value: string) => void;
  onExportStockReport: () => void;
  onExportPriceList: () => void;
  onMergeExactDuplicates: () => void;
  onToggleMobileActions: (productId: number) => void;
  onOpenMergeModal: (product: any) => void;
  onMobileEditProduct: (product: any) => void;
  onMobileRestockProduct: (product: any) => void;
  onMobileShowHistory: (product: any) => void;
  onMobileOpenWriteOffModal: (product: any) => void;
  onMobileShowBatches: (product: any) => void;
  onMobileTransferProduct: (product: any) => void;
  onMobileDeleteProduct: (product: any) => void;
  onSort: (key: string) => void;
  onEditProduct: (product: any) => void;
  onRestockProduct: (product: any) => void;
  onShowBatches: (product: any) => void;
  onShowHistory: (product: any) => void;
  onOpenWriteOffModal: (product: any) => void;
  onTransferProduct: (product: any) => void;
  onDeleteProduct: (product: any) => void;
  onAddProduct: () => void;
  onPageChange: (page: number) => void;
}

export default function ProductsCatalogSection({
  search,
  warehouses,
  isAdmin,
  isLoading,
  isAggregateMode,
  selectedWarehouseId,
  filteredProductsCount,
  duplicateProductsCount,
  isMergingDuplicates,
  canTransferProducts,
  products,
  totalItems,
  currentPage,
  pageSize,
  totalPages,
  expandedMobileActionsId,
  sortConfig,
  getDuplicateHintCount,
  onSearchChange,
  onWarehouseChange,
  onExportStockReport,
  onExportPriceList,
  onMergeExactDuplicates,
  onToggleMobileActions,
  onOpenMergeModal,
  onMobileEditProduct,
  onMobileRestockProduct,
  onMobileShowHistory,
  onMobileOpenWriteOffModal,
  onMobileShowBatches,
  onMobileTransferProduct,
  onMobileDeleteProduct,
  onSort,
  onEditProduct,
  onRestockProduct,
  onShowBatches,
  onShowHistory,
  onOpenWriteOffModal,
  onTransferProduct,
  onDeleteProduct,
  onAddProduct,
  onPageChange,
}: ProductsCatalogSectionProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-xs">
      <ProductsCatalogToolbar
        search={search}
        warehouses={warehouses}
        isAdmin={isAdmin}
        selectedWarehouseId={selectedWarehouseId}
        filteredProductsCount={filteredProductsCount}
        duplicateProductsCount={duplicateProductsCount}
        isMergingDuplicates={isMergingDuplicates}
        onSearchChange={onSearchChange}
        onWarehouseChange={onWarehouseChange}
        onExportStockReport={onExportStockReport}
        onExportPriceList={onExportPriceList}
        onMergeExactDuplicates={onMergeExactDuplicates}
      />

      <ProductsMobileList
        products={products}
        totalItems={totalItems}
        isLoading={isLoading}
        isAdmin={isAdmin}
        isAggregateMode={isAggregateMode}
        canTransferProducts={canTransferProducts}
        selectedWarehouseId={selectedWarehouseId}
        currentPage={currentPage}
        pageSize={pageSize}
        expandedMobileActionsId={expandedMobileActionsId}
        onToggleActions={onToggleMobileActions}
        getDuplicateHintCount={getDuplicateHintCount}
        onOpenMergeModal={onOpenMergeModal}
        onEditProduct={onMobileEditProduct}
        onRestockProduct={onMobileRestockProduct}
        onShowHistory={onMobileShowHistory}
        onOpenWriteOffModal={onMobileOpenWriteOffModal}
        onShowBatches={onMobileShowBatches}
        onTransferProduct={onMobileTransferProduct}
        onDeleteProduct={onMobileDeleteProduct}
      />

      <ProductsDesktopTable
        products={products}
        totalItems={totalItems}
        isLoading={isLoading}
        isAdmin={isAdmin}
        canTransferProducts={canTransferProducts}
        selectedWarehouseId={selectedWarehouseId}
        currentPage={currentPage}
        pageSize={pageSize}
        sortConfig={sortConfig}
        onSort={onSort}
        getDuplicateHintCount={getDuplicateHintCount}
        onOpenMergeModal={onOpenMergeModal}
        onEditProduct={onEditProduct}
        onRestockProduct={onRestockProduct}
        onShowBatches={onShowBatches}
        onShowHistory={onShowHistory}
        onOpenWriteOffModal={onOpenWriteOffModal}
        onTransferProduct={onTransferProduct}
        onDeleteProduct={onDeleteProduct}
        onAddProduct={onAddProduct}
      />

      <ProductsPaginationSections
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </div>
  );
}
