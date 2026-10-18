# react-cornerstone3d

[한국어](./README.ko.md) · [![CI](https://github.com/entrolEC/react-cornerstone3d/actions/workflows/ci.yml/badge.svg)](https://github.com/entrolEC/react-cornerstone3d/actions/workflows/ci.yml) · **[Live demo →](https://entrolec.github.io/react-cornerstone3d/)**

React bindings that expose [Cornerstone3D](https://www.cornerstonejs.org/)'s live engine state to React components — tearing-free, via `useSyncExternalStore`.

```bash
npm install react-cornerstone3d
```

```tsx
import { useViewportState } from 'react-cornerstone3d';

function SliceIndicator() {
  const index = useViewportState('ct-axial', (s) => s.sliceIndex); // Stack or Volume alike
  if (index === undefined) return null; // viewport not enabled yet, or no slices yet — a normal state, your call what to show
  return <span>slice {index + 1}</span>;
}
```

[**Run it →**](https://entrolec.github.io/react-cornerstone3d/) — a real CT stack with the same slice slider wired both ways, live, and the mount-order bug the hand-rolled one still has: open the study after the widget and its handle never leaves the left edge.

That one hook call replaces the 24 lines of `useEffect` + `addEventListener` + `setState` wiring every Cornerstone3D + React app writes per widget today. The demo counts both sides off the files it is running, so the number cannot drift from the code.

Used in a production medical viewer. Zero runtime dependencies. Bundled, minified and gzipped it costs 3.0 kB for the root entry and 2.2 kB for `/tools` alone, 4.2 kB for both (they share the core; measured with esbuild, `react` and `@cornerstonejs/*` external). Tested in CI against `@cornerstonejs/core` 5.1.1 and the latest 5.x with real-engine browser tests.

<details>
<summary>See what you'd write without the hook</summary>

```tsx
function SliceIndicator() {
  const [state, setState] = useState<{ slice: number; total: number }>();

  useEffect(() => {
    const enabled = getEnabledElementByViewportId('ct-axial');
    if (!enabled) return; // no viewport yet? then never, even once it exists
    const viewport = enabled.viewport as Types.IStackViewport;
    const { element } = viewport;

    const update = () =>
      setState({
        slice: viewport.getSliceIndex(),
        total: viewport.getNumberOfSlices(),
      });
    update(); // patch the gap between first render and subscription

    element.addEventListener(Enums.Events.CAMERA_MODIFIED, update);
    element.addEventListener(Enums.Events.VOI_MODIFIED, update);
    element.addEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    return () => {
      element.removeEventListener(Enums.Events.CAMERA_MODIFIED, update);
      element.removeEventListener(Enums.Events.VOI_MODIFIED, update);
      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    };
  }, []);

  if (!state) return null;
  return <span>slice {state.slice + 1} / {state.total}</span>;
}
```

That is 29 lines, 24 of them wiring — the same 24 the demo counts off `demo/slider-by-hand.tsx` — and after all of it you still have: the mount-order race (a viewport enabled later stays `undefined` forever), the stale copy a closed study leaves behind, tearing under concurrent rendering, and a re-render per engine event during drags — repeated in every widget. The library solves these centrally.

</details>

## Why this exists

Cornerstone3D is not badly built — it is an **engine**, not a store. It manages its own mutable state and fires events when things change; React needs immutable snapshots compared by `Object.is`. `useViewportState` is the adapter that bridges the two: subscribe to engine events, cache an immutable snapshot, rebuild it only when the data actually changed.

Without that adapter, every React viewer hand-rolls the same event plumbing, and with it the same bug layer:

- **Missed updates** in the gap between first render and `useEffect` subscription
- **Tearing** under React 18+ concurrent rendering — two components showing two different slice numbers on one screen
- **Subscription leaks** under StrictMode double-mounting
- **Mount-order races** when UI mounts before a viewport is enabled
- **Infinite loops or deep-compare hacks**, because Cornerstone3D getters build a new object on every call — `getCamera()` always, `getProperties()` too (only a Stack's `voiRange` inside it comes back as the same object until it changes) — so a naive `getSnapshot` never stabilizes. This is hard for everyone: OHIF's own viewport hooks opt out of the React Compiler because, in their words, its memoization "assumes referential purity, so compiling them silently drops updates" ([hooks.ts @ 9753879](https://github.com/OHIF/Viewers/blob/9753879/extensions/cornerstone/src/Viewport/Overlays/ViewportSliceProgressScrollbar/hooks.ts#L1-L5)); the demo's panel 5 quotes three more.

This library solves that bug layer once, centrally. UI components become pure functions of engine state.

## Core design

Three words this README uses as names. The **Engine** is your running Cornerstone3D — rendering engine, viewports, cache, and the tools package's groups and annotations. A **Snapshot** is the frozen copy of one piece of its state that a hook hands you, replaced only when that state changed. A **Binding** is the one subscription per key (a viewportId, an imageId) that keeps a Snapshot current for every component reading it. Every rule below is stated here in full; the ADR links hold the reasoning and the alternatives that lost.

Three decisions shape everything (full rationale in [`docs/adr/`](./docs/adr/)):

1. **The Engine is the single source of truth.** Reads flow Engine → event → immutable Snapshot → `useSyncExternalStore`. Writes stay plain Cornerstone3D API calls — their effects reach React by coming back as engine events. No parallel write API, no echo suppression, one read path regardless of who changed the state (your code or a mouse drag).

2. **The library owns no engine.** Hooks take only a `viewportId` and resolve it through Cornerstone3D's own global registry. No Provider, no singleton, no engine prop — your existing engine management stays untouched.

3. **Absence is a normal state.** A viewport that isn't enabled yet returns `undefined`; the value fills in automatically when it appears and empties when it's destroyed. What to render meanwhile is entirely your app's decision.

On top of that, the Snapshot layer guarantees **referential stability** (unchanged state ⇒ identical reference, no wasted renders, no loops) and **immutability** (deep-frozen — nothing you receive can drift under you). And a field earns its place only when the Engine has both a getter for it and an event that says it moved ([ADR 0007](./docs/adr/0007-a-field-needs-a-getter-and-an-event.md)) — which is why there is a `loaded` and no `loading`.

## API

### `useViewportState(viewportId, selector?)`

```ts
function useViewportState(viewportId: string, selector?: undefined): ViewportState | undefined;
function useViewportState<T>(viewportId: string, selector: (state: ViewportState) => T): T | undefined;
function useViewportState<T>(viewportId: string, selector?: (state: ViewportState) => T): T | ViewportState | undefined;
```

- **`viewportId`** — resolved through Cornerstone3D's global registry. Returns `undefined` while no viewport with that id is enabled.
- **`selector`** — the component re-renders only when the selected value changes by `Object.is`. Never called while the viewport is absent. Select a primitive or an existing field (`s => s.voiRange` is referentially stable across unrelated changes); a selector that *builds* a value — `s => ({ index: s.sliceIndex })` — can never be `Object.is`-equal to its last result, so it re-renders on every Engine event ([ADR 0004](./docs/adr/0004-selector-memo-stays-hand-rolled.md)). An `undefined` selector means none, so a wrapper hook can forward an optional one (the third overload).

Engine events are coalesced to at most one update per animation frame, so a drag produces one render per frame instead of one per event. There is no opt-out: the Snapshot is *state*, not an event stream, and a component that needs every event belongs on a Cornerstone3D listener ([ADR 0006](./docs/adr/0006-the-frame-is-the-unit-of-consistency.md)).

`ViewportState` is a discriminated union. `sliceIndex` / `numberOfSlices` (the Slice Position) are common to every kind, so one slider serves Stack and MPR screens; narrow on `kind` for the rest:

```ts
interface ViewportStateCommon { camera: Types.ICamera; voiRange: Types.VOIRange | undefined; sliceIndex: number | undefined; numberOfSlices: number | undefined; currentImageId: string | undefined }
interface StackViewportState  extends ViewportStateCommon { kind: 'stack';  sliceIndex: number; numberOfSlices: number; imageIds: readonly string[] }
interface VolumeViewportState extends ViewportStateCommon { kind: 'volume' }
type ViewportState = StackViewportState | VolumeViewportState;
```

Every state object is a deep-frozen Snapshot, and the reference stays identical until the state actually changes. A rebuild shares structure with the Snapshot it replaces, so a field that did not move keeps its reference, at any depth — a zoom never hands `s => s.voiRange` a new object, and a scroll never hands `s => s.imageIds` a new array. On a Stack, `sliceIndex` is the *requested* slice — it updates the moment a scroll happens, not when the image finishes loading ([ADR 0003](./docs/adr/0003-image-id-index-is-the-requested-slice.md)). On a Volume it derives from the camera, so it never runs ahead of the pixels. A viewport without slices (3D, or a Volume before `setVolumes`) reports `undefined` for both fields.

`currentImageId` is the image the viewport points at: on a Stack the requested slice's id, on a Volume the image closest to the camera, `undefined` when it points at nothing (a Stack before `setStack`, a Volume before data, 3D). `imageIds` is the Stack's list, replaced only when `setStack` changes its content. Together they are the key into the image hooks below.

Two more widgets, the way they come out:

```tsx
import { getEnabledElementByViewportId, utilities } from '@cornerstonejs/core';

// A window/level readout. `voiRange` keeps its reference while only the camera moves,
// so this re-renders on a window/level drag and on nothing else.
function WindowLevel({ viewportId }: { viewportId: string }) {
  const voi = useViewportState(viewportId, (s) => s.voiRange);
  if (!voi) return null;
  return <span>W {Math.round(voi.upper - voi.lower)} L {Math.round((voi.upper + voi.lower) / 2)}</span>;
}

// The same slider on a Stack or a Volume (MPR) viewport: Slice Position is common to both.
// The write is a plain Cornerstone3D call; its effect comes back as an Engine event.
function SliceSlider({ viewportId }: { viewportId: string }) {
  const slice = useViewportState(viewportId, (s) => s.sliceIndex);
  const total = useViewportState(viewportId, (s) => s.numberOfSlices);
  if (slice === undefined || !total) return null;
  const jump = (imageIndex: number) => {
    const element = getEnabledElementByViewportId(viewportId)?.viewport.element;
    if (element) void utilities.jumpToSlice(element, { imageIndex });
  };
  return <input type="range" min={0} max={total - 1} value={slice} onChange={(e) => jump(Number(e.target.value))} />;
}
```

### `useImageLoadState(imageId)` · `useImageLoadStates(imageIds)`

```ts
type ImageLoadState = 'absent' | 'loaded' | 'failed';
function useImageLoadState(imageId: string | undefined): ImageLoadState | undefined;
function useImageLoadStates(imageIds: readonly string[] | undefined): readonly ImageLoadState[] | undefined;
```

Whether an image is in the cache, as the cache module reports it (`cache.isLoaded`). It is the cache's word, not the viewport's: an image can be loaded and not yet on any canvas.

- `'loaded'` — the cache has it. The cache's getter always wins.
- `'failed'` — a load of it failed (`IMAGE_LOAD_FAILED`) while it was being watched, and the cache has not had it since. A retry has no start event, so it stays `'failed'` until the image arrives (`'loaded'`) or fails again.
- `'absent'` — anything else: never requested, evicted, or failed before anything was watching it. The cache deletes a failed entry and keeps no record, so a failure nobody heard cannot be reported ([ADR 0009](./docs/adr/0009-a-heard-failure-is-a-field.md)).
- `undefined` — there was no image to ask about (`imageId` was `undefined`).

Every state is a non-empty string: compare with `=== 'loaded'`, never `if (state)`.

The array hook is `useImageLoadState` for a whole list: same answer per entry, one frozen array, replaced only when some entry changed. `undefined` in, `undefined` out; an empty list is one stable empty array. It owns no state of its own — a tick component reading `useImageLoadState(imageIds[i])` and a track reading `useImageLoadStates(imageIds)` share one Binding per image.

The library never joins viewport and image state; the join is yours, and it is two lines:

```tsx
function LoadTrack({ viewportId }: { viewportId: string }) {
  const imageIds = useViewportState(viewportId, (s) => (s.kind === 'stack' ? s.imageIds : undefined));
  const current  = useViewportState(viewportId, (s) => s.currentImageId);
  const states   = useImageLoadStates(imageIds); // readonly ImageLoadState[] | undefined
  if (!imageIds || !states) return null;
  return <div className="track">{imageIds.map((id, i) => <span key={id} data-state={states[i]} data-current={id === current} />)}</div>;
}
```

What you will not find: *loading*. A cache entry appears silently when a load is requested, with no event to say so, so a Snapshot cannot follow it ([ADR 0007](./docs/adr/0007-a-field-needs-a-getter-and-an-event.md)). Drawing N ticks is also yours: memo the row or paint a canvas if N is large.

Under the hood, Cornerstone3D's `eventTarget` keeps listeners in a plain array, so the library attaches one set of listeners (added, removed, load failed) for all observed images and routes by id — a thousand observed slices cost three listeners, not three thousand.

### `useCacheState()`

```ts
interface CacheState { readonly imageBytes: number }
function useCacheState(): CacheState;
```

What the cache module reports holding: `imageBytes` is `cache.getCacheSize()`, the bytes of the images in the cache as the cache counts them (volumes are not in that count, hence the name). It follows `IMAGE_CACHE_IMAGE_ADDED` / `_REMOVED`; a thousand arrivals in one frame are one render, and the object is frozen and replaced only when the number moved. Never `undefined` — the cache always exists. The maximum is not here: `setMaxCacheSize` fires no event, and your app set it, so your app knows it.

```tsx
function MemoryGauge({ maxBytes }: { maxBytes: number }) {
  const { imageBytes } = useCacheState();
  return <meter min={0} max={maxBytes} value={imageBytes}>{Math.round(imageBytes / 2 ** 20)} MB</meter>;
}
```

One silent path: during progressive loading Cornerstone3D's `setPartialImage` lowers the size without an event, so `imageBytes` can read slightly high until the next cache event.

### `<CornerstoneViewport />`

Optional. Renders a `<div>`, enables it as a viewport on mount, keeps the Engine's canvas sized to the div (a `ResizeObserver` calls `engine.resize()` when the div changes size), and disables the viewport on unmount — only while its own div still holds the `viewportId`, so a newer component that took the id (an exit animation, a second root) keeps it. The contract stays one `viewportId` per mounted component at a time: if the newer of two overlapping components unmounts first, the older one stays blank, since Cornerstone3D already took the id from it. The Engine stays app-created — the component only resolves it through the registry, and if a parent destroyed the Engine in its own cleanup first (React runs cleanups parent-first), the component's cleanup notices and does nothing.

```tsx
import { Enums } from '@cornerstonejs/core';
import { CornerstoneViewport } from 'react-cornerstone3d';

<CornerstoneViewport
  viewportId="ct-axial"
  type={Enums.ViewportType.STACK}
  onEnabled={(viewport) => toolGroup.addViewport(viewport.id, viewport.renderingEngineId)}
  style={{ width: 512, height: 512 }}
/>
```

| Prop | Description |
|---|---|
| `viewportId` | Id to enable — the same id `useViewportState` observes. |
| `type` | `Enums.ViewportType`, passed to `enableElement`. |
| `defaultOptions?` | `Types.ViewportInputOptions`, applied once at enable time. Later changes do not re-enable. |
| `renderingEngineId?` | Engine to enable on. Defaults to the app's single registered Engine; throws if there are zero or several and no id is given. |
| `onEnabled?` | `(viewport: Types.IViewport) => void`, called right after every enable: first mount, StrictMode's remount, and the re-enable a `viewportId` / `type` / `renderingEngineId` change triggers. Each enable makes a new viewport, and on disable Cornerstone3D drops the old one from its ToolGroup and synchronizers: redo per-viewport setup here (`toolGroup.addViewport`, `setStack`). It runs in the component's effect, before any parent effect, so a ToolGroup it uses must exist before mount. Only the latest callback is used; a new one does not re-enable. If it throws, the viewport is disabled and the error rethrown. |
| `...divProps` | Everything else goes to the `<div>`. |

A missing Engine at mount is a mount-ordering bug, so the component throws instead of degrading — unlike hooks, where viewport absence is a normal state.

### `react-cornerstone3d/tools`

State that lives in `@cornerstonejs/tools`, from a second entry so an app that uses only core never loads the tools package ([ADR 0010](./docs/adr/0010-tools-state-is-a-separate-entry.md)). `@cornerstonejs/tools` is an optional peer dependency; install it at the same version as core, as the tools package itself requires.

```ts
import { refreshAnnotations, useActiveTool, useAnnotations, type AnnotationState } from 'react-cornerstone3d/tools';

function useActiveTool(viewportId: string): string | undefined;
function useAnnotations(viewportId: string, toolName?: string): readonly AnnotationState[] | undefined;
function refreshAnnotations(): void;

interface AnnotationState {
  readonly annotationUID: string;
  readonly toolName: string;
  readonly referencedImageId: string | undefined;
  readonly isLocked: boolean;
  readonly isVisible: boolean;
  readonly isSelected: boolean;
  readonly data: Readonly<Record<string, unknown>>; // a plain frozen copy: handles, cachedStats, label, … (typed arrays as plain arrays)
}
```

**`useActiveTool(viewportId)`** is the tool active on the primary mouse button for the viewport's ToolGroup — the name you passed to `setToolActive`, as `getActivePrimaryMouseButtonTool` reports it. `undefined` while no ToolGroup holds the viewport, or none of its tools is active on the primary button. It follows `TOOL_MODE_CHANGED`, `TOOL_ACTIVATED`, a viewport joining or leaving a group, and the viewport's enable and disable; writes stay `toolGroup.setToolActive(...)`, which does not take the primary button from the tool that held it, so set that one passive first.

```tsx
import { Enums as ToolsEnums, ToolGroupManager } from '@cornerstonejs/tools';

function ToolButton({ viewportId, tool }: { viewportId: string; tool: string }) {
  const active = useActiveTool(viewportId);
  const activate = () => {
    const group = ToolGroupManager.getToolGroupForViewport(viewportId);
    // setToolActive does not take Primary away from the previous tool: set that one passive first.
    const current = group?.getActivePrimaryMouseButtonTool();
    if (current && current !== tool) group!.setToolPassive(current);
    group?.setToolActive(tool, { bindings: [{ mouseButton: ToolsEnums.MouseBindings.Primary }] });
  };
  return <button aria-pressed={active === tool} onClick={activate}>{tool}</button>;
}
```

**`useAnnotations(viewportId, toolName?)`** is the list of annotations on the viewport's frame of reference, as the tools package's annotation state reports it — every tool's, or one tool's. On images without a frame of reference (CR, DX, US, SC, web images) it is the annotations on the images of the viewport's stack, the ones the tools package draws there: per stack, not per image, so scrolling keeps the array; a stack that mixes images with and without a frame of reference switches between the two lists as it scrolls, as the tools package's drawing does; filter by `referencedImageId` for one image. `undefined` while the viewport is absent; a stable empty array when it points at nothing yet or nothing is drawn. An entry is replaced only when the tools package said that annotation changed (`ANNOTATION_ADDED` / `MODIFIED` / `COMPLETED` / `REMOVED`) or its lock, visibility or selection moved (and every entry, once, on a new stack from `setStack`, a re-enable, or `refreshAnnotations()`), and the array only when some entry did — so a row keyed by `annotationUID` and wrapped in `memo` does not re-render while a different annotation is being dragged. `MODIFIED` fires at drag rate; the frame coalesces it to one render. `data` is a plain copy: typed arrays become plain arrays, class instances inside it (a contour's `pointsManager`) are dropped, and so are `storePointData`'s per-voxel samples (`pointsInShape`, `pointsInVolume`, at any depth; read them from `annotation.state.getAnnotation(annotationUID)` when the entry changes). `highlighted` / `invalidated` change without an event and are not fields.

```tsx
import { LengthTool, annotation } from '@cornerstonejs/tools';

function Measurements({ viewportId }: { viewportId: string }) {
  const lengths = useAnnotations(viewportId, LengthTool.toolName);
  if (!lengths) return null;
  return (
    <ul>
      {lengths.map((a) => (
        <li key={a.annotationUID} aria-selected={a.isSelected} onClick={() => annotation.selection.setAnnotationSelected(a.annotationUID, true)}>
          {(a.data.cachedStats as Record<string, { length?: number }> | undefined)?.[`imageId:${a.referencedImageId}`]?.length?.toFixed(1)} mm
        </li>
      ))}
    </ul>
  );
}
```

**`refreshAnnotations()`** rebuilds every `useAnnotations` list from the annotation state in the next frame, for the changes the tools package makes without an event: the annotation manager's own methods (`restoreAnnotations`, `addAnnotation`, `removeAnnotation`; only the `annotation.state.*` calls fire events), `setAnnotationManager` / `resetAnnotationManager`, `cornerstoneTools.destroy()`. Every entry gets a new reference, so call it once after such a change, not per frame.

```ts
import { annotation } from '@cornerstonejs/tools';
import { refreshAnnotations } from 'react-cornerstone3d/tools';

// Load saved measurements, or undo to a saved state:
annotation.state.getAnnotationManager().restoreAnnotations(saved);
refreshAnnotations();
```

### Server rendering

Every hook renders on the server (Next.js prerender, streaming SSR) with its nothing-there value: `undefined` from `useViewportState`, `useActiveTool` and `useAnnotations`; `'absent'` from `useImageLoadState` (`undefined` for an `undefined` id); an array of `'absent'` from `useImageLoadStates` (`undefined` for `undefined`); `{ imageBytes: 0 }` from `useCacheState`. After hydration each takes the client's value, re-rendering only where it differs. A server that leaves `node_modules` external also needs `@cornerstonejs/core` and `tools` 5.2.0 or later (see **Requires**).

## Status

v0.6 — sync only. The library's sole responsibility is state synchronization.

| Capability | Status |
|---|---|
| Stack viewport state (camera, VOI, slice index) | ✅ |
| Volume viewport state + per-kind types | ✅ |
| Slice Position (`sliceIndex`, `numberOfSlices`) common to both kinds | ✅ |
| What a viewport points at (`currentImageId`; Stack `imageIds`) | ✅ |
| Image Load State (`useImageLoadState`, `useImageLoadStates`) | ✅ |
| Absent-viewport contract (`undefined`) | ✅ |
| Shared per-viewport Binding, StrictMode-safe | ✅ |
| Auto fill-in / empty-out on viewport enable/destroy | ✅ |
| Selectors (re-render only when *your* value changes) | ✅ |
| rAF batching for interaction-rate events | ✅ |
| Optional `<CornerstoneViewport />` component | ✅ |
| Generic Viewport (PLANAR_NEXT, CS3D 5.x `useGenericViewport`) | ✅ — Stack and Volume both; VOI written through the legacy `setProperties`, Cornerstone3D's own `WindowLevelTool` included, fires no event there, so `voiRange` misses it (see [Limitations](#limitations), [cornerstone3D #2977](https://github.com/cornerstonejs/cornerstone3D/issues/2977)) |
| Image Load State reports failure (`'absent' \| 'loaded' \| 'failed'`) | ✅ |
| Cache State (`useCacheState`: image bytes held) | ✅ |
| Active tool (`useActiveTool`, from `react-cornerstone3d/tools`) | ✅ |
| Annotation State (`useAnnotations`: per-frame-of-reference list, per stack for images without one, lock / visibility / selection, plain `data`) | ✅ |
| `refreshAnnotations()` for annotation changes that fire no event | ✅ |
| Server rendering (each hook's nothing-there value) | ✅ |
| `<CornerstoneViewport />` keeps the canvas sized to its div | ✅ |
| Volume `volumeIds` | roadmap |
| Segmentation state (same entry, same rules) | roadmap |

**Toward 1.0** (subject to change while 0.x):

- Segmentation state in `react-cornerstone3d/tools`, under the same getter-and-event rule
- One minor release with no breaking change — the API has settled
- A second production viewer on it besides the author's

**Requires:** React 18+, `@cornerstonejs/core` 5.1.1 or a later 5.x; `@cornerstonejs/tools` the same, only for the `/tools` entry (optional peer, same version as core). Ships ESM only, with `.js` on every relative import, so Node ESM, Vitest and webpack 5 load it. Under Node ESM — and so a Vitest or server that leaves it external, Vitest's default — that needs `@cornerstonejs/core` and `tools` 5.2.0 or later: the ESM of 5.1.x uses directory imports, which Node rejects (`ERR_UNSUPPORTED_DIR_IMPORT`) whatever this package does. Bundlers are fine on 5.1.1; on 5.1.x under Vitest, inline them (`test.server.deps.inline: [/@cornerstonejs\//, 'react-cornerstone3d']`). Its types resolve under every `moduleResolution`, `node10` included. `exports` carries a `default` condition, so Jest's resolver finds the entry, but Jest still needs its ESM support turned on for the package. Tested in CI on `@cornerstonejs/core` 5.1.1 and the latest 5.x.

**Stability:** while the major version is 0, a breaking change lands only in a minor release (0.x → 0.y) and is recorded in [CHANGELOG.md](./CHANGELOG.md). Patch releases are safe to take. Pin the exact version or a tilde range (`~0.6.0`).

## Limitations

What the hooks cannot see, because Cornerstone3D does not say it:

- **Two Engines with the same `viewportId`.** Hooks resolve through `getEnabledElementByViewportId`, which returns the first Engine that has the id; a second Engine's viewport with the same id is invisible, and its disable event empties the first's Snapshot. Give viewports unique ids across Engines.
- **`defaultOptions.suppressEvents: true`** on a legacy viewport (STACK on the GPU, ORTHOGRAPHIC, PERSPECTIVE, VOLUME_3D; the Generic Viewport ignores the option) silences `ELEMENT_ENABLED`, `CAMERA_MODIFIED`, `IMAGE_LOAD_ERROR` and `IMAGE_SPACING_CALIBRATED` for it; VOI and stack events still arrive. No hook hears such a viewport arrive: if the first hook on its `viewportId` subscribed before `enableElement`, or across a re-enable of the id, that id's Binding stays `undefined`, and so does every hook that joins it, until all of them unmount — subscribe the first one after the enable. Once seen, the camera and a Volume's Slice Position update only when another event fires. Cornerstone3D's tools ignore such a viewport too: the option is for thumbnails and offscreen renders.
- **Window/level on a Generic Viewport.** A STACK or ORTHOGRAPHIC viewport under `useGenericViewport` is Cornerstone3D's legacy adapter, and its `setProperties({ voiRange })` renders without firing an event ([cornerstone3D #2977](https://github.com/cornerstonejs/cornerstone3D/issues/2977)). Cornerstone3D's own `WindowLevelTool` writes VOI through that path (as do `WindowLevelRegionTool` and the magnify tools), so `voiRange` stays stale during and after a W/L drag, until another camera or VOI event. Write VOI from your own code with `setDisplaySetPresentation({ voiRange })`, which fires `VOI_MODIFIED`. Legacy viewports, the default, are not affected.
- **`removeVolumeActors`** fires only `ACTORS_CHANGED`, which the hook does not subscribe to; the Snapshot keeps the old slice and VOI until the next camera or VOI event.
- **Background tabs.** Rebuilds run on `requestAnimationFrame`, which the browser pauses when the tab is hidden; every Snapshot holds its last visible value and catches up in one frame on return. Reads stay self-consistent meanwhile.
- **A ToolGroup destroyed while its viewport stays enabled.** `ToolGroupManager.destroyToolGroup` (and `ToolGroupManager.destroy()`) fire nothing, so `useActiveTool` keeps the destroyed group's tool until the next tools event or the viewport's disable. Call `toolGroup.removeViewports(engineId)` first; that is heard.
- **Annotation changes that fire no event.** `getAnnotationManager().restoreAnnotations(...)`, the manager's own `addAnnotation` / `removeAnnotation`, `setAnnotationManager` / `resetAnnotationManager` and `cornerstoneTools.destroy()` leave every `useAnnotations` list as it was; call `refreshAnnotations()` after them. Edits a tool makes inside its own handlers without an event (a Length text-box drag, among others) show on that annotation's next event.
- **Annotations added by frame of reference** (`addAnnotation(annotation, FrameOfReferenceUID)` rather than an element) fire `ANNOTATION_ADDED` only when some ToolGroup has that tool in a mode — a tools-package early return — so the hook lists such an annotation on its next event instead.
- **Several ToolGroups claiming one viewport** make `getToolGroupForViewport` throw; the hook lets that through, since Cornerstone3D forbids the configuration.
- **Viewport classes without the legacy getters.** A class without `getCamera` (the Generic Video and ECG adapters, a `*_NEXT` type requested directly) reports `camera: {}` for good, and one without `getProperties` reports `voiRange: undefined`. The legacy `WHOLE_SLIDE` viewport throws from inside Cornerstone3D's own `getCurrentImageId` until `setWSI`, so `useViewportState` on it throws too.

## Out of scope

App state management (use Zustand or whatever you like), write helpers, engine/viewport lifecycle beyond the optional component, rendering performance (that's the Engine's job).

## Development

```bash
npx playwright install chromium   # once — the browser tests run against real Cornerstone3D
npm test                          # unit (jsdom + fake CS3D registry) and browser (headless Chromium) projects
npm run build                     # tsc → dist/
```

Unit tests observe only the public hook API — return values, referential stability, re-render counts. Browser tests drive a real Engine and a real cache to verify the assumptions the fakes make. Domain vocabulary (Engine, Viewport State, Snapshot, Command, Image Load State, Cache State, Tool State, Annotation State, Binding) lives in [`CONTEXT.md`](./CONTEXT.md).
