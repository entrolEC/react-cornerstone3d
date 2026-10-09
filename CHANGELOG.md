# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). While the major version is 0, a breaking change lands in a minor release and is called out as **Breaking** below.

## [Unreleased]

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

[Unreleased]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/entrolEC/react-cornerstone3d/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/entrolEC/react-cornerstone3d/releases/tag/v0.1.1
