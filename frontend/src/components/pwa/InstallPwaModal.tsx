import React from 'react';
import { X, Share, PlusSquare, Smartphone, Monitor, Download, CheckCircle2, ArrowRight } from 'lucide-react';

interface InstallPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  canPromptNative: boolean;
  onNativeInstall: () => void;
}

export default function InstallPwaModal({
  isOpen,
  onClose,
  isIOS,
  canPromptNative,
  onNativeInstall,
}: InstallPwaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header background decoration */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-white/30 transition-colors"
            title="Закрыть"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/30">
              <Download size={26} />
            </div>
            <div>
              <h3 className="text-xl font-bold leading-tight">Установка приложения</h3>
              <p className="text-xs text-emerald-100 mt-0.5 font-medium">
                Работать станет еще быстрее и удобнее
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {canPromptNative ? (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                <Download size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-semibold text-slate-900">Готово к установке в 1 клик!</h4>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Нажмите кнопку ниже, чтобы добавить приложение «Мой Склад» на главный экран или рабочий стол.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    onNativeInstall();
                    onClose();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all"
                >
                  <Download size={20} />
                  <span>Установить приложение прямо сейчас</span>
                </button>
              </div>
            </div>
          ) : isIOS ? (
            /* iOS Instructions */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 bg-amber-50 text-amber-900 border border-amber-200/80 px-4 py-3 rounded-2xl">
                <Smartphone className="shrink-0 text-amber-600" size={20} />
                <span>Инструкция для iPhone / iPad (Safari):</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/80">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm">
                    1
                  </div>
                  <div className="text-sm text-slate-700 pt-1">
                    Нажмите нижнюю кнопку <span className="font-semibold text-slate-900">«Поделиться»</span> в браузере Safari:
                    <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 border border-slate-200 shadow-sm text-slate-800 font-medium text-xs">
                      <Share size={16} className="text-sky-600" />
                      Иконка внизу экрана
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/80">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm">
                    2
                  </div>
                  <div className="text-sm text-slate-700 pt-1">
                    Прокрутите меню вниз и выберите пункт <span className="font-semibold text-slate-900">«На экран «Домой»»</span>:
                    <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 border border-slate-200 shadow-sm text-slate-800 font-medium text-xs">
                      <PlusSquare size={16} className="text-emerald-600" />
                      На экран «Домой»
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/80">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm">
                    3
                  </div>
                  <div className="text-sm text-slate-700 pt-1">
                    В правом верхнем углу нажмите <span className="font-semibold text-slate-900">«Добавить»</span>. Ярлык появится на рабочем столе!
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* General / Desktop Instructions */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 bg-slate-100 px-4 py-3 rounded-2xl">
                <Monitor className="shrink-0 text-emerald-600" size={20} />
                <span>Как установить приложение на ПК или Android:</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/80">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm">
                    1
                  </div>
                  <div className="text-sm text-slate-700 pt-1">
                    В адресной строке браузера (вверху справа) нажмите значок <span className="font-semibold text-slate-900">«Установить приложение»</span> или иконку плюса / компьютера.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/80">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm">
                    2
                  </div>
                  <div className="text-sm text-slate-700 pt-1">
                    Или откройте меню браузера (3 точки <span className="font-bold">⋮</span>) и выберите пункт <span className="font-semibold text-slate-900">«Установить приложение...»</span> / <span className="font-semibold text-slate-900">«Добавить на главный экран»</span>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benefits list */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Преимущества приложения:</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                <span>Быстрый запуск с иконки</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                <span>Окно без лишних вкладок</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                <span>Быстрый сканер и касса</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                <span>Работает на ПК и телефоне</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-200 hover:bg-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors"
          >
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
