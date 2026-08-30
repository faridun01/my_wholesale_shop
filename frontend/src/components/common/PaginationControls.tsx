import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
};

const buildPageNumbers = (currentPage: number, totalPages: number) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
};

export default function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  const handlePageChange = (page: number) => {
    const nextPage = Math.min(Math.max(1, page), totalPages);
    if (nextPage === currentPage) {
      return;
    }

    onPageChange(nextPage);
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <div
      className={`flex flex-col gap-3 border-t border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${className}`.trim()}
    >
      <p className="text-xs text-slate-500 sm:text-sm">
        Показано {startItem}-{endItem} из {totalItems}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Назад</span>
        </button>

        {pageNumbers.map((pageNumber, index) => {
          const previousPage = pageNumbers[index - 1];
          const showGap = previousPage && pageNumber - previousPage > 1;

          return (
            <div key={`${pageNumber}-${index}`} className="flex items-center gap-1.5">
              {showGap ? <span className="text-sm text-slate-300">…</span> : null}
              <button
                type="button"
                onClick={() => handlePageChange(pageNumber)}
                className={
                  currentPage === pageNumber
                    ? 'flex h-9 min-w-9 items-center justify-center rounded-lg bg-accent-500 px-3 text-sm font-semibold text-white'
                    : 'flex h-9 min-w-9 items-center justify-center rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-surface-muted'
                }
              >
                {pageNumber}
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="hidden sm:inline">Дальше</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
