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
      className={`flex flex-col items-center justify-center gap-2 border-t border-slate-100 py-3 sm:py-3.5 px-4 w-full ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex h-8 sm:h-9 items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-slate-600 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={15} />
          <span className="hidden sm:inline">Назад</span>
        </button>

        {pageNumbers.map((pageNumber, index) => {
          const previousPage = pageNumbers[index - 1];
          const showGap = previousPage && pageNumber - previousPage > 1;

          return (
            <div key={`${pageNumber}-${index}`} className="flex items-center gap-1 sm:gap-1.5">
              {showGap ? <span className="px-1 text-xs sm:text-sm font-bold text-slate-300 select-none">…</span> : null}
              <button
                type="button"
                onClick={() => handlePageChange(pageNumber)}
                className={
                  currentPage === pageNumber
                    ? 'flex h-8 min-w-8 sm:h-9 sm:min-w-9 items-center justify-center rounded-xl bg-slate-900 px-2.5 sm:px-3 text-xs sm:text-sm font-bold text-white shadow-xs transition-all'
                    : 'flex h-8 min-w-8 sm:h-9 sm:min-w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-slate-600 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95'
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
          className="inline-flex h-8 sm:h-9 items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-slate-600 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="hidden sm:inline">Дальше</span>
          <ChevronRight size={15} />
        </button>
      </div>

      <p className="text-[11px] sm:text-xs text-slate-400 font-medium text-center">
        Показано <span className="font-semibold text-slate-600">{startItem}–{endItem}</span> из <span className="font-semibold text-slate-600">{totalItems}</span>
      </p>
    </div>
  );
}
