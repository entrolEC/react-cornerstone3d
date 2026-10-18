# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). While the major version is 0, a breaking change lands in a minor release and is called out as **Breaking** below.

## [Unreleased]

## [0.6.0] - 2026-10-18

### Added

- `react-cornerstone3d/tools` — a second entry for state that lives in `@cornerstonejs/tools`, which is now an optional peer dependency; the root entry never imports it. (ADR 0010)
  - `useActiveTool(viewportId)` — the tool active on the primary mouse button for the viewport's ToolGroup (`getActivePrimaryMouseButtonTool`), or `undefined` when no group holds the viewport or none is active. Follows `TOOL_MODE_CHANGED`, `TOOL_ACTIVATED`, `TOOLGROUP_VIEWPORT_ADDED` / `_REMOVED`, and core's `ELEMENT_ENABLED` / `ELEMENT_DISABLED`.
  - `useAnnotations(viewportId, toolName?)` — the annotations on the viewport's frame of reference (for images without one, on the viewport's stack) as the annotation state reports them: `annotationUID`, `toolName`, `referencedImageId`, `isLocked` / `isVisible` / `isSelected`, and a plain frozen copy of `data`. An entry is replaced only when the tools package said that annotation changed or a flag moved; the array only when an entry did. `undefined` while the viewport is absent.
  - `refreshAnnotations()` — rebuilds every `useAnnotations` list in the next frame, for annotation changes that fire no event: the annotation manager's own `restoreAnnotations` / `addAnnotation` / `removeAnnotation`, `setAnnotationManager` / `resetAnnotationManager`, `cornerstoneTools.destroy()`. Call it once after such a change, e.g. after loading saved measurements with `restoreAnnotations`.
