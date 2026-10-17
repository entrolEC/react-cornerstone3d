// Every claim this page makes about someone else's code, pinned to a commit so
// a reader can check it. Evidence and method:
// .scratch/demo-site/issues/01-ohif-slider-evidence.md
//
// Verified 2026-10-09 by reading the sources below, re-checked against the
// commit the README now cites so the page and the README point at one OHIF.
// Not observed in a running OHIF — the page says only what the code says.

const OHIF = '9753879';
const CS3D = '264ca707f481';

const ohif = (path: string, lines: string) =>
  `https://github.com/OHIF/Viewers/blob/${OHIF}/${path}#${lines}`;
const cs3d = (path: string, lines: string) =>
  `https://github.com/cornerstonejs/cornerstone3D/blob/${CS3D}/${path}#${lines}`;

/** The scrollbar's value, fed only by the slice event. */
export const OHIF_SLIDER_PERMALINK = ohif(
  'extensions/cornerstone/src/Viewport/Overlays/ViewportImageScrollbar.tsx',
  'L71-L99',
);

const HOOKS = 'extensions/cornerstone/src/Viewport/Overlays/ViewportSliceProgressScrollbar/hooks.ts';

/**
 * What OHIF's slider is wired to. Abridged — the elisions are marked and the
 * permalink has the file. Nothing is reworded.
 */
export const OHIF_SLIDER_CODE = `// utils/viewportDataShape.ts — getSliceEventName()
return (viewportType === Enums.ViewportType.STACK && Enums.Events.STACK_NEW_IMAGE) || ...

// Viewport/Overlays/ViewportImageScrollbar.tsx
const eventId = getSliceEventName(viewportData);
element.addEventListener(eventId, updateIndex);

return <ImageScrollbar value={imageSliceData.imageIndex || 0} ... />;`;

/**
 * Four places where the same files fight the platform, quoted from OHIF's own
 * comments and code. This is the evidence that the problem is hard, not that
 * OHIF is bad.
 */
export const OHIF_SCARS: { code: string; quote: string; where: string; href: string }[] = [
  {
    code: "'use no memo'",
    quote:
      "The compiler's memoization assumes referential purity, so compiling them silently drops updates.",
    // Eight files under Viewport/ carry this opt-out at 9753879, not one.
    where: 'hooks.ts:1 — and 7 more',
    href: ohif(HOOKS, 'L1-L5'),
  },
  {
    code: 'requestAnimationFrame(syncFromViewport)',
    quote:
      '\u2026 fires its slice events synchronously during the mount \u2014 before these listeners attach \u2026',
    where: 'hooks.ts:141',
    href: ohif(HOOKS, 'L135-L141'),
  },
  {
    code: 'addEventListener(CAMERA_MODIFIED, syncFromViewport)',
    quote: '\u2026 leaving the scrollbar unseeded (or stale, with a now-wrong slice count).',
    where: 'hooks.ts:167',
    href: ohif(HOOKS, 'L160-L167'),
  },
  {
    // The getter returns a fresh array every call, so a reference check says
    // "changed" on every camera event. The fix is a hand-kept copy of the
    // previous read plus an explicit value compare — the work a Snapshot does.
    code: 'utilities.isEqual(next, lastViewPlaneNormalRef.current)',
    quote: '\u2026 Ignore camera updates that keep the same orientation (pan/zoom/scroll).',
    where: 'hooks.ts:63',
    href: ohif(HOOKS, 'L56-L68'),
  },
];

/** StackViewport.scroll: cached slices jump now, uncached ones wait. */
export const CS3D_SCROLL_PERMALINK = cs3d(
  'packages/core/src/RenderingEngine/StackViewport.ts',
  'L2906-L2918',
);

/** The branch itself, verbatim; the permalink carries its surroundings. */
export const CACHE_BRANCH = `const imageAlreadyLoaded = cache.isLoaded(targetImageId);

if (imageAlreadyLoaded || !debounce) {
  this.setImageIdIndex(newTargetImageIdIndex);
} else {
  this.debouncedTimeout = window.setTimeout(() => {
    this.setImageIdIndex(newTargetImageIdIndex);
  }, 40);
}`;
