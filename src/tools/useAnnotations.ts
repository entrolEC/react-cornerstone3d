import type { Types } from '@cornerstonejs/core';
import { Enums, eventTarget, getEnabledElementByViewportId } from '@cornerstonejs/core';
import { Enums as ToolsEnums, annotation as annotationApi } from '@cornerstonejs/tools';
import { createRegistry, deepFreeze, useBinding } from '../binding.js';

type Annotation = ReturnType<typeof annotationApi.state.getAllAnnotations>[number];

/** One annotation as the tools package holds it, frozen (see `useAnnotations`). */
export interface AnnotationState {
  readonly annotationUID: string;
  readonly toolName: string;
  /** The image the annotation was drawn on, when the tool recorded one. */
  readonly referencedImageId: string | undefined;
  readonly isLocked: boolean;
  readonly isVisible: boolean;
  readonly isSelected: boolean;
  /**
   * A plain, frozen copy of the annotation's `data` (handles, cachedStats,
   * label, …). Class instances inside it — a contour's `pointsManager` —
   * are not copied; read those from the tools package directly.
   */
  readonly data: Readonly<Record<string, unknown>>;
}

const EMPTY: readonly AnnotationState[] = Object.freeze([]);

// A copy of plain data only: primitives, arrays and plain objects; a typed
// array becomes a plain array, since Object.freeze throws on a non-empty one
// and a contour restored by CS3D undo holds Float32Array views. Anything else
// (a class instance, a function) is dropped, so the Snapshot never holds a
// live object of the Engine's (ADR 0001).
function plainClone(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return typeof value === 'function' ? undefined : value;
  }
  if (Array.isArray(value)) return value.map(plainClone);
  if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const copied = plainClone(child);
    if (copied !== undefined) out[key] = copied;
  }
  return out;
}

// One listener set for every annotation Binding (the eventTarget's listener
// list is a plain array — see useImageLoadState). Every event goes to every
// live Binding: an annotation event names one annotation, which may be on
// any viewport's frame of reference, and the frame coalesces the burst.
interface Handlers {
  /** An annotation was added, changed, completed or removed. */
  readonly annotation: (uid: string | undefined) => void;
  /** A lock, visibility or selection set changed. */
  readonly flags: () => void;
}
const live = new Set<Handlers>();
const onAnnotation = (evt: Event) => {
  const uid = (evt as CustomEvent<{ annotation?: Annotation }>).detail?.annotation?.annotationUID;
  live.forEach((h) => h.annotation(uid));
};
const onFlags = () => live.forEach((h) => h.flags());
const LISTENERS = [
  [ToolsEnums.Events.ANNOTATION_ADDED, onAnnotation],
  [ToolsEnums.Events.ANNOTATION_MODIFIED, onAnnotation],
  [ToolsEnums.Events.ANNOTATION_COMPLETED, onAnnotation],
  [ToolsEnums.Events.ANNOTATION_REMOVED, onAnnotation],
  [ToolsEnums.Events.ANNOTATION_LOCK_CHANGE, onFlags],
  [ToolsEnums.Events.ANNOTATION_VISIBILITY_CHANGE, onFlags],
  [ToolsEnums.Events.ANNOTATION_SELECTION_CHANGE, onFlags],
] as const;
const dispatcher = {
  add(handlers: Handlers) {
    if (live.size === 0) {
      for (const [type, listener] of LISTENERS) eventTarget.addEventListener(type, listener);
    }
    live.add(handlers);
  },
  remove(handlers: Handlers) {
    live.delete(handlers);
    if (live.size === 0) {
      for (const [type, listener] of LISTENERS) eventTarget.removeEventListener(type, listener);
    }
  },
};

// The viewport's frame of reference can change without an annotation event:
// a new stack, a new volume, or on the Generic Viewport a setViewState,
// which fires only CAMERA_MODIFIED (ADR 0008). Cheap: a rebuild with nothing
// pending and the same frame of reference returns the previous Snapshot.
const ELEMENT_EVENTS = [
  Enums.Events.PRE_STACK_NEW_IMAGE,
  Enums.Events.VOLUME_VIEWPORT_NEW_VOLUME,
  Enums.Events.CAMERA_MODIFIED,
];

const key = (viewportId: string, toolName: string | undefined) => `${toolName ?? '*'}@${viewportId}`;

/**
 * One Binding per (viewportId, toolName), alive while it has consumers: the
 * annotations on the viewport's frame of reference, as the tools package's
 * annotation state reports them (ADR 0010). An entry is rebuilt when the
 * tools package said that annotation changed, or when its lock, visibility
 * or selection moved; otherwise it keeps its reference.
 *
 * @internal Exported for tests.
 */
