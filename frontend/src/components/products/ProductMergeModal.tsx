import { GitMerge, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { formatProductName } from '../../utils/productName';

interface ProductMergeModalProps {
  isOpen: boolean;
  selectedProduct: any;
  mergeCandidates: any[];
  mergeTargetId: string;
  onClose: () => void;
  onMerge: () => void;
  onMergeTargetChange: (value: string) => void;
}

export default function ProductMergeModal({
  isOpen,
  selectedProduct,
  mergeCandidates,
  mergeTargetId,
  onClose,
  onMerge,
  onMergeTargetChange,
}: ProductMergeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && selectedProduct && (
        <motion.div
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
        >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-t-4xl bg-white shadow-2xl sm:rounded-4xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-fuchsia-50/50 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-fuchsia-600 p-3 text-white">
              <GitMerge size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Объединить дубликаты</h3>
              <p className="text-sm text-slate-500">Выберите основной товар, в который нужно перенести остатки и историю.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Объединяемый товар</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{formatProductName(selectedProduct.name)}</p>
            <p className="mt-1 text-sm text-slate-500">
              Остаток: {selectedProduct.stock} {selectedProduct.unit}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Основной товар</label>
            <select
              value={mergeTargetId}
              onChange={(event) => onMergeTargetChange(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-fuchsia-300 focus:bg-white"
            >
              {mergeCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {formatProductName(candidate.name)} - {candidate.stock} {candidate.unit}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm text-slate-500">
            Партии, остатки, история движения, цены и позиции продаж будут перенесены в выбранный основной товар.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onMerge}
            className="rounded-2xl bg-fuchsia-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-fuchsia-700"
          >
            Объединить
          </button>
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
