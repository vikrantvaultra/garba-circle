"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Sheet } from "./Sheet";
import { FILTERS, ORIGINAL, applyLook, cssFilter, type Look } from "@/lib/client/photo-look";
import styles from "./photo-editor.module.css";

/** Photos are edited at up to this size: plenty for a 512px avatar, quick to redraw. */
const WORK_PX = 1600;
const OUT_PX = 512;
const QUALITY = 0.82;
const MAX_ZOOM = 4;

type Source = { canvas: HTMLCanvasElement; w: number; h: number; url: string };

type View = {
  /** 1 = the smallest size that still fills the frame. */
  zoom: number;
  /** Offset of the photo's centre from the frame's, in frame pixels. */
  x: number;
  y: number;
  /** Quarter turns, 0 to 3. */
  turns: number;
  flip: boolean;
  /** Fine rotation in degrees, -20 to 20. */
  straighten: number;
};

const START: View = { zoom: 1, x: 0, y: 0, turns: 0, flip: false, straighten: 0 };

/** Reads the photo the right way up (EXIF) and scales it down for editing. */
async function load(file: File): Promise<Source> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, WORK_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { canvas, w: canvas.width, h: canvas.height, url: URL.createObjectURL(file) };
}

const angleOf = (v: View) => ((v.turns * 90 + v.straighten) * Math.PI) / 180;

/** The scale at which the photo, turned by `angle`, just covers a square frame of side `side`. */
function coverScale(src: Source, side: number, angle: number): number {
  return (side * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)))) / Math.min(src.w, src.h);
}

/** Keeps the frame covered: the photo can't be dragged or zoomed out past its edges. */
function clampView(v: View, src: Source, side: number): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
  const angle = angleOf(v);
  const scale = coverScale(src, side, angle) * zoom;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // The frame's half-size, seen from the photo's own (turned) axes.
  const reach = (side / 2) * (Math.abs(cos) + Math.abs(sin));
  const maxX = Math.max(0, (src.w * scale) / 2 - reach);
  const maxY = Math.max(0, (src.h * scale) / 2 - reach);
  // Into the photo's axes, clamp, and back.
  const lx = Math.min(maxX, Math.max(-maxX, v.x * cos + v.y * sin));
  const ly = Math.min(maxY, Math.max(-maxY, -v.x * sin + v.y * cos));
  return { ...v, zoom, x: lx * cos - ly * sin, y: lx * sin + ly * cos };
}

/** Draws the photo into a square of side `side` as the view places it. */
function draw(ctx: CanvasRenderingContext2D, src: Source, v: View, side: number, frame: number) {
  const angle = angleOf(v);
  const scale = coverScale(src, side, angle) * v.zoom;
  const k = side / frame;
  ctx.clearRect(0, 0, side, side);
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.translate(side / 2 + v.x * k, side / 2 + v.y * k);
  ctx.rotate(angle);
  ctx.scale(v.flip ? -scale : scale, scale);
  ctx.drawImage(src.canvas, -src.w / 2, -src.h / 2);
  ctx.restore();
}

type Tab = "crop" | "adjust" | "filters";

/**
 * Crop, straighten, turn, flip, adjust and filter a profile photo before it
 * is uploaded. The frame is round, like the avatar it becomes. Returns a
 * 512px square WebP (JPEG on browsers without WebP) as a data URL.
 */
