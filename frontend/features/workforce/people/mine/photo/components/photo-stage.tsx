'use client';

import * as React from 'react';

import { MAX_ZOOM, clampDrag, scaleFor, type PhotoSize } from '../../lib/photo-crop';

/** The circle the person crops to: 280 px, as in frame 8.5. Saving cuts exactly what this circle shows. */
export const CIRCLE = 280;

interface Source {
  url: string;
  size: PhotoSize;
}

/**
 * The adjust stage of frame 8.5: a dark 358 px band with the photo in a circle ringed in white, the outside dimmed. Drag moves the
 * photo (it can never leave an empty gap). The slider below is Paper's: a 3 px track in amber, a brown thumb with a white edge; the real
 * range input sits on top of it, so touch, mouse and keyboard all work and a screen reader hears "Zoom".
 */
export function PhotoStage({ source, zoom, drag, onDrag, onZoom }: { source: Source; zoom: number; drag: { x: number; y: number }; onDrag: (next: { x: number; y: number }) => void; onZoom: (zoom: number) => void }) {
  const pointer = React.useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);
  const scale = scaleFor(source.size, CIRCLE, zoom);
  const at = clampDrag(source.size, CIRCLE, zoom, drag);
  const pct = ((zoom - 1) / (MAX_ZOOM - 1)) * 100;
  return (
    <>
      <div className="flex h-[358px] shrink-0 items-center justify-center overflow-hidden bg-[#2A1D12]">
        <div
          role="img"
          aria-label="Your photo in a circle. Drag to move it."
          className="relative shrink-0 touch-none overflow-hidden rounded-full shadow-[0_0_0_2px_#FFFFFF,0_0_0_400px_#1715128C]"
          style={{ width: CIRCLE, height: CIRCLE }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pointer.current = { x: e.clientX, y: e.clientY, from: at };
          }}
          onPointerMove={(e) => {
            const p = pointer.current;
            if (p) onDrag(clampDrag(source.size, CIRCLE, zoom, { x: p.from.x + e.clientX - p.x, y: p.from.y + e.clientY - p.y }));
          }}
          onPointerUp={() => {
            pointer.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a file the person just chose */}
          <img
            src={source.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ width: source.size.width * scale, height: source.size.height * scale, left: CIRCLE / 2 - (source.size.width * scale) / 2 + at.x, top: CIRCLE / 2 - (source.size.height * scale) / 2 + at.y }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between">
          <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">Zoom</span>
          <span className="font-wds-mono text-[11px] leading-4 tracking-[0.06em] text-wds-text-secondary">{zoom.toFixed(1)}×</span>
        </div>
        <div className="relative flex h-5 items-center">
          <div aria-hidden className="h-[3px] w-full bg-[#E4E2DE]">
            <div className="h-[3px] bg-[#B5823E]" style={{ width: `${pct}%` }} />
          </div>
          <div aria-hidden className="absolute h-5 w-5 rounded-full border-[3px] border-white bg-wds-primary shadow-[0_0_0_1px_#B5823E]" style={{ left: `calc(${pct}% - ${(pct / 100) * 20}px)` }} />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            aria-label="Zoom"
            onChange={(e) => onZoom(Number(e.target.value))}
            className="absolute left-0 top-1/2 h-11 w-full -translate-y-1/2 cursor-pointer opacity-0"
          />
        </div>
      </div>
    </>
  );
}
