import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface ViewBox { x: number; y: number; w: number; h: number }

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 12;

/**
 * SVG için yakınlaştırma ve kaydırma.
 * Tekerlek: imlecin olduğu yere yakınlaştırır. Orta tuş ya da Boşluk + sol tuş ile sürükleme: kaydırır.
 * Kullanıcı hiç yakınlaştırmadıysa görünüm, çizimin sığdığı temel görünümü (base) izler.
 */
export function useZoomPan(base: ViewBox, svgRef: RefObject<SVGSVGElement | null>) {
  const [view, setView] = useState<ViewBox | null>(null);
  const vb = view ?? base;
  const vbRef = useRef(vb);
  const baseRef = useRef(base);
  // Olay işleyicileri en güncel görünümü okusun
  useLayoutEffect(() => { vbRef.current = vb; baseRef.current = base; });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const pan = useRef<{ id: number; cx: number; cy: number; start: ViewBox } | null>(null);
  const [panning, setPanning] = useState(false);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    const cur = vbRef.current;
    const b = baseRef.current;
    const w = Math.min(b.w / MIN_ZOOM, Math.max(b.w / MAX_ZOOM, cur.w * factor));
    const k = w / cur.w;
    setView({ x: px - (px - cur.x) * k, y: py - (py - cur.y) * k, w, h: cur.h * k });
  }, []);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : null;
  }, [svgRef]);

  // Tekerlek: tarayıcının sayfa kaydırmasını engellemek için pasif olmayan dinleyici
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      if (!p) return;
      zoomAt(p.x, p.y, Math.exp(e.deltaY * 0.0015));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svgRef, toSvg, zoomAt]);

  // Boşluk tuşu basılıyken sürükleme kaydırır (yazı alanlarında değil)
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !typing(e.target)) { setSpaceHeld(true); if (e.target === document.body || e.target === svgRef.current) e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [svgRef]);

  const svgProps = {
    viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`,
    style: { cursor: panning ? 'grabbing' : spaceHeld ? 'grab' : undefined } as React.CSSProperties,
    onPointerDownCapture: (e: React.PointerEvent) => {
      if (e.button !== 1 && !(e.button === 0 && spaceHeld)) return;
      e.preventDefault();
      e.stopPropagation();
      try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* yakalanamayan işaretçi */ }
      pan.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, start: vbRef.current };
      setPanning(true);
    },
    onPointerMoveCapture: (e: React.PointerEvent) => {
      const p = pan.current;
      if (!p || p.id !== e.pointerId) return;
      e.stopPropagation();
      const ctm = svgRef.current?.getScreenCTM();
      if (!ctm) return;
      setView({ ...p.start, x: p.start.x - (e.clientX - p.cx) / ctm.a, y: p.start.y - (e.clientY - p.cy) / ctm.d });
    },
    onPointerUpCapture: (e: React.PointerEvent) => {
      if (!pan.current || pan.current.id !== e.pointerId) return;
      e.stopPropagation();
      pan.current = null;
      setPanning(false);
    },
  };

  const zoomBy = (factor: number) => {
    const cur = vbRef.current;
    zoomAt(cur.x + cur.w / 2, cur.y + cur.h / 2, factor);
  };

  return {
    svgProps,
    zoom: Math.round((base.w / vb.w) * 100),
    zoomIn: () => zoomBy(1 / 1.25),
    zoomOut: () => zoomBy(1.25),
    fit: () => setView(null),
  };
}
