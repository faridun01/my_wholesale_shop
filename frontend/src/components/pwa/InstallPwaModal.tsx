import React from 'react';
import { X, Share, PlusSquare, Smartphone, Monitor, Download, CheckCircle2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500 text-white">
              <Download size={20} />
            </div>
            <div>
              <h3 className="text-section-title">Установка приложения</h3>
              <p className="mt-0.5 text-xs text-slate-500">Работать станет ещё быстрее и удобнее</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-surface-muted hover:text-slate-700"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {canPromptNative ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                <Download size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-900">Готово к установке в 1 клик</h4>
                <p className="mx-auto max-w-sm text-xs text-slate-500">
                  Нажмите кнопку ниже, чтобы добавить приложение «Мой Склад» на главный экран или рабочий стол.
                </p>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    onNativeInstall();
                    onClose();
                  }}
                  className="btn-primary w-full text-sm"
                >
                  <Download size={18} />
                  <span>Установить приложение</span>
                </button>
              </div>
            </div>
          ) : isIOS ? (
            /* iOS Instructions */
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                <Smartphone className="shrink-0 text-amber-600" size={18} />
                <span>Инструкция для iPhone / iPad (Safari):</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 rounded-lg border border-line p-3.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-500 text-sm font-bold text-white">
                    1
                  </div>
                  <div className="pt-0.5 text-sm text-slate-700">
                    Нажмите нижнюю кнопку <span className="font-semibold text-slate-900">«Поделиться»</span> в браузере Safari:
                    <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-800">
                      <Share size={15} className="text-sky-600" />
                      Иконка внизу экрана
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-line p-3.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-500 text-sm font-bold text-white">
                    2
                  </div>
                  <div className="pt-0.5 text-sm text-slate-700">
                    Прокрутите меню вниз и выберите пункт <span className="font-semibold text-slate-900">«На экран «Домой»»</span>:
                    <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-800">
                      <PlusSquare size={15} className="text-accent-600" />
                      На экран «Домой»
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-line p-3.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-500 text-sm font-bold text-white">
                    3
                  </div>
                  <div className="pt-0.5 text-sm text-slate-700">
                    В правом верхнем углу нажмите <span className="font-semibold text-slate-900">«Добавить»</span>. Ярлык появится на рабочем столе.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* General / Desktop Instructions */
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-4 py-3 text-sm font-semibold text-slate-800">
                <Monitor className="shrink-0 text-accent-600" size={18} />
                <span>Как установить приложение на ПК или Android:</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 rounded-lg border border-line p-3.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-500 text-sm font-bold text-white">
                    1
                  </div>
                  <div className="pt-0.5 text-sm text-slate-700">
                    В адресной строке браузера (вверху справа) нажмите значок <span className="font-semibold text-slate-900">«Установить приложение»</span> или иконку плюса / компьютера.
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-line p-3.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-500 text-sm font-bold text-white">
                    2
                  </div>
                  <div className="pt-0.5 text-sm text-slate-700">
                    Или откройте меню браузера (3 точки <span className="font-bold">⋮</span>) и выберите пункт <span className="font-semibold text-slate-900">«Установить приложение...»</span> / <span className="font-semibold text-slate-900">«Добавить на главный экран»</span>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benefits list */}
          <div className="space-y-2 border-t border-line pt-4">
            <span className="text-eyebrow">Преимущества приложения</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="shrink-0 text-accent-500" />
                <span>Быстрый запуск с иконки</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="shrink-0 text-accent-500" />
                <span>Окно без лишних вкладок</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="shrink-0 text-accent-500" />
                <span>Быстрый сканер и касса</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="shrink-0 text-accent-500" />
                <span>Работает на ПК и телефоне</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-line bg-surface-muted px-5 py-4">
          <button onClick={onClose} className="btn-secondary text-sm">
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
