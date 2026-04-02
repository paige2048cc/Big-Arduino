import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
/** ln scale step per wheel delta unit (smooth zoom) */
const WHEEL_LN = 0.0018;

/** Uniform scale for all LED instruction banners vs SVG design size (hotspots stay normalized). */
const BANNER_DISPLAY_SCALE = 0.7;

const DEFAULT_INTRINSIC_WIDTH = 602;
const DEFAULT_INTRINSIC_HEIGHT = 227;

/** Normalized 0–1 rect in SVG/viewBox space (left, top, width, height). */
export type LedBannerHotspotRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LedBannerHotspot = {
  rect: LedBannerHotspotRect;
  ariaLabel: string;
  onClick: () => void;
};

type Props = {
  src: string;
  className?: string;
  /** viewBox / width from SVG (default: first frame 602×227) */
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  /** Clickable regions drawn over the image (e.g. Frame 2 “Next”). */
  hotspots?: LedBannerHotspot[];
};

export function LedProjectTopBanner({
  src,
  className,
  intrinsicWidth = DEFAULT_INTRINSIC_WIDTH,
  intrinsicHeight = DEFAULT_INTRINSIC_HEIGHT,
  hotspots,
}: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  /** Max width at scale 1 (fits banner column; capped vs scaled design width and parent) */
  const [fitWidth, setFitWidth] = useState(
    () => intrinsicWidth * BANNER_DISPLAY_SCALE
  );
  const bannerRef = useRef<HTMLDivElement>(null);
  const interactiveRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useLayoutEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return;
    const parent = banner.parentElement;
    if (!parent) return;
    const update = () => {
      const pw = parent.clientWidth;
      if (pw <= 0) return;
      const capW = intrinsicWidth * BANNER_DISPLAY_SCALE;
      setFitWidth(Math.min(capW, pw * 0.94));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [intrinsicWidth]);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src, intrinsicWidth, intrinsicHeight]);

  useEffect(() => {
    const el = interactiveRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = Math.exp(-e.deltaY * WHEEL_LN);
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const isHotspotTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(target.closest('button.project-led-top-banner__hotspot'));

  /** Pan/zoom wrapper — must not capture clicks meant for hotspot Next buttons */
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (isHotspotTarget(e.target)) return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: offset.x,
        origY: offset.y,
      };
    },
    [offset.x, offset.y]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setOffset({
        x: d.origX + (e.clientX - d.startX),
        y: d.origY + (e.clientY - d.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const imgWidthPx = fitWidth * scale;

  return (
    <div ref={bannerRef} className={className} aria-hidden="true">
      <div
        ref={interactiveRef}
        className="project-led-top-banner__interactive"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
        onMouseDown={onMouseDown}
      >
        <div className="project-led-top-banner__img-wrap">
          <img
            key={src}
            src={src}
            alt=""
            width={intrinsicWidth}
            height={intrinsicHeight}
            decoding="async"
            draggable={false}
            className="project-led-top-banner__img"
            style={{ width: `${imgWidthPx}px`, height: 'auto' }}
          />
          {hotspots?.map((h, i) => (
            <button
              key={`${h.ariaLabel}-${i}`}
              type="button"
              className="project-led-top-banner__hotspot"
              aria-label={h.ariaLabel}
              style={{
                left: `${h.rect.x * 100}%`,
                top: `${h.rect.y * 100}%`,
                width: `${h.rect.w * 100}%`,
                height: `${h.rect.h * 100}%`,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                h.onClick();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
