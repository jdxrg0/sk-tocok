"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Check,
  Loader2,
  ImagePlus,
  Move,
  AlertCircle,
} from "lucide-react";

interface AvatarCropModalProps {
  file: File;
  onCancel: () => void;
  onApply: (croppedFile: File) => Promise<void> | void;
  onChooseAnother?: () => void;
  applying?: boolean;
  error?: string | null;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const CROP_RATIO = 0.82;
const OUTPUT_SIZE = 512;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function AvatarCropModal({
  file,
  onCancel,
  onApply,
  onChooseAnother,
  applying = false,
  error = null,
}: AvatarCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState(300);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const stateRef = useRef({ zoom, rotation, offset, stageSize, naturalSize });
  stateRef.current = { zoom, rotation, offset, stageSize, naturalSize };

  // Create and clean up Object URL when file changes
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);
    setNaturalSize(null);
    setLoadError(null);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    pointersRef.current.clear();

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Observe responsive crop stage dimensions
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setStageSize(rect.width);
      }
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateSize);
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const computeBounds = useCallback(
    (
      zoomVal: number,
      rotVal: number,
      stSize: number,
      nat: { width: number; height: number } | null
    ) => {
      const cropSize = stSize * CROP_RATIO;
      if (!nat || nat.width <= 0 || nat.height <= 0 || cropSize <= 0) {
        return { cropSize, scale: 1, maxX: 0, maxY: 0 };
      }
      const isSwapped = Math.abs(rotVal % 180) === 90;
      const rotW = isSwapped ? nat.height : nat.width;
      const rotH = isSwapped ? nat.width : nat.height;
      const baseScale = Math.max(cropSize / rotW, cropSize / rotH);
      const scale = baseScale * zoomVal;
      const maxX = Math.max(0, (rotW * scale - cropSize) / 2);
      const maxY = Math.max(0, (rotH * scale - cropSize) / 2);
      return { cropSize, scale, maxX, maxY };
    },
    []
  );

  const clampOffset = useCallback(
    (
      x: number,
      y: number,
      zoomVal: number,
      rotVal: number,
      stSize: number,
      nat: { width: number; height: number } | null
    ) => {
      const { maxX, maxY } = computeBounds(zoomVal, rotVal, stSize, nat);
      return {
        x: clamp(x, -maxX, maxX),
        y: clamp(y, -maxY, maxY),
      };
    },
    [computeBounds]
  );

  // Re-clamp offset if stage resizes
  useEffect(() => {
    if (!naturalSize) return;
    setOffset((prev) => clampOffset(prev.x, prev.y, zoom, rotation, stageSize, naturalSize));
  }, [stageSize, naturalSize, zoom, rotation, clampOffset]);

  const applyZoom = useCallback(
    (nextZoomRaw: number) => {
      const { zoom: prevZoom, rotation: rot, offset: prevOffset, stageSize: st, naturalSize: nat } =
        stateRef.current;
      const nextZoom = clamp(Number(nextZoomRaw.toFixed(3)), MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === prevZoom) return;
      const ratio = nextZoom / prevZoom;
      const clamped = clampOffset(prevOffset.x * ratio, prevOffset.y * ratio, nextZoom, rot, st, nat);
      setZoom(nextZoom);
      setOffset(clamped);
    },
    [clampOffset]
  );

  const handleRotate = () => {
    if (!naturalSize) return;
    const nextRot = (rotation + 90) % 360;
    // Rotate current pan vector 90 deg clockwise so framing stays aligned
    const rotatedOffset = clampOffset(-offset.y, offset.x, zoom, nextRot, stageSize, naturalSize);
    setRotation(nextRot);
    setOffset(rotatedOffset);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  // Mouse wheel zoom on stage (non-passive so scrolling does not leak to page)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!stateRef.current.naturalSize) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0018;
      applyZoom(stateRef.current.zoom * (1 + delta));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [applyZoom]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !applying && !processing) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applying, processing, onCancel]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || applying || processing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId) || !naturalSize) return;
    const prevPoints = Array.from(pointersRef.current.entries());
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      const prev = prevPoints[0][1];
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      const { zoom: z, rotation: rot, offset: cur, stageSize: st, naturalSize: nat } =
        stateRef.current;
      setOffset(clampOffset(cur.x + dx, cur.y + dy, z, rot, st, nat));
    } else if (pointersRef.current.size === 2 && prevPoints.length >= 2) {
      const [id1, p1Prev] = prevPoints[0];
      const [id2, p2Prev] = prevPoints[1];
      const p1Curr = pointersRef.current.get(id1);
      const p2Curr = pointersRef.current.get(id2);
      if (!p1Curr || !p2Curr) return;

      const prevDist = Math.hypot(p2Prev.x - p1Prev.x, p2Prev.y - p1Prev.y);
      const currDist = Math.hypot(p2Curr.x - p1Curr.x, p2Curr.y - p1Curr.y);
      if (prevDist <= 0) return;

      const prevMidX = (p1Prev.x + p2Prev.x) / 2;
      const prevMidY = (p1Prev.y + p2Prev.y) / 2;
      const currMidX = (p1Curr.x + p2Curr.x) / 2;
      const currMidY = (p1Curr.y + p2Curr.y) / 2;

      const { zoom: prevZoom, rotation: rot, offset: prevOff, stageSize: st, naturalSize: nat } =
        stateRef.current;
      const nextZoom = clamp(prevZoom * (currDist / prevDist), MIN_ZOOM, MAX_ZOOM);
      const zoomRatio = nextZoom / prevZoom;
      const nextOff = clampOffset(
        prevOff.x * zoomRatio + (currMidX - prevMidX),
        prevOff.y * zoomRatio + (currMidY - prevMidY),
        nextZoom,
        rot,
        st,
        nat
      );
      setZoom(nextZoom);
      setOffset(nextOff);
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (pointersRef.current.size === 0) {
      setIsDragging(false);
    }
  };

  const handleStageKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!naturalSize || applying || processing) return;
    const step = e.shiftKey ? 24 : 8;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      applyZoom(zoom + 0.15);
      return;
    } else if (e.key === "-") {
      e.preventDefault();
      applyZoom(zoom - 0.15);
      return;
    } else {
      return;
    }
    e.preventDefault();
    setOffset(clampOffset(offset.x + dx, offset.y + dy, zoom, rotation, stageSize, naturalSize));
  };

  const handleApplyCrop = async () => {
    const img = imgRef.current;
    if (!img || !naturalSize || applying || processing) return;

    setProcessing(true);
    try {
      const { cropSize, scale } = computeBounds(zoom, rotation, stageSize, naturalSize);
      const outputRatio = OUTPUT_SIZE / cropSize;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to initialize image crop canvas.");
      }

      const preserveTransparency = file.type === "image/png" || file.type === "image/webp";
      const outputMime = preserveTransparency ? "image/png" : "image/jpeg";
      const outputExt = preserveTransparency ? "png" : "jpg";

      if (!preserveTransparency) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.save();
      ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
      ctx.translate(offset.x * outputRatio, offset.y * outputRatio);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale * outputRatio, scale * outputRatio);
      ctx.drawImage(
        img,
        -naturalSize.width / 2,
        -naturalSize.height / 2,
        naturalSize.width,
        naturalSize.height
      );
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputMime, preserveTransparency ? undefined : 0.92)
      );

      if (!blob) {
        throw new Error("Failed to generate cropped image.");
      }

      const rawBase = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "avatar";
      const croppedFile = new File([blob], `${rawBase}_cropped.${outputExt}`, {
        type: outputMime,
        lastModified: Date.now(),
      });

      await onApply(croppedFile);
    } catch (err) {
      console.error("Avatar crop error:", err);
      setLoadError("Could not process cropped photo. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const { cropSize, scale } = computeBounds(zoom, rotation, stageSize, naturalSize);
  const isBusy = applying || processing;
  const isModified = zoom !== 1 || rotation !== 0 || offset.x !== 0 || offset.y !== 0;

  return (
    <>
      <div
        className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[120] bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 overscroll-contain touch-none"
        onClick={() => {
          if (!isBusy) onCancel();
        }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[121] pointer-events-none flex items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] overscroll-contain">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-crop-title"
          className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
          style={{
            maxHeight:
              "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Header */}
          <div className="shrink-0 border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-white dark:bg-slate-900">
            <h3
              id="avatar-crop-title"
              className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-tight"
            >
              Adjust &amp; Crop Photo
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Drag to reposition and zoom to frame the official&apos;s portrait
            </p>
          </div>

          {/* Crop Workspace */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 overscroll-contain">
            {/* Interactive Circular Crop Stage */}
            <div className="flex justify-center">
              <div
                ref={stageRef}
                tabIndex={0}
                role="application"
                aria-label="Photo crop canvas. Drag or use arrow keys to reposition, scroll or use plus and minus to zoom."
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onKeyDown={handleStageKeyDown}
                className={`relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden bg-slate-900 select-none touch-none ring-1 ring-slate-200 dark:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  naturalSize && !isBusy
                    ? isDragging
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "cursor-default"
                }`}
              >
                {/* Subtle checkerboard background for transparent PNGs */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #64748b 25%, transparent 25%), linear-gradient(-45deg, #64748b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #64748b 75%), linear-gradient(-45deg, transparent 75%, #64748b 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                  }}
                />

                {/* Source Image */}
                {imageSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Crop preview"
                    draggable={false}
                    onLoad={(e) => {
                      const target = e.currentTarget;
                      if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                        setNaturalSize({
                          width: target.naturalWidth,
                          height: target.naturalHeight,
                        });
                        setLoadError(null);
                      }
                    }}
                    onError={() => {
                      setLoadError("Unable to load this image file. Please choose a different photo.");
                    }}
                    style={
                      naturalSize
                        ? {
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: `${naturalSize.width}px`,
                            height: `${naturalSize.height}px`,
                            maxWidth: "none",
                            maxHeight: "none",
                            marginLeft: `${-naturalSize.width / 2}px`,
                            marginTop: `${-naturalSize.height / 2}px`,
                            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotation}deg) scale(${scale})`,
                            transformOrigin: "center center",
                            willChange: "transform",
                          }
                        : { opacity: 0, position: "absolute", pointerEvents: "none" }
                    }
                  />
                )}

                {/* Circular Aperture Overlay + Dark Surround */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className="rounded-full ring-2 ring-white/95 relative overflow-hidden"
                    style={{
                      width: `${cropSize}px`,
                      height: `${cropSize}px`,
                      boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.62)",
                    }}
                  >
                    {/* Rule-of-thirds alignment guide while dragging */}
                    <div
                      className={`absolute inset-0 transition-opacity duration-150 ${
                        isDragging ? "opacity-55" : "opacity-0"
                      }`}
                    >
                      <div className="absolute top-1/3 left-0 right-0 h-px bg-white/70" />
                      <div className="absolute top-2/3 left-0 right-0 h-px bg-white/70" />
                      <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/70" />
                      <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/70" />
                    </div>
                  </div>
                </div>

                {/* Loading indicator before natural dimensions are ready */}
                {!naturalSize && !loadError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 bg-slate-900/70">
                    <Loader2 className="w-6 h-6 animate-spin mb-1.5" />
                    <span className="text-xs font-semibold">Loading photo...</span>
                  </div>
                )}

                {/* Drag hint pill */}
                {naturalSize && !isDragging && !isBusy && (
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 pointer-events-none inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-950/65 text-white/90 text-[10.5px] font-semibold backdrop-blur-sm whitespace-nowrap">
                    <Move className="w-3 h-3" />
                    <span>Drag to position</span>
                  </div>
                )}
              </div>
            </div>

            {/* Zoom & Quick Controls */}
            <div className="space-y-3">
              {/* Zoom Slider Row */}
              <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-2">
                <button
                  type="button"
                  disabled={!naturalSize || isBusy || zoom <= MIN_ZOOM}
                  onClick={() => applyZoom(zoom - 0.2)}
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                  title="Zoom out"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  disabled={!naturalSize || isBusy}
                  onChange={(e) => applyZoom(parseFloat(e.target.value))}
                  aria-label="Zoom photo"
                  className="flex-1 h-1.5 rounded-lg appearance-none bg-slate-200 dark:bg-slate-700 accent-brand-600 cursor-pointer disabled:opacity-50"
                />

                <button
                  type="button"
                  disabled={!naturalSize || isBusy || zoom >= MAX_ZOOM}
                  onClick={() => applyZoom(zoom + 0.2)}
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <span className="text-[11px] font-bold font-mono text-slate-500 dark:text-slate-400 w-10 text-right shrink-0">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              {/* Action Toolbar: Rotate, Reset, Choose Another */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!naturalSize || isBusy}
                    onClick={handleRotate}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                    title="Rotate 90° clockwise"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rotate</span>
                  </button>

                  {isModified && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={handleReset}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                      title="Reset zoom, rotation, and position"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {onChooseAnother && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={onChooseAnother}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/50 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>Change photo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Error Alert */}
            {(loadError || error) && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loadError || error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/70 sm:bg-white dark:sm:bg-slate-900 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!naturalSize || Boolean(loadError) || isBusy}
              onClick={handleApplyCrop}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
