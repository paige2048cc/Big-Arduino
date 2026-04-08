/**
 * Wrap mascot block (yellow body + facial features) in a <g> so we can animate it independently.
 * Returns original string if no such path exists.
 */
function findYellowMascotPathStart(svgMarkup: string): number {
  const yellowPathRe = /<path\b[^>]*fill\s*=\s*["']#FFC425["'][^>]*\/>/i;
  const m = yellowPathRe.exec(svgMarkup);
  return m ? m.index : -1;
}

export type LedMascotAnimationMode = 'none' | 'bounce';

function animationClassFor(mode: LedMascotAnimationMode): string {
  if (mode === 'bounce') return ' project-led-mascot--bounce';
  return '';
}

export function wrapLedBannerMascot(
  svgMarkup: string,
  animationMode: LedMascotAnimationMode
): string {
  const start = findYellowMascotPathStart(svgMarkup);
  if (start < 0) return svgMarkup;

  const defsIdx = svgMarkup.indexOf('<defs', start);
  const svgEndIdx = svgMarkup.lastIndexOf('</svg>');
  const end =
    defsIdx >= 0 ? defsIdx
      : (svgEndIdx > start ? svgEndIdx : svgMarkup.length);

  const before = svgMarkup.slice(0, start);
  const mascotBlock = svgMarkup.slice(start, end);
  const after = svgMarkup.slice(end);
  const animationClass = animationClassFor(animationMode);
  return `${before}<g class="project-led-mascot${animationClass}">${mascotBlock}</g>${after}`;
}

/** Ensure the root <svg> gets the same layout class as raster <img> banners. */
export function addLedBannerSvgRootClass(svgMarkup: string): string {
  return svgMarkup.replace(/^<svg\s/i, '<svg class="project-led-top-banner__svg-root" ');
}
