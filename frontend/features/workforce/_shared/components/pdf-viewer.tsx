'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED } from '../lib/interaction';
import { DOUBLE_TAP_MS, MAX_ZOOM, MIN_ZOOM, clampZoom, distance, pageInView, pinchedZoom } from '../lib/pinch-zoom';
import { ErrorBlock } from './states';

/**
 * The Document view on a phone (Paper 3AMB-0): the stored PDF drawn page by page on the warm grey ground, fitted to the width, pinch to
 * zoom, double tap to fit. Zoom also has buttons (keyboard and screen readers). The file is drawn from its bytes; it is never rebuilt,
 * and nothing is kept after the viewer closes. `name` is the spoken name of the page and must carry no amount.
 */
type PdfModule = typeof import('pdfjs-dist');
interface Drawn {
  pages: number;
  ratio: number;
}

async function loadPdfjs(): Promise<PdfModule> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  return pdfjs;
}

export function PdfViewer({ load, name, hint = 'Pinch to zoom · double tap to fit', retry, footer }: { load: () => Promise<Blob>; name: string; hint?: string; retry?: () => void; footer?: React.ReactNode }) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const canvases = React.useRef<HTMLCanvasElement[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [drawn, setDrawn] = React.useState<Drawn>({ pages: 0, ratio: 1.414 });
  const [width, setWidth] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [attempt, setAttempt] = React.useState(0);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const zoomRef = React.useRef(zoom);
  zoomRef.current = zoom;

  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth - 24));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const [pdfjs, blob] = await Promise.all([loadPdfjs(), loadRef.current()]);
        const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
        if (cancelled) return;
        const first = await doc.getPage(1);
        const base = first.getViewport({ scale: 1 });
        setDrawn({ pages: doc.numPages, ratio: base.height / base.width });
        setStatus('ready');
        // Wait one frame so the canvases exist, then draw each at about 2.5 times the fitted width: sharp when zoomed, one render only.
        await new Promise((r) => requestAnimationFrame(r));
        for (let n = 1; n <= doc.numPages && !cancelled; n += 1) {
          const p = await doc.getPage(n);
          const canvas = canvases.current[n - 1];
          if (!canvas) continue;
          const viewport = p.getViewport({ scale: Math.min(3, 1100 / p.getViewport({ scale: 1 }).width) });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await p.render({ canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D, viewport }).promise;
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Pinch with two fingers; a quick second tap resets to fitted. `touch-action: pan-x pan-y` keeps the browser from zooming the whole page.
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let start: { d: number; z: number } | null = null;
    let lastTap = 0;
    const down = (e: TouchEvent) => {
      if (e.touches.length === 2) start = { d: distance(e.touches[0]!, e.touches[1]!), z: zoomRef.current };
      else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < DOUBLE_TAP_MS) setZoom(1);
        lastTap = now;
      }
    };
    const move = (e: TouchEvent) => {
      if (start && e.touches.length === 2) {
        e.preventDefault();
        setZoom(pinchedZoom(start.z, start.d, distance(e.touches[0]!, e.touches[1]!)));
      }
    };
    const up = () => {
      start = null;
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
    };
  }, []);

  const fitted = Math.max(0, width);
  const pageHeight = fitted * zoom * drawn.ratio + 12;
  const onScroll = () => {
    const el = scroller.current;
    if (el) setPage(pageInView(el.scrollTop, el.clientHeight, pageHeight, drawn.pages));
  };

  if (status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center bg-wds-neutral-100 p-4">
        <ErrorBlock title="The document did not open" line="Nothing was changed. Check your signal and try again." onRetry={() => (retry ? retry() : setAttempt((n) => n + 1))} />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#47433D]">
      <div className="flex items-center justify-between px-4 py-2 font-wds-mono text-[11px] leading-[14px] text-wds-neutral-300">
        <span>{status === 'ready' ? `${page} / ${drawn.pages}` : ''}</span>
        <span className="flex items-center gap-1">
          {([['Zoom out', '−', () => setZoom(clampZoom(zoom - 0.5))], ['Fit to width', 'Fit', () => setZoom(1)], ['Zoom in', '+', () => setZoom(clampZoom(zoom + 0.5))]] as const).map(([label, mark, act]) => (
            <button key={label} type="button" aria-label={label} onClick={act} disabled={(label === 'Zoom out' && zoom <= MIN_ZOOM) || (label === 'Zoom in' && zoom >= MAX_ZOOM)} className={cn('min-h-[44px] min-w-[44px] text-[13px] text-wds-neutral-300 disabled:opacity-40', MOTION, FOCUS_RING, PRESSED)}>
              {mark}
            </button>
          ))}
        </span>
      </div>
      <div ref={scroller} onScroll={onScroll} tabIndex={0} aria-label={name} className={cn('min-h-0 flex-1 overflow-auto px-3 pb-3 [touch-action:pan-x_pan-y]', FOCUS_RING)}>
        {status === 'loading' ? (
          <div role="status" aria-busy="true" aria-label="Opening the document" className="mx-auto animate-pulse bg-wds-neutral-300" style={{ width: fitted || 340, height: (fitted || 340) * 1.414 }}>
            <span className="sr-only">Opening the document</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3" style={{ width: fitted * zoom }}>
            {Array.from({ length: drawn.pages }, (_, i) => (
              <canvas key={i} ref={(c) => { if (c) canvases.current[i] = c; }} role="img" aria-label={`${name}, page ${i + 1} of ${drawn.pages}`} className="block h-auto w-full bg-white" />
            ))}
          </div>
        )}
      </div>
      <p className="m-0 px-4 pb-2 pt-1 text-center font-wds-sans text-[13px] leading-4 text-wds-neutral-300">{hint}</p>
      {footer ? <div className="flex flex-col gap-2.5 bg-wds-surface p-3.5 min-[400px]:flex-row">{footer}</div> : null}
    </div>
  );
}
