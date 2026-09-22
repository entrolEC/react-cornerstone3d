# react-cornerstone3d

[한국어](./README.ko.md) · **[Live demo →](https://entrolec.github.io/react-cornerstone3d/)**

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

[**Run it →**](https://entrolec.github.io/react-cornerstone3d/) — a real CT stack, the hook and the hand-rolled version side by side, and the mount-order bug the hand-rolled one still has.

That one hook call replaces the ~25 lines of `useEffect` + `addEventListener` + `setState` plumbing every Cornerstone3D + React app writes per widget today.

<details>
<summary>See what you'd write without the hook</summary>

```tsx
function SliceIndicator() {
  const [state, setState] = useState<{ imageIdIndex: number }>();

  useEffect(() => {
    const enabled = getEnabledElementByViewportId('ct-axial');
    if (!enabled) return; // viewport not enabled yet? enabled later? — unhandled
    const { element } = enabled.viewport;

    const update = () => {
      const viewport = enabled.viewport as Types.IStackViewport;
      setState({ imageIdIndex: viewport.getCurrentImageIdIndex() });
    };
    update(); // patch the gap between first render and subscription — easy to forget

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
  return <span>slice {state.imageIdIndex + 1}</span>;
}
```

And after all 27 lines, you still have: the mount-order race (a viewport enabled later stays `undefined` forever), tearing under concurrent rendering, a re-render per event during drags (no batching) — repeated in every widget. The library solves these centrally.

</details>

## Why this exists

Cornerstone3D is not badly built — it is an **engine**, not a store. It manages its own mutable state and fires events when things change; React needs immutable snapshots compared by `Object.is`. `useViewportState` is the adapter that bridges the two: subscribe to engine events, cache an immutable snapshot, rebuild it only when the data actually changed.

Without that adapter, every React viewer hand-rolls the same event plumbing, and with it the same bug layer:

- **Missed updates** in the gap between first render and `useEffect` subscription
- **Tearing** under React 18+ concurrent rendering — two components showing two different slice numbers on one screen
- **Subscription leaks** under StrictMode double-mounting
- **Mount-order races** when UI mounts before a viewport is enabled
- **Infinite loops or deep-compare hacks**, because Cornerstone3D getters return a fresh object on every call — a naive `getSnapshot` never stabilizes (OHIF papers over this with per-hook `JSON.stringify` diffing)

This library solves that bug layer once, centrally. UI components become pure functions of engine state.

## Core design

Three decisions shape everything (full rationale in [`docs/adr/`](./docs/adr/)):

1. **The Engine is the single source of truth.** Reads flow Engine → event → immutable Snapshot → `useSyncExternalStore`. Writes stay plain Cornerstone3D API calls — their effects reach React by coming back as engine events. No parallel write API, no echo suppression, one read path regardless of who changed the state (your code or a mouse drag).

2. **The library owns no engine.** Hooks take only a `viewportId` and resolve it through Cornerstone3D's own global registry. No Provider, no singleton, no engine prop — your existing engine management stays untouched.

3. **Absence is a normal state.** A viewport that isn't enabled yet returns `undefined`; the value fills in automatically when it appears and empties when it's destroyed. What to render meanwhile is entirely your app's decision.

On top of that, the Snapshot layer guarantees **referential stability** (unchanged state ⇒ identical reference, no wasted renders, no loops) and **immutability** (deep-frozen — nothing you receive can drift under you).

## API

### `useViewportState(viewportId, selector?)`

```ts
function useViewportState(viewportId: string, selector?: undefined): ViewportState | undefined;
function useViewportState<T>(viewportId: string, selector: (state: ViewportState) => T): T | undefined;
```

- **`viewportId`** — resolved through Cornerstone3D's global registry. Returns `undefined` while no viewport with that id is enabled.
- **`selector`** — the component re-renders only when the selected value changes by `Object.is`. Never called while the viewport is absent. Select a primitive or an existing field (`s => s.voiRange` is referentially stable across unrelated changes); a selector that *builds* a value — `s => ({ index: s.sliceIndex })` — can never be `Object.is`-equal to its last result, so it re-renders on every Engine event ([ADR 0004](./docs/adr/0004-selector-memo-stays-hand-rolled.md)).

Engine events are coalesced to at most one update per animation frame, so a drag produces one render per frame instead of one per event. There is no opt-out: the Snapshot is *state*, not an event stream, and a component that needs every event belongs on a Cornerstone3D listener ([ADR 0006](./docs/adr/0006-the-frame-is-the-unit-of-consistency.md)).

`ViewportState` is a discriminated union. `sliceIndex` / `numberOfSlices` (the Slice Position) are common to every kind, so one slider serves Stack and MPR screens; narrow on `kind` for the rest:

```ts
interface ViewportStateCommon { camera: Types.ICamera; voiRange: Types.VOIRange | undefined; sliceIndex: number | undefined; numberOfSlices: number | undefined }
interface StackViewportState  extends ViewportStateCommon { kind: 'stack';  sliceIndex: number; numberOfSlices: number }
interface VolumeViewportState extends ViewportStateCommon { kind: 'volume' }
type ViewportState = StackViewportState | VolumeViewportState;
```

Every state object is a deep-frozen Snapshot, and the reference stays identical until the state actually changes. A rebuild shares structure with the Snapshot it replaces, so a field that did not move keeps its reference — a zoom never hands `s => s.voiRange` a new object. On a Stack, `sliceIndex` is the *requested* slice — it updates the moment a scroll happens, not when the image finishes loading ([ADR 0003](./docs/adr/0003-image-id-index-is-the-requested-slice.md)). On a Volume it derives from the camera, so it never runs ahead of the pixels. A viewport without slices (3D, or a Volume before `setVolumes`) reports `undefined` for both fields.

### `<CornerstoneViewport />`

Optional. Renders a `<div>`, enables it as a viewport on mount and disables it on unmount. The Engine stays app-created — the component only resolves it through the registry.

```tsx
import { Enums } from '@cornerstonejs/core';
import { CornerstoneViewport } from 'react-cornerstone3d';

<CornerstoneViewport viewportId="ct-axial" type={Enums.ViewportType.STACK} style={{ width: 512, height: 512 }} />
```

| Prop | Description |
|---|---|
| `viewportId` | Id to enable — the same id `useViewportState` observes. |
| `type` | `Enums.ViewportType`, passed to `enableElement`. |
| `defaultOptions?` | `Types.ViewportInputOptions`, applied once at enable time. Later changes do not re-enable. |
| `renderingEngineId?` | Engine to enable on. Defaults to the app's single registered Engine; throws if there are zero or several and no id is given. |
| `...divProps` | Everything else goes to the `<div>`. |

A missing Engine at mount is a mount-ordering bug, so the component throws instead of degrading — unlike hooks, where viewport absence is a normal state.

## Status

v0.2 — sync only. The library's sole responsibility is state synchronization.

| Capability | Status |
|---|---|
| Stack viewport state (camera, VOI, slice index) | ✅ |
| Volume viewport state + per-kind types | ✅ |
| Slice Position (`sliceIndex`, `numberOfSlices`) common to both kinds | ✅ |
| Absent-viewport contract (`undefined`) | ✅ |
| Shared per-viewport Binding, StrictMode-safe | ✅ |
| Auto fill-in / empty-out on viewport enable/destroy | ✅ |
| Selectors (re-render only when *your* value changes) | ✅ |
| rAF batching for interaction-rate events | ✅ |
| Optional `<CornerstoneViewport />` component | ✅ |
| Annotation / tool / segmentation state | roadmap |

**Requires:** React 18+, `@cornerstonejs/core` 5.x. Ships ESM only.

## Out of scope

App state management (use Zustand or whatever you like), write helpers, engine/viewport lifecycle beyond the optional component, rendering performance (that's the Engine's job).

## Development

```bash
npx playwright install chromium   # once — the browser tests run against real Cornerstone3D
npm test                          # unit (jsdom + fake CS3D registry) and browser (headless Chromium) projects
npm run build                     # tsc → dist/
```

Unit tests observe only the public hook API — return values, referential stability, re-render counts. Browser tests drive a real Engine to verify the assumptions the fake makes. Domain vocabulary (Engine, Viewport State, Snapshot, Command, Binding) lives in [`CONTEXT.md`](./CONTEXT.md).
