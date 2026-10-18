import type { Enums, Types } from '@cornerstonejs/core';
import { getRenderingEngine, getRenderingEngines } from '@cornerstonejs/core';
import { createElement, useEffect, useRef, type ComponentPropsWithoutRef, type ReactElement } from 'react';

export interface CornerstoneViewportProps extends ComponentPropsWithoutRef<'div'> {
  /** Viewport id to enable — the same id `useViewportState` observes. */
  viewportId: string;
  /** Viewport kind, passed through to `enableElement`. */
  type: Enums.ViewportType;
  /** Applied once at enable time; later changes do not re-enable. */
  defaultOptions?: Types.ViewportInputOptions;
  /**
   * Engine to enable on, resolved via the CS3D registry (ADR 0002).
   * Defaults to the app's single registered Engine.
   */
  renderingEngineId?: string;
  /**
   * Called right after each enable: first mount, StrictMode's remount, and
   * the re-enable a viewportId/type/renderingEngineId change triggers. Each
   * enable creates a new viewport, and CS3D drops the old one from its
   * ToolGroup and synchronizers on disable — redo per-viewport setup here
   * (`toolGroup.addViewport`, `setStack`). Only the latest callback is used;
   * a new one alone does not re-enable.
   */
  onEnabled?: (viewport: Types.IViewport) => void;
}

function resolveEngine(renderingEngineId?: string): Types.IRenderingEngine {
  if (renderingEngineId !== undefined) {
    const engine = getRenderingEngine(renderingEngineId);
    if (!engine) {
      throw new Error(
        `CornerstoneViewport: no RenderingEngine "${renderingEngineId}" is registered — ` +
          'the app must create it before mounting (ADR 0002).',
      );
    }
    return engine;
  }
  const engines = getRenderingEngines() ?? [];
  if (engines.length !== 1) {
    throw new Error(
      `CornerstoneViewport: expected exactly one registered RenderingEngine, found ` +
        `${engines.length} — create one before mounting, or pass renderingEngineId.`,
    );
  }
  return engines[0];
}

/**
 * Thin optional layer over the hook core: enables its own `<div>` as a
 * viewport on mount, keeps the Engine's canvas sized to the div, and
 * disables the viewport on unmount. The Engine stays app-owned and
 * app-created; this component only resolves it through the CS3D registry.
 *
 * Unlike viewport absence in hooks (a normal state, ADR 0002), a missing
 * Engine at mount is a mount-ordering bug — the component throws rather
 * than degrading, since it cannot enable anything without one.
 */
export function CornerstoneViewport({
  viewportId,
  type,
  defaultOptions,
  renderingEngineId,
  onEnabled,
  ...divProps
}: CornerstoneViewportProps): ReactElement {
  const elementRef = useRef<HTMLDivElement>(null);
  // Kept in a ref, out of the enable effect's deps: an inline arrow is a new
  // function every render and would re-enable (destroy and recreate) the
  // viewport each time. Declared before the enable effect, so it runs first
  // and the enable sees this render's callback.
  const onEnabledRef = useRef(onEnabled);
  useEffect(() => {
    onEnabledRef.current = onEnabled;
  });

  useEffect(() => {
    const engine = resolveEngine(renderingEngineId);
    // elementRef is always set here: the div below renders before effects run.
    const element = elementRef.current as HTMLDivElement;
    engine.enableElement({ viewportId, type, element, defaultOptions });

    // CS3D sizes the canvas once, at enable; a div that grows or shrinks
    // afterwards (a layout change, a resized window) keeps the old canvas
    // unless the app calls `engine.resize()`. Watch the div and do it here.
    // The first callback fires right after observe(), when nothing has
    // changed yet — resize() reads the same size and is a no-op.
    // ponytail: resize() re-measures every viewport of the Engine, not only
    // this one; per-viewport sizing is not in CS3D's public API.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            if (!engine.hasBeenDestroyed) engine.resize(true, true);
          });
    observer?.observe(element);

    const cleanup = () => {
      observer?.disconnect();
      // React runs cleanups parent-first: a parent that owns the Engine and
      // destroys it in its own cleanup has already taken this viewport down,
      // and disableElement on a destroyed Engine throws.
      if (!engine.hasBeenDestroyed) engine.disableElement(viewportId);
    };

    // Last, once the cleanup exists: a throwing callback would otherwise
    // abort the effect before React gets the cleanup, leaving the viewport
    // enabled on a div that is going away.
    try {
      onEnabledRef.current?.(engine.getViewport(viewportId));
    } catch (error) {
      cleanup();
      throw error;
    }
    return cleanup;
    // defaultOptions is enable-time-only by CS3D contract — re-enabling on
    // its change would destroy and recreate the viewport.
  }, [viewportId, type, renderingEngineId]);

  return createElement('div', { ref: elementRef, ...divProps });
}
