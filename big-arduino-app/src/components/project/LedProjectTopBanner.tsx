import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  addLedBannerSvgRootClass,
  type LedMascotAnimationMode,
  wrapLedBannerMascot,
} from './ledBannerSvgYellow';

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
  /** Disable mascot bounce while crosshair/place mode is active. */
  suppressBounce?: boolean;
  /** viewBox / width from SVG (default: first frame 602×227) */
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  /** Clickable regions drawn over the image (e.g. Frame 2 “Next”). */
  hotspots?: LedBannerHotspot[];
};

function parseLedFrameOrder(src: string): number | null {
  const m = src.match(/led-button-frame-(\d+|simulation)\.svg$/i);
  if (!m) return null;
  if (m[1].toLowerCase() === 'simulation') return 19;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function LedProjectTopBanner({
  src,
  className,
  suppressBounce = false,
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

  const [inlineSvgHtml, setInlineSvgHtml] = useState<string | null>(null);
  const [inlineSvgFailed, setInlineSvgFailed] = useState(false);
  const prevSrcRef = useRef<string | undefined>(undefined);
  const prevFrameOrderRef = useRef<number | null>(null);
  const suppressBounceUntilRef = useRef(0);

  useEffect(() => {
    if (!suppressBounce) return;
    // click-to-place may toggle off right when a frame changes;
    // keep bounce suppressed briefly to avoid crosshair-triggered jumps.
    suppressBounceUntilRef.current = Date.now() + 900;
  }, [suppressBounce]);

  useEffect(() => {
    const prev = prevSrcRef.current;
    const switchedFrame = prev !== undefined && prev !== src;
    const nextOrder = parseLedFrameOrder(src);
    const prevOrder = prevFrameOrderRef.current;
    const effectiveSuppressBounce =
      suppressBounce || Date.now() < suppressBounceUntilRef.current;
    const shouldBounce =
      !effectiveSuppressBounce &&
      switchedFrame &&
      (nextOrder === null || prevOrder === null || nextOrder > prevOrder) &&
      false;
    const mascotAnimationMode: LedMascotAnimationMode = shouldBounce ? 'bounce' : 'none';
    prevSrcRef.current = src;
    prevFrameOrderRef.current = nextOrder;

    if (!src.toLowerCase().endsWith('.svg')) {
      // Keep prior content to avoid flicker while changing frames.
      setInlineSvgFailed(true);
      return;
    }
    const ac = new AbortController();
    setInlineSvgFailed(false);

    fetch(src, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error('svg fetch');
        return r.text();
      })
      .then((text) => {
        const wrapped = wrapLedBannerMascot(text, mascotAnimationMode);
        setInlineSvgHtml(addLedBannerSvgRootClass(wrapped));
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setInlineSvgFailed(true);
        }
      });

    return () => ac.abort();
  }, [src, suppressBounce]);

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

  const useImgFallback = inlineSvgFailed || !inlineSvgHtml;
  const imgWrapClassName = 'project-led-top-banner__img-wrap';

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
        <div className={imgWrapClassName}>
          {!useImgFallback ? (
            <div
              className="project-led-top-banner__svg-host"
              // Trusted same-origin SVG from /public
              dangerouslySetInnerHTML={{ __html: inlineSvgHtml }}
              style={{
                width: `${imgWidthPx}px`,
                lineHeight: 0,
              }}
            />
          ) : (
            <img
              src={src}
              alt=""
              width={intrinsicWidth}
              height={intrinsicHeight}
              decoding="async"
              draggable={false}
              className="project-led-top-banner__img"
              style={{ width: `${imgWidthPx}px`, height: 'auto' }}
            />
          )}
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
