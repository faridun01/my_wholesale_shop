import React from 'react';
import { FileText, Plus, Tag } from 'lucide-react';
import { Button, PageHeader } from '../UI';

interface ProductsPageHeaderProps {
  isAdmin: boolean;
  selectedWarehouseId: string;
  filteredProductsCount: number;
  onAddProduct: () => void;
  onExportStockReport: () => void;
  onExportPriceList: () => void;
}

export default function ProductsPageHeader({
  isAdmin,
  selectedWarehouseId,
  filteredProductsCount,
  onAddProduct,
  onExportStockReport,
  onExportPriceList,
}: ProductsPageHeaderProps) {
  return (
    <PageHeader
      title="Товары"
      description="Управление ассортиментом, ценами и остатками."
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileText size={15} />}
            onClick={onExportStockReport}
            disabled={!filteredProductsCount}
          >
            Скачать остаток
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Tag size={15} />}
            onClick={onExportPriceList}
            disabled={!filteredProductsCount}
          >
            Скачать прайс
          </Button>

          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={16} />}
              onClick={onAddProduct}
              disabled={!selectedWarehouseId}
            >
              Добавить товар
            </Button>
          )}
        </>
      }
    />
  );
}
