import { eventTarget } from '@cornerstonejs/core';
import { Enums, ToolGroupManager } from '@cornerstonejs/tools';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useActiveTool } from './index';
import { activeToolBindings } from './useActiveTool';

// Real module loads; only the group lookup is replaced, so a fake ToolGroup
// can answer for a viewport while the real event names are dispatched.
vi.mock('@cornerstonejs/tools', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cornerstonejs/tools')>();
  return {
    ...actual,
    ToolGroupManager: { ...actual.ToolGroupManager, getToolGroupForViewport: vi.fn() },
  };
});

const groups = new Map<string, { active: string | undefined }>();
const lookup = vi.mocked(ToolGroupManager.getToolGroupForViewport);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  lookup.mockImplementation((viewportId: string) => {
    const group = groups.get(viewportId);
    if (!group) return undefined;
    return { getActivePrimaryMouseButtonTool: () => group.active } as never;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  groups.clear();
  lookup.mockReset();
});

const fire = (type: string, detail: object = {}) =>
  act(() => {
    eventTarget.dispatchEvent(new CustomEvent(type, { detail }));
    vi.advanceTimersToNextFrame();
  });

describe('useActiveTool', () => {
  test('undefined while no ToolGroup holds the viewport; fills in when one does', () => {
    const { result } = renderHook(() => useActiveTool('vp'));
    expect(result.current).toBeUndefined();

    groups.set('vp', { active: 'WindowLevel' });
    fire(Enums.Events.TOOLGROUP_VIEWPORT_ADDED, { viewportId: 'vp', toolGroupId: 'tg' });
    expect(result.current).toBe('WindowLevel');
  });

  test('follows TOOL_MODE_CHANGED: the name the group reports, or undefined when none is active', () => {
    groups.set('vp', { active: 'Zoom' });
    const { result } = renderHook(() => useActiveTool('vp'));
    expect(result.current).toBe('Zoom');

    groups.get('vp')!.active = 'Pan';
    fire(Enums.Events.TOOL_MODE_CHANGED, { toolGroupId: 'tg', toolName: 'Pan', mode: 'Active' });
    expect(result.current).toBe('Pan');

    groups.get('vp')!.active = undefined;
    fire(Enums.Events.TOOL_MODE_CHANGED, { toolGroupId: 'tg', toolName: 'Pan', mode: 'Passive' });
    expect(result.current).toBeUndefined();
  });

  test('an event that leaves the answer unchanged does not re-render', () => {
    groups.set('vp', { active: 'Zoom' });
    let renders = 0;
    renderHook(() => {
      renders++;
      return useActiveTool('vp');
    });
    const before = renders;

    fire(Enums.Events.TOOL_ACTIVATED, { toolGroupId: 'other', toolName: 'Length' });
    expect(renders).toBe(before);
  });

  test('two consumers share one Binding; the last one leaving releases it', () => {
    groups.set('vp', { active: 'Zoom' });
    const a = renderHook(() => useActiveTool('vp'));
    const b = renderHook(() => useActiveTool('vp'));
    expect(activeToolBindings.size).toBe(1);
    expect(a.result.current).toBe('Zoom');
    expect(b.result.current).toBe('Zoom');

    a.unmount();
    expect(activeToolBindings.size).toBe(1);
    b.unmount();
    expect(activeToolBindings.size).toBe(0);
  });
});
