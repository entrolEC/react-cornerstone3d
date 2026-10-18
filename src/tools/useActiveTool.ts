import { Enums as CoreEnums, eventTarget } from '@cornerstonejs/core';
import { Enums, ToolGroupManager } from '@cornerstonejs/tools';
import { createRegistry, useBinding } from '../binding.js';

// What `@cornerstonejs/tools` says when the answer can change (ADR 0010):
// a mode change on any tool of any group, and a viewport joining or leaving
// a group. Plus core's enable and disable, for what tools leaves unsaid:
// - a viewport added to its group before it is enabled resolves to no group
//   until enable (getToolGroupForViewport finds the Engine by its
//   viewports), so TOOLGROUP_VIEWPORT_ADDED came too early to count;
// - a group destroyed before its viewport is disabled: the disable finds no
//   group to leave, so TOOLGROUP_VIEWPORT_REMOVED never fires.
// Both fire mid-change; the rebuild is a frame later and reads the result.
// ToolGroup creation is silent, but a group with no viewport answers nothing
// anyway. Destruction is silent too: a group destroyed while its viewport
// stays enabled leaves the hook on its last tool until some later event.
// ponytail: no event exists for that one; apps call `removeViewports` before
// `destroyToolGroup` (heard as TOOLGROUP_VIEWPORT_REMOVED). Polling is the
// upgrade if that ever won't do.
const EVENTS = [
  Enums.Events.TOOL_MODE_CHANGED,
  Enums.Events.TOOL_ACTIVATED,
  Enums.Events.TOOLGROUP_VIEWPORT_ADDED,
  Enums.Events.TOOLGROUP_VIEWPORT_REMOVED,
  CoreEnums.Events.ELEMENT_ENABLED,
  CoreEnums.Events.ELEMENT_DISABLED,
];

/**
 * One Binding per viewportId, alive while it has consumers. Its Snapshot is
 * the tools package's own answer: the tool the viewport's ToolGroup has
 * active on the primary mouse button (`getActivePrimaryMouseButtonTool`),
 * or `undefined` when no group holds the viewport or none is active.
 *
 * @internal Exported for tests.
 */
export const activeToolBindings = createRegistry<string | undefined>((viewportId, binding) => {
  // Every event is routed to every live Binding: the getter is one Map scan,
  // and the frame coalesces a burst into one rebuild (ADR 0006).
  // ponytail: filter by the group's id if many viewports ever make this show.
  const onEvent = () => binding.schedule();
  return {
    build: () =>
      ToolGroupManager.getToolGroupForViewport(viewportId)?.getActivePrimaryMouseButtonTool(),
    attach: () => {
      for (const type of EVENTS) eventTarget.addEventListener(type, onEvent);
      binding.update(); // the mode may have moved between render and subscription
    },
    detach: () => {
      binding.unschedule();
      for (const type of EVENTS) eventTarget.removeEventListener(type, onEvent);
    },
  };
});

/**
 * The tool active on the primary mouse button for a viewport, as its
 * ToolGroup reports it — the name you passed to `setToolActive`. `undefined`
 * while no ToolGroup holds the viewport, or none of its tools is active on
 * the primary button. Writes stay `toolGroup.setToolActive(...)` and friends;
 * their effect comes back as `TOOL_MODE_CHANGED`.
 *
 * Resolved through `ToolGroupManager.getToolGroupForViewport`, which throws
 * when several groups claim one viewport — a configuration Cornerstone3D
 * itself forbids.
 */
export function useActiveTool(viewportId: string): string | undefined {
  return useBinding(activeToolBindings.acquire(viewportId), undefined);
}
