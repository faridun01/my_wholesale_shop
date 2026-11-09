import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const ANCHOR_GAP = 6;
const VIEWPORT_MARGIN = 8;

type FloatingMenuProps = {
  anchorRef: RefObject<HTMLElement>;
  onClose: () => void;
  children: ReactNode;
};

// Drawn over the whole page, so a table's overflow-hidden cannot cut the menu off.
export default function FloatingMenu({ anchorRef, onClose, children }: FloatingMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const spaceBelow = window.innerHeight - anchor.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
    const spaceAbove = anchor.top - ANCHOR_GAP - VIEWPORT_MARGIN;
    const openUpward = menu.scrollHeight > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = openUpward ? spaceAbove : spaceBelow;

    setPosition({
      top: openUpward ? anchor.top - ANCHOR_GAP - Math.min(menu.scrollHeight, maxHeight) : anchor.bottom + ANCHOR_GAP,
      left: Math.max(VIEWPORT_MARGIN, anchor.right - menu.offsetWidth),
      maxHeight,
    });
  }, [anchorRef]);

  useEffect(() => {
    const isInside = (target: EventTarget | null) =>
      target instanceof Node && Boolean(menuRef.current?.contains(target) || anchorRef.current?.contains(target));
    const handleMouseDown = (event: MouseEvent) => {
      if (!isInside(event.target)) onClose();
    };
    // The menu is pinned to the screen, so it would drift away from its row.
    const handleScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      style={position ?? { top: 0, left: 0, visibility: 'hidden' }}
      className="fixed z-50 w-56 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 text-left shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
    >
      {children}
    </div>,
    document.body,
  );
}
