# react-cornerstone3d

React bindings that expose Cornerstone3D's live engine state to React components, tearing-free, via `useSyncExternalStore`.

## Language

**Engine**:
The running Cornerstone3D instance (rendering engine, viewports, cache, and the tools package's ToolGroups and annotation state). The single source of truth for all synced state.
_Avoid_: store, backend

**Viewport State**:
The observable state of one viewport: camera, VOI (window/level), Slice Position, what it points at (the current image and, for a Stack, its image list), and similar per-viewport values. Values are what the Engine *reports*, not what is painted on the canvas: the slice index is the slice the Engine has been told to show, which may run ahead of the pixels. Its `kind` (`stack` or `volume`) names the slice model the Engine runs and is read from what the viewport can do, not from its type tag (ADR 0008).
_Avoid_: viewport data, view state

**Slice Position**:
The current slice index and the number of slices of a viewport, as the Engine reports them. Shared by every viewport kind so one slice control serves Stack and Volume alike. In a Stack it is the position in the image list; in a Volume it is derived from the camera, so it never runs ahead of the pixels. A viewport without slices (3D, or a Volume before its data arrives) has no Slice Position.
_Avoid_: current/total, slice info, slider state

**Snapshot**:
An immutable, referentially-stable copy of a piece of Engine state, rebuilt, at most once per frame, when a relevant Engine event fires. What `getSnapshot` returns. React compares what it gets back by `Object.is` and the Engine's getters return a fresh object on every call, so the Snapshot is what makes *unchanged* expressible at all. A rebuild shares structure with the Snapshot it replaces: the parts that did not move keep their previous references, so a selector reading one of them does not re-render because something else did.
_Avoid_: state copy, cache object

**Command**:
A write from React to the Engine — always a Cornerstone3D API call. Its effect reaches React only by coming back as an Engine event; the library never writes to Snapshots directly.
_Avoid_: setter, dispatch, mutation

**Image Load State**:
Whether one image is in the cache, as the cache module reports it, in one of three answers: *loaded* (the cache has it), *failed*, or *absent* (anything else — never requested, evicted). It is the cache's word, not the viewport's: an image can be loaded and not yet on any canvas. *Failed* is what the Binding heard while it was alive: a load failure for that image, with the cache not having reported the image since; a failure before anyone listened reads *absent*.
_Avoid_: loading status, ready, rendered, cached flag

**Cache State**:
The totals the cache module reports. Today, the bytes held by images (`imageBytes`, the cache's own count — volumes are not in it). It is the cache's word, not any viewport's.
_Avoid_: memory usage, cache info

**Tool State**:
What `@cornerstonejs/tools` reports for a viewport's ToolGroup: today, the Active Tool — the tool active on the primary mouse button, as the group names it. Read from a separate entry (`react-cornerstone3d/tools`) so an app without the tools package loads none of it (ADR 0010).
_Avoid_: tool mode, current tool, toolbar state

**Annotation State**:
The annotations on a viewport's frame of reference, as the tools package's annotation state reports them: for each, its id, tool, referenced image, lock / visibility / selection, and a plain frozen copy of its data. An entry is rebuilt when the tools package said that annotation changed; `highlighted` and `invalidated` change silently and are not in it.
_Avoid_: measurements (a tool's word, not the state's), annotation list, markup

**Binding**:
A subscription connecting one Engine event source to Snapshot rebuilding, keyed by what its getters take — a viewportId, an imageId, or a (viewportId, toolName) pair; the cache's takes nothing, there being one cache. Exactly one Binding exists per key while it has consumers (the keyless one always exists, and hears the Engine only while it has consumers); hooks are surfaces over Bindings and one hook may read several. Every Binding made dirty in one frame rebuilds in the same synchronous pass, so two hooks in one component never see different frames.
_Avoid_: sync, connector, store
