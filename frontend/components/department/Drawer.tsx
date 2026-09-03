'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Sticky footer content (action row). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Right-anchored drawer. Used by the Branch Manager's Departments screen for
 * the Assign / Change head flows (Paper: 460px panel, dim backdrop, sticky
 * footer). No matching component existed in components/ui, so this is local to
 * the feature.
 */
export function Drawer({ isOpen, onClose, title, subtitle, footer, children, className }: DrawerProps): JSX.Element | null {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[rgba(43,27,18,0.34)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'flex h-full w-full max-w-[460px] flex-col bg-white shadow-[-8px_0_32px_rgba(43,27,18,0.16)] animate-slide-in-right motion-reduce:animate-none',
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-stone-100 px-8 pb-6 pt-[22px]">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading-sm font-bold text-stone-900">{title}</h2>
            {subtitle && <p className="text-body-sm font-medium text-espresso">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors duration-fast hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-stone-100 bg-white px-8 pb-[22px] pt-6">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
