import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createScheduler, type Scheduler } from './scheduler';

// Each test gets its own queue: the shared instance's state would otherwise
// leak between tests, and each test's fake clock is discarded with it.
let scheduler: Scheduler;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  scheduler = createScheduler();
});

afterEach(() => {
  vi.useRealTimers();
});

const nextFrame = () => vi.advanceTimersToNextFrame();

describe('scheduler', () => {
  test('every update scheduled in a frame runs in that frame, in one pass', () => {
    const calls: string[] = [];
    scheduler.schedule(() => calls.push('a'));
    scheduler.schedule(() => calls.push('b'));
    scheduler.schedule(() => calls.push('c'));
    expect(calls).toEqual([]); // nothing before the frame

    nextFrame();
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  test('the same update scheduled several times runs once', () => {
    const update = vi.fn();
    scheduler.schedule(update);
    scheduler.schedule(update);
    scheduler.schedule(update);

    nextFrame();
    expect(update).toHaveBeenCalledTimes(1);
  });

  test('an unscheduled update does not run; emptying the queue cancels the frame', () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const update = vi.fn();
    scheduler.schedule(update);
    scheduler.unschedule(update);

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    nextFrame();
    expect(update).not.toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  test('unscheduling one of several keeps the frame for the rest', () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const a = vi.fn();
    const b = vi.fn();
    scheduler.schedule(a);
    scheduler.schedule(b);
    scheduler.unschedule(a);

    expect(cancelSpy).not.toHaveBeenCalled();
    nextFrame();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    cancelSpy.mockRestore();
  });

  test('an update unscheduled during the drain does not run', () => {
    // update#1's notify unmounts a consumer whose Binding detaches and
    // unschedules update#2 — already in the drain's copy of the queue.
    const b = vi.fn();
    const a = vi.fn(() => scheduler.unschedule(b));
    scheduler.schedule(a);
    scheduler.schedule(b);

    nextFrame();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  test('an update scheduled during the drain runs in the next frame, not this one', () => {
    const late = vi.fn();
    const a = vi.fn(() => scheduler.schedule(late));
    scheduler.schedule(a);

    nextFrame();
    expect(a).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();

    nextFrame();
    expect(late).toHaveBeenCalledTimes(1);
  });

  test('a throwing update does not stop the others; the error resurfaces asynchronously', () => {
    const deferred: Array<() => void> = [];
    const microtaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation((cb) => void deferred.push(cb as () => void));
    const failure = new Error('rebuild failed');
    const a = vi.fn(() => {
      throw failure;
    });
    const b = vi.fn();
    scheduler.schedule(a);
    scheduler.schedule(b);

    expect(nextFrame).not.toThrow();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(deferred).toHaveLength(1);
    expect(deferred[0]).toThrow(failure); // not swallowed
    microtaskSpy.mockRestore();
  });

  test('rescheduling after a drained frame requests a new frame', () => {
    const update = vi.fn();
    scheduler.schedule(update);
    nextFrame();
    scheduler.schedule(update);
    nextFrame();

    expect(update).toHaveBeenCalledTimes(2);
  });
});
