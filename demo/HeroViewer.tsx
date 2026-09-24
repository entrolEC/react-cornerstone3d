import { useEffect, useRef, useState } from 'react';
import { useViewportState } from 'react-cornerstone3d';
import { CtViewport, useAutoScroll } from './CtViewport';
import { useCopy } from './ui';

const VIEWPORT_ID = 'demo-hero-live';

/**
 * The page argues about numbers drifting away from an image, so the image —
 * moving, with its numbers keeping up — is what the reader should meet first.
 * Until the series lands this holds its space rather than collapsing the grid.
 */
export function HeroViewer({ imageIds }: { imageIds?: string[] }) {
  const t = useCopy().hero;
  const [awake, setAwake] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const frame = useRef<HTMLElement>(null);

  // One orchestrated moment on load: it fades up, then starts paging.
  useEffect(() => {
    if (!imageIds) return;
    const id = setTimeout(() => setAwake(true), 600);
    return () => clearTimeout(id);
  }, [imageIds]);

  // Paging forever costs a decode per tick, and the app runs one worker — left
  // running it starves every panel below. Page only while it is being watched.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useAutoScroll(VIEWPORT_ID, awake && onScreen);

  return (
    <figure className={`herovp${awake ? ' herovp--awake' : ''}`} ref={frame}>
      <div className="herovp__frame">
        {imageIds ? (
          <CtViewport viewportId={VIEWPORT_ID} imageIds={imageIds} showOverlay={false} />
        ) : (
          <div className="herovp__wait" />
        )}
        <Readout />
      </div>
      <figcaption className="herovp__cap">{t.caption}</figcaption>
    </figure>
  );
}

/** The live numbers, read the way the library asks you to read them. */
function Readout() {
  const t = useCopy().hero;
  const slice = useViewportState(VIEWPORT_ID, (s) => s.sliceIndex);
  const total = useViewportState(VIEWPORT_ID, (s) => s.numberOfSlices);
  const voi = useViewportState(VIEWPORT_ID, (s) => s.voiRange);

  return (
    <div className="readout">
      <span className="readout__slice">
        {slice === undefined ? '—' : slice + 1}
        <i>/{total ?? '—'}</i>
      </span>
      <span className="readout__voi">
        {voi ? `W ${Math.round(voi.upper - voi.lower)}  L ${Math.round((voi.upper + voi.lower) / 2)}` : t.waiting}
      </span>
    </div>
  );
}