export function PhotoEditor({
  file,
  onCancel,
  onChooseAnother,
  onDone,
}: {
  /** The photo to edit; the sheet is open while there is one. */
  file: File | null;
  onCancel: () => void;
  onChooseAnother: () => void;
  onDone: (dataUrl: string) => void | Promise<void>;
}) {
  const [src, setSrc] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>(START);
  const [look, setLook] = useState<Look>(ORIGINAL);
  const [tab, setTab] = useState<Tab>("crop");
  const [side, setSide] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // A new photo starts again from the whole photo, unedited. Adjusted while
  // rendering (React's pattern for state that follows a prop), not in an
  // effect, so the old photo never flashes.
  const [shownFile, setShownFile] = useState<File | null>(null);
  if (file !== shownFile) {
    setShownFile(file);
    if (file) {
      setSrc(null);
      setFailed(false);
      setView(START);
      setLook(ORIGINAL);
      setTab("crop");
    }
  }

  // Read the photo.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let loaded: Source | null = null;
    load(file)
      .then((s) => {
        loaded = s;
        if (cancelled) URL.revokeObjectURL(s.url);
        else setSrc(s);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (loaded) URL.revokeObjectURL(loaded.url);
    };
  }, [file]);

  // The frame's size on screen.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setSide(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [file]);

  // Redraw the preview whenever the photo, the view or the frame changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src || !side) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(side * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    draw(ctx, src, view, px, side);
  }, [src, view, side]);

  const update = (next: (v: View) => View) => {
    if (!src || !side) return;
    setView((v) => clampView(next(v), src, side));
  };

  // ---- Gestures: one finger drags, two pinch; a wheel or trackpad zooms. ----
  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const others = [...map.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (others.length === 0) {
      update((v) => ({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }));
    } else {
      const other = others[0];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0) {
        update((v) => ({
          ...v,
          zoom: v.zoom * (after / before),
          x: v.x + (e.clientX - prev.x) / 2,
          y: v.y + (e.clientY - prev.y) / 2,
        }));
      }
    }
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  // A wheel over the frame zooms instead of scrolling the sheet. React's
  // onWheel is passive, so it can't stop the scroll: listen directly.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      update((v) => ({ ...v, zoom: v.zoom * Math.exp(-e.deltaY * 0.0015) }));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 30 : 8;
    const moves: Record<string, (v: View) => View> = {
      ArrowLeft: (v) => ({ ...v, x: v.x - step }),
      ArrowRight: (v) => ({ ...v, x: v.x + step }),
      ArrowUp: (v) => ({ ...v, y: v.y - step }),
      ArrowDown: (v) => ({ ...v, y: v.y + step }),
      "+": (v) => ({ ...v, zoom: v.zoom * 1.1 }),
      "=": (v) => ({ ...v, zoom: v.zoom * 1.1 }),
      "-": (v) => ({ ...v, zoom: v.zoom / 1.1 }),
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      update(move);
    }
  };

  const reset = () => {
    setView(START);
    setLook(ORIGINAL);
  };

  const save = async () => {
    if (!src || !side) return;
    setSaving(true);
    try {
      const out = document.createElement("canvas");
      out.width = OUT_PX;
      out.height = OUT_PX;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Could not save that photo.");
      // Behind the photo, in case a straightened corner shows: never transparent.
      ctx.fillStyle = "#fffcf0";
      ctx.fillRect(0, 0, OUT_PX, OUT_PX);
      draw(ctx, src, view, OUT_PX, side);
      const pixels = ctx.getImageData(0, 0, OUT_PX, OUT_PX);
      applyLook(pixels.data, look);
      ctx.putImageData(pixels, 0, 0);
      const webp = out.toDataURL("image/webp", QUALITY);
      // Older Safari ignores the WebP request and hands back a PNG.
      await onDone(webp.startsWith("data:image/webp") ? webp : out.toDataURL("image/jpeg", QUALITY));
    } finally {
      setSaving(false);
    }
  };

  const filterKey = FILTERS.find((f) =>
    (Object.keys(f.look) as (keyof Look)[]).every((k) => Math.abs(f.look[k] - look[k]) < 0.001),
  )?.key;

  return (
    <Sheet open={Boolean(file)} onClose={onCancel} labelledBy="photo-editor-title" initialFocus={doneRef}>
      <div className={styles.head}>
        <h2 id="photo-editor-title" className="headline text-[24px] leading-tight">
          Edit your photo
        </h2>
        <button type="button" className={styles.reset} onClick={reset} disabled={!src}>
          Reset
        </button>
      </div>
      <p className="mt-1 text-[13.5px] text-choco-2">
        Drag to move. Pinch, scroll or use the slider to zoom.
      </p>

      <div
        ref={stageRef}
        className={styles.stage}
        data-dragging={dragging}
        tabIndex={0}
        role="img"
        aria-label="Your photo in the round frame. Arrow keys move it, plus and minus zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className={styles.canvas} style={{ filter: cssFilter(look) }} />
        <div className={styles.grid} aria-hidden />
        <div className={styles.mask} aria-hidden />
        {!src && (
          <p className={styles.status}>{failed ? "Couldn’t open that photo. Try another." : "Opening your photo…"}</p>
        )}
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Edit">
        {(
          [
            ["crop", "Crop"],
            ["adjust", "Adjust"],
            ["filters", "Filters"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`photo-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`photo-panel-${key}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.panel} role="tabpanel" id={`photo-panel-${tab}`} aria-labelledby={`photo-tab-${tab}`}>
        {tab === "crop" && (
          <>
            <Slider
              label="Zoom"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              shown={`${view.zoom.toFixed(1)}×`}
              onChange={(zoom) => update((v) => ({ ...v, zoom }))}
            />
            <Slider
              label="Straighten"
              min={-20}
              max={20}
              step={0.5}
              value={view.straighten}
              shown={`${view.straighten > 0 ? "+" : ""}${view.straighten.toFixed(1)}°`}
              onChange={(straighten) => update((v) => ({ ...v, straighten }))}
            />
            <div className={styles.tools}>
              <Tool label="Rotate left" onClick={() => update((v) => ({ ...v, turns: (v.turns + 3) % 4 }))}>
                <path d="M4 4v5h5" />
                <path d="M5 13a7 7 0 1 0 1.8-6.4L4 9" />
              </Tool>
              <Tool label="Rotate right" onClick={() => update((v) => ({ ...v, turns: (v.turns + 1) % 4 }))}>
                <path d="M20 4v5h-5" />
                <path d="M19 13a7 7 0 1 1-1.8-6.4L20 9" />
              </Tool>
              <Tool label="Flip" pressed={view.flip} onClick={() => update((v) => ({ ...v, flip: !v.flip }))}>
                <path d="M12 3v18" strokeDasharray="2 2.5" />
                <path d="M9 6 3 18h6zM15 6l6 12h-6z" />
              </Tool>
            </div>
          </>
        )}

        {tab === "adjust" && (
          <>
            <Slider
              label="Brightness"
              min={0.5}
              max={1.5}
              step={0.01}
              value={look.brightness}
              shown={pct(look.brightness)}
              onChange={(brightness) => setLook((l) => ({ ...l, brightness }))}
            />
            <Slider
              label="Contrast"
              min={0.5}
              max={1.5}
              step={0.01}
              value={look.contrast}
              shown={pct(look.contrast)}
              onChange={(contrast) => setLook((l) => ({ ...l, contrast }))}
            />
            <Slider
              label="Saturation"
              min={0}
              max={2}
              step={0.01}
              value={look.saturation}
              shown={pct(look.saturation)}
              onChange={(saturation) => setLook((l) => ({ ...l, saturation }))}
            />
            <Slider
              label="Warmth"
              min={0}
              max={1}
              step={0.01}
              value={look.warmth}
              shown={`${Math.round(look.warmth * 100)}`}
              onChange={(warmth) => setLook((l) => ({ ...l, warmth }))}
            />
          </>
        )}

        {tab === "filters" && (
          <div className={styles.filters} role="radiogroup" aria-label="Filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={filterKey === f.key}
                className={styles.filter}
                onClick={() => setLook(f.look)}
              >
                <span className={styles.thumb}>
                  {src && <img src={src.url} alt="" style={{ filter: cssFilter(f.look) }} />}
                </span>
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" className="btn-ghost h-auto py-3" onClick={onChooseAnother} disabled={saving}>
          Choose another
        </button>
        <button
          ref={doneRef}
          type="button"
          className="btn-primary active:btn-primary-active h-auto py-3 disabled:opacity-60"
          onClick={save}
          disabled={!src || saving}
        >
          {saving ? "Saving…" : "Use photo"}
        </button>
      </div>
    </Sheet>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Slider({
  label,
  min,
  max,
  step,
  value,
  shown,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  shown: string;
  onChange: (value: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className={styles.slider}>
      <span className={styles.sliderHead}>
        <span>{label}</span>
        <output>{shown}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />
    </label>
  );
}

function Tool({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={styles.tool} onClick={onClick} aria-pressed={pressed}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
      {label}
    </button>
  );
}
