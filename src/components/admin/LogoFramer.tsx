"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Minus, Move, Plus, RotateCcw } from "lucide-react";

/** Zoom multiplier over "fit inside frame"; x/y are offsets as a fraction of the frame size. */
export type Framing = { zoom: number; x: number; y: number };
export const DEFAULT_FRAMING: Framing = { zoom: 1, x: 0, y: 0 };

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const isDefaultFraming = (f: Framing) => f.zoom === 1 && f.x === 0 && f.y === 0;

/** Image rect (in px) for a square frame of `frame` px — shared by the preview and the export. */
function layout(natW: number, natH: number, frame: number, f: Framing) {
  const base = Math.min(frame / natW, frame / natH);
  const w = natW * base * f.zoom;
  const h = natH * base * f.zoom;
  return { w, h, left: frame / 2 + f.x * frame - w / 2, top: frame / 2 + f.y * frame - h / 2 };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

/** Renders the framed logo to a square image file, exactly as shown in the preview. */
export async function renderFramedLogo(src: string, f: Framing, original: File, size = 600): Promise<File> {
  const img = await loadImage(src);
  const natW = img.naturalWidth || size;
  const natH = img.naturalHeight || size;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  const jpeg = original.type === "image/jpeg";
  if (jpeg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
  }
  const r = layout(natW, natH, size, f);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, r.left, r.top, r.w, r.h);
  const type = jpeg ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (!blob) throw new Error("Could not prepare the framed logo");
  const name = original.name.replace(/\.[^.]+$/, "") + (jpeg ? ".jpg" : ".png");
  return new File([blob], name, { type });
}

export function LogoFramer({
  src,
  framing,
  onChange,
}: {
  src: string;
  framing: Framing;
  onChange: Dispatch<SetStateAction<Framing>>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [frame, setFrame] = useState(0);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setFrame(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom must be a non-passive listener so the page doesn't scroll.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      onChange((f) => {
        const zoom = clampZoom(f.zoom * Math.exp(-e.deltaY * 0.0015));
        const k = zoom / f.zoom;
        // Keep the point under the cursor fixed while zooming.
        return { zoom, x: px - (px - f.x) * k, y: py - (py - f.y) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onChange]);

  const zoomBy = (factor: number) =>
    onChange((f) => {
      const zoom = clampZoom(f.zoom * factor);
      const k = zoom / f.zoom;
      return { zoom, x: f.x * k, y: f.y * k };
    });

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      onChange((f) => ({ ...f, x: f.x + dx, y: f.y + dy }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.1);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomBy(1 / 1.1);
    }
  };

  const r = nat && frame ? layout(nat.w, nat.h, frame, framing) : null;

  return (
    <div className="lg-framer">
      <div
        ref={frameRef}
        tabIndex={0}
        role="application"
        aria-label="Logo framing area. Drag or use arrow keys to move, scroll or plus/minus to zoom."
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, x: framing.x, y: framing.y };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !frame) return;
          onChange((f) => ({ ...f, x: d.x + (e.clientX - d.px) / frame, y: d.y + (e.clientY - d.py) / frame }));
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        className="lg-frame"
        data-dragging={dragging}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Logo preview"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNat({ w: img.naturalWidth || 300, h: img.naturalHeight || 300 });
          }}
          className="lg-frame-img"
          style={r ? { width: r.w, height: r.h, left: r.left, top: r.top } : { visibility: "hidden" }}
        />
        {dragging && (
          <>
            <div className="lg-guide lg-guide--v" />
            <div className="lg-guide lg-guide--h" />
          </>
        )}
      </div>

      <div className="lg-zoom">
        <button type="button" className="pl-ico" onClick={() => zoomBy(1 / 1.2)} title="Zoom out" aria-label="Zoom out">
          <Minus />
        </button>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={framing.zoom}
          onChange={(e) => {
            const zoom = Number(e.target.value);
            onChange((f) => ({ zoom, x: (f.x * zoom) / f.zoom, y: (f.y * zoom) / f.zoom }));
          }}
          className="lg-range"
          aria-label="Zoom"
        />
        <button type="button" className="pl-ico" onClick={() => zoomBy(1.2)} title="Zoom in" aria-label="Zoom in">
          <Plus />
        </button>
        <output className="lg-zoom-n">{Math.round(framing.zoom * 100)}%</output>
        <button
          type="button"
          className="sd-btn sd-btn--line lg-reset"
          disabled={isDefaultFraming(framing)}
          onClick={() => onChange(DEFAULT_FRAMING)}
          title="Reset to fit"
        >
          <RotateCcw aria-hidden="true" />Reset
        </button>
      </div>
      <p className="lg-hint">
        <Move aria-hidden="true" />Drag to move, scroll or use the slider to zoom, arrow keys nudge. The upload matches this frame.
      </p>
    </div>
  );
}