export const annotationBindings = createRegistry<readonly AnnotationState[] | undefined>(
  (bindingKey, binding) => {
    const at = bindingKey.indexOf('@');
    const toolName = bindingKey.slice(0, at) === '*' ? undefined : bindingKey.slice(0, at);
    const viewportId = bindingKey.slice(at + 1);

    // What the next rebuild must redo. Entries not named here, with the same
    // flags, keep their reference; with nothing pending at all and the same
    // frame of reference, the whole array does.
    const dirty = new Set<string>();
    let flagsPending = false;
    let allPending = true;
    let prevFrame: string | undefined;

    const handlers: Handlers = {
      annotation: (uid) => {
        if (uid === undefined) allPending = true;
        else dirty.add(uid);
        binding.schedule();
      },
      flags: () => {
        flagsPending = true;
        binding.schedule();
      },
    };

    const build = (prev: readonly AnnotationState[] | undefined) => {
      const enabled = getEnabledElementByViewportId(viewportId);
      if (!enabled) return undefined;
      const frame = enabled.FrameOfReferenceUID;
      const unchanged =
        prev !== undefined &&
        frame === prevFrame &&
        !allPending &&
        !flagsPending &&
        dirty.size === 0;
      if (unchanged) return prev;
      prevFrame = frame;

      const prevByUid = new Map(prev?.map((entry) => [entry.annotationUID, entry]));
      const next: AnnotationState[] = [];
      if (frame !== undefined) {
        for (const annotation of annotationApi.state.getAllAnnotations()) {
          const uid = annotation.annotationUID;
          const meta = annotation.metadata;
          if (uid === undefined || meta === undefined) continue;
          if (meta.FrameOfReferenceUID !== frame) continue;
          if (toolName !== undefined && meta.toolName !== toolName) continue;
          const isLocked = annotationApi.locking.isAnnotationLocked(uid);
          // The visibility module keeps this field on the annotation itself;
          // its getter scans every annotation, so the field is the getter.
          const isVisible = annotation.isVisible !== false;
          const isSelected = annotationApi.selection.isAnnotationSelected(uid);
          const kept = prevByUid.get(uid);
          if (
            kept &&
            !allPending &&
            !dirty.has(uid) &&
            kept.isLocked === isLocked &&
            kept.isVisible === isVisible &&
            kept.isSelected === isSelected
          ) {
            next.push(kept);
            continue;
          }
          // ponytail: an ANNOTATION_MODIFIED that moved nothing still makes a
          // new entry — the tools package said it changed. Compare `data` by
          // value here if that ever costs a visible render.
          next.push(
            deepFreeze({
              annotationUID: uid,
              toolName: meta.toolName,
              referencedImageId: meta.referencedImageId ?? undefined,
              isLocked,
              isVisible,
              isSelected,
              data: plainClone(annotation.data) as Record<string, unknown>,
            }),
          );
        }
      }
      dirty.clear();
      flagsPending = false;
      allPending = false;
      if (prev && prev.length === next.length && next.every((entry, i) => entry === prev[i])) {
        return prev;
      }
      return next.length === 0 ? EMPTY : Object.freeze(next);
    };

    let element: HTMLDivElement | undefined;
    const onElementEvent = () => binding.schedule();
    const attachElement = () => {
      element = getEnabledElementByViewportId(viewportId)?.viewport.element;
      for (const type of ELEMENT_EVENTS) element?.addEventListener(type, onElementEvent);
    };
    const detachElement = () => {
      for (const type of ELEMENT_EVENTS) element?.removeEventListener(type, onElementEvent);
      element = undefined;
      binding.unschedule();
    };
    const onEnabled = (evt: Event) => {
      if ((evt as Types.EventTypes.ElementEnabledEvent).detail.viewportId !== viewportId) return;
      detachElement();
      attachElement();
      allPending = true;
      binding.update();
    };
    const onDisabled = (evt: Event) => {
      if ((evt as Types.EventTypes.ElementDisabledEvent).detail.viewportId !== viewportId) return;
      detachElement();
      binding.set(undefined);
    };

    return {
      build,
      attach: () => {
        dispatcher.add(handlers);
        eventTarget.addEventListener(Enums.Events.ELEMENT_ENABLED, onEnabled);
        eventTarget.addEventListener(Enums.Events.ELEMENT_DISABLED, onDisabled);
        attachElement();
        allPending = true; // unheard until now: rebuild everything
        binding.update();
      },
      detach: () => {
        eventTarget.removeEventListener(Enums.Events.ELEMENT_ENABLED, onEnabled);
        eventTarget.removeEventListener(Enums.Events.ELEMENT_DISABLED, onDisabled);
        detachElement();
        dispatcher.remove(handlers);
        binding.set(undefined);
      },
    };
  },
);

/**
 * The annotations on a viewport's frame of reference, as the tools package's
 * annotation state reports them — every tool's, or one tool's when
 * `toolName` is given. `undefined` while the viewport is absent; a stable
 * empty array when it points at nothing yet or nothing is drawn.
 *
 * The array is replaced only when an entry changed, and an entry only when
 * the tools package said so (`ANNOTATION_ADDED` / `MODIFIED` / `COMPLETED` /
 * `REMOVED`) or its lock, visibility or selection moved — so a selector
 * such as `list => list.length` and a row keyed by `annotationUID` cost
 * nothing on a drag of some other annotation. `MODIFIED` fires at drag rate;
 * the frame coalesces it to one render.
 *
 * Writes stay the tools package's own calls (`annotation.state.addAnnotation`,
 * `removeAnnotation`, `selection.setAnnotationSelected`, …) and the tools
 * themselves; their effects come back as events. `highlighted` and
 * `invalidated` change without an event and are not here (ADR 0007).
 */
export function useAnnotations(
  viewportId: string,
  toolName?: string,
): readonly AnnotationState[] | undefined {
  return useBinding(annotationBindings.acquire(key(viewportId, toolName)), undefined);
}
