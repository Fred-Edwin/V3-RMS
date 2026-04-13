'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';

interface ImageLightboxProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [src, onClose]);

  if (!src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={20} />
        </button>
        <a
          href={src}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={18} />
        </a>
      </div>

      {/* Image */}
      <div
        className="flex-1 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? 'Image'}
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </div>
    </div>,
    document.body,
  );
}
