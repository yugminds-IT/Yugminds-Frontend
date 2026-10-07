"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Minus, Move, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-3">
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
        className={`relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-lg border bg-white touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          backgroundImage:
            "linear-gradient(45deg,#f3f4f6 25%,transparent 25%),linear-gradient(-45deg,#f3f4f6 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f3f4f6 75%),linear-gradient(-45deg,transparent 75%,#f3f4f6 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
        }}
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
          className="pointer-events-none absolute max-w-none"
          style={r ? { width: r.w, height: r.h, left: r.left, top: r.top } : { visibility: "hidden" }}
        />
        {dragging && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-blue-400/60" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-blue-400/60" />
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
          <Minus className="h-4 w-4" />
        </Button>
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
          className="flex-1 accent-blue-600"
          aria-label="Zoom"
        />
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => zoomBy(1.2)} title="Zoom in">
          <Plus className="h-4 w-4" />
        </Button>
        <span className="w-12 text-right text-xs tabular-nums text-gray-600">{Math.round(framing.zoom * 100)}%</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0"
          disabled={isDefaultFraming(framing)}
          onClick={() => onChange(DEFAULT_FRAMING)}
          title="Reset to fit"
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        <Move className="h-3.5 w-3.5" /> Drag to move · scroll or use the slider to zoom · arrow keys nudge. The upload matches this frame.
      </p>
    </div>
  );
}