- `<CornerstoneViewport onEnabled>` — `(viewport: Types.IViewport) => void`, called right after every enable (first mount, StrictMode's remount, the re-enable a `viewportId` / `type` / `renderingEngineId` change triggers), so per-viewport setup such as `toolGroup.addViewport` can be redone on the new viewport. Only the latest callback is used and a new one does not re-enable; if it throws, the viewport is disabled and the error rethrown.
- `<CornerstoneViewport />` watches its own `<div>` with a `ResizeObserver` and calls `engine.resize()` when it changes size, so a viewport in a resizable layout no longer needs the app to do it.
- `useViewportState` has a third overload taking a selector that may be `undefined` (`selector?: (state) => T`), so a wrapper hook can forward an optional selector; an `undefined` selector means none, as at runtime before.
- `package.json` `exports` carry a `default` condition (root and `./tools`), so resolvers that do not ask for `import` — Jest's among them — find the entry; `typesVersions` maps `tools`, so the `/tools` types resolve under `moduleResolution: node10`.
- README: tested versions, bundle cost per entry, server rendering, a limitations section (two Engines sharing a viewportId, `suppressEvents`, Generic Viewport window/level, `removeVolumeActors`, background tabs, destroyed ToolGroups, annotation changes without events), a window/level readout and a Volume example.

### Changed

- **Breaking:** the peer range for `@cornerstonejs/core` and `@cornerstonejs/tools` is `^5.1.1` (was `^5.0.0`). On 5.0.0–5.1.0 the Generic Viewport has no `getCurrentMode` and fires no `VOI_MODIFIED` from `setDisplaySetPresentation`, so a Generic volume read as kind `'stack'`; the floor also applies to apps that never turn the Generic Viewport on, and npm 7+ refuses those versions until they move to 5.1.1. CI now tests 5.1.1 and the latest 5.x (the old 5.0.0 leg never got past its install step).
- **Breaking:** typed arrays in `AnnotationState.data` (a contour restored by undo, gl-matrix points) are plain arrays, so a point is always a `number[]`; a `DataView` becomes `[]`.
- **Breaking:** `AnnotationState.data` leaves out `pointsInShape` and `pointsInVolume` at any depth (`storePointData`'s per-voxel samples, and the empty `pointsInShape` stored without it), as CS3D's own `safeStructuredClone` does. Read them from `annotation.state.getAnnotation(annotationUID)` when the entry changes.
- **Breaking:** on images without a frame of reference (CR, DX, US, SC, web images) `useAnnotations` lists the annotations the tools package draws on the viewport — on a stack, those whose `referencedImageId` is in it — instead of a stable `[]`. The list is per stack, not per image.
- `useViewportState` compares and shares the camera at any depth, so a Generic Viewport camera (nested `slice`, `displayArea`) keeps its reference while it holds still, and a field that did not move keeps its reference however deep it sits.
- `<CornerstoneViewport />` disables its `viewportId` on unmount only while its own `<div>` still holds it, so a newer component that took the id keeps it.
- Documentation describes the OHIF comparison the way the demo does — as evidence the problem is hard, with one pinned permalink — instead of a list of their guards.

### Fixed

- The package loads under Node ESM, a consumer's Vitest and plain webpack 5: every relative import in `dist` carries `.js` (they threw `ERR_MODULE_NOT_FOUND`; 0.4.0 has the same defect), and TypeScript consumers on `node16` / `nodenext` get real types instead of TS2835 or `any`.
- Every hook renders on the server with its nothing-there value instead of throwing "Missing getServerSnapshot" (`next build` failed at prerender): `undefined` from `useViewportState`, `useActiveTool` and `useAnnotations`; `'absent'` from `useImageLoadState` (`undefined` for `undefined`); an array of `'absent'` from `useImageLoadStates`; `{ imageBytes: 0 }` from `useCacheState`. Hydration re-renders only where the client differs.
- `CornerstoneViewport`'s declared return type is `ReactElement`, so its `.d.ts` no longer inlines every div prop of the `@types/react` it was built with (consumers with `skipLibCheck: false` and an older `@types/react` got errors inside it).
- `useViewportState` no longer throws during render on viewport classes without the legacy getters (Generic Video, ECG and 3D adapters, a `*_NEXT` type requested directly): a missing `getCamera` reports `camera: {}`, a missing `getProperties` `voiRange: undefined`, and those classes read kind `'volume'` while empty.
- `useAnnotations` no longer throws "Cannot freeze array buffer views with elements" when an annotation's `data` holds a typed array, and no longer recopies `storePointData`'s samples on every frame of a drag.
- `useAnnotations` works with any tool name, including one with `@` or named `*`.
- `useActiveTool` resolves a viewport added to its ToolGroup before it was enabled, and drops a group destroyed before its viewport was disabled. A group destroyed while its viewport stays enabled still fires nothing; call `removeViewports` first.
- `useImageLoadStates` keeps a heard `'failed'` for an id that stays in the list when the list changes.
- `<CornerstoneViewport />` no longer throws on unmount when a parent already destroyed the Engine in its own cleanup (React runs cleanups parent-first; `disableElement` on a destroyed Engine throws). The cleanup checks `hasBeenDestroyed` first.
- `<CornerstoneViewport />`'s unmount no longer destroys the viewport of a newer component that took the same `viewportId` (an exit animation, a second React root).
- README: the `ToolButton` example sets the previous primary tool passive before `setToolActive`, so a toolbar switches tools (`setToolActive` never takes the primary button from another tool). The Status table and the 1.0 criteria no longer contradict each other, and no public text points at a local `.scratch/` file.
- Demo: the rebuilt site (six panels, English by default with a Korean switch, wiring counted off the running files) is on `main`. Panel 5 no longer purges the image cache at page load, the OHIF citations name one commit, ADRs are links, and the hero can jump straight to usage.

## [0.5.0] - 2026-10-09

### Added

- `useCacheState()` — what the cache holds: `{ imageBytes }`, the cache's own `getCacheSize()`, following `IMAGE_CACHE_IMAGE_ADDED` / `_REMOVED`. One Binding for the whole cache; a frame of arrivals is one render, and the frozen object is replaced only when the number moved. No maximum (`setMaxCacheSize` fires no event). During progressive loading `setPartialImage` lowers the size silently, so the value can read slightly high until the next cache event.

### Changed

- **Breaking:** `useImageLoadState(imageId)` returns `'absent' | 'loaded' | 'failed'` (exported as `ImageLoadState`) instead of a boolean, and `useImageLoadStates(imageIds)` an array of the same. `'absent'` is 0.4.0's `false`. `'failed'` means a load failure (`IMAGE_LOAD_FAILED`) was heard while the hook was mounted and the cache has not had the image since; it clears when a retry succeeds. A failure before mount reads `'absent'`. Watch for truthiness checks: `if (loaded)` still compiles and is now always true — compare with `=== 'loaded'`. (ADR 0009)

### Fixed

- A Generic Viewport (`PLANAR_NEXT`, from `init({ rendering: { useGenericViewport: true } })`) holding a Stack now reads as kind `'stack'`. The kind is decided by what the viewport can do, not by `viewport.type`; previously such a Stack fell into the Volume branch and reported `sliceIndex`, `numberOfSlices` and `imageIds` as `undefined`. (ADR 0008)

## [0.4.0] - 2026-09-24

### Added

- `useImageLoadState(imageId)` — is this image in the cache. One Binding per `imageId` behind a single listener pair on `IMAGE_CACHE_IMAGE_ADDED` / `_REMOVED`, so a 1000-slice stack does not add 1000 listeners. `undefined` when there is no image to ask about, `false` when the cache was asked and does not have it. (ADR 0007)
- `useImageLoadStates(imageIds)` — the load state of a whole stack, as a view over the same per-image Bindings. The array is replaced only when an entry changed; arrivals in one frame land in one render.
- Viewport State says what it points at: `currentImageId` on every kind, `imageIds` on a Stack. `imageIds` keeps its previous reference while its content holds.
- One scheduler for every Binding: all Snapshot rebuilds dirtied in a frame run in one pass, so a component reading several viewports renders once instead of once per viewport.

### Changed

- **Breaking:** the `batch` option and `UseViewportStateOptions` are removed. `useViewportState(viewportId, selector?)` is the whole signature; the frame is the unit of consistency. (ADR 0006)
- A Binding lives only while it has consumers; one Binding skeleton serves every kind.

### Fixed

- `StackViewportState.currentImageId` is typed `string | undefined`: between `enableElement` and `setStack` a Stack points at nothing.
- Two live Bindings for the same `imageId` (a hook re-subscribing after eviction) both hear the cache.

## [0.3.0] - 2026-09-21

### Added

- Live demo site: hook vs hand-rolled, and the mount-order story.

### Fixed

- Structural sharing: a Snapshot rebuild keeps the parts that did not move. An unchanged `voiRange` or `camera` keeps its reference, and a moved camera keeps the arrays that held still, so a selector such as `s => s.voiRange` no longer re-renders on zoom.

## [0.2.0] - 2026-09-18

### Added

- Slice Position (`sliceIndex`, `numberOfSlices`) common to every viewport kind. Volume reads `getSliceIndex()` / `getNumberOfSlices()`; a viewport without slices (`VOLUME_3D`, or a Volume before `setVolumes`) reports `undefined`. Subscribes to `VOLUME_VIEWPORT_NEW_VOLUME`.

### Changed

- **Breaking:** `StackViewportState.imageIdIndex` is now `sliceIndex`, with the same meaning (the requested slice, ADR 0003).

## [0.1.1] - 2026-09-18

First published release, as `react-cornerstone3d`.

### Added

- `useViewportState(viewportId, selector?, options?)`: Cornerstone3D viewport state (camera, VOI, slice index) in React via `useSyncExternalStore`, one shared Binding per viewport, StrictMode-safe.
- Volume viewports and per-kind Viewport State types.
- Viewport lifecycle: `undefined` before enable and after destroy, fill-in and empty-out automatic.
- Selectors: re-render only when the selected value changes.
- rAF batching: one Snapshot update per frame during a drag. Opt out per hook with `{ batch: false }` (`UseViewportStateOptions`).
- `<CornerstoneViewport />`: a thin enable/disable component over the hook core.
- Browser smoke tests that verify the Cornerstone3D assumption layer.

### Fixed

- Snapshot invalidated on `PRE_STACK_NEW_IMAGE`, so `imageIdIndex` is the requested slice during a load and after a failed load, not one slice behind. (ADR 0003)

[Unreleased]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/entrolEC/react-cornerstone3d/releases/tag/v0.1.1
