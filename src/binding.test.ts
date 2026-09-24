import { describe, expect, test, vi } from 'vitest';
import { createBinding, createRegistry, deepFreeze } from './binding';

// A Binding over a mutable "engine" cell: build reads it, attach/detach are spies.
function cellBinding(cell: { value: number }) {
  const attach = vi.fn();
  const detach = vi.fn();
  const binding = createBinding<number | undefined>(() => ({
    build: () => cell.value,
    attach,
    detach,
  }));
  return { binding, attach, detach };
}

describe('createBinding', () => {
  test('reads the Engine once at creation, so the first render already has a value', () => {
    const { binding } = cellBinding({ value: 3 });
    expect(binding.getSnapshot()).toBe(3);
  });

  test('attaches on the first consumer and detaches on the last, once each', () => {
    const { binding, attach, detach } = cellBinding({ value: 0 });
    const offA = binding.subscribe(() => {});
    const offB = binding.subscribe(() => {});
    expect(attach).toHaveBeenCalledTimes(1);

    offA();
    expect(detach).not.toHaveBeenCalled();
    offB();
    expect(detach).toHaveBeenCalledTimes(1);
  });

  test('the same callback subscribed twice counts twice, and off is idempotent', () => {
    const { binding, detach } = cellBinding({ value: 0 });
    const onChange = vi.fn();
    const offA = binding.subscribe(onChange);
    const offB = binding.subscribe(onChange);

    offA();
    offA(); // a second call must not detach on behalf of B
    expect(detach).not.toHaveBeenCalled();
    offB();
    expect(detach).toHaveBeenCalledTimes(1);
  });

  test('update rebuilds and notifies only when the Snapshot changed', () => {
    const cell = { value: 1 };
    let self!: { update: () => void };
    const binding = createBinding<number | undefined>((live) => {
      self = live;
      return { build: () => cell.value, attach: () => {}, detach: () => {} };
    });
    const onChange = vi.fn();
    binding.subscribe(onChange);

    self.update(); // unchanged
    expect(onChange).not.toHaveBeenCalled();

    cell.value = 2;
    self.update();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(binding.getSnapshot()).toBe(2);
  });

  test('a custom equal can call two different values the same and skip notify', () => {
    const cell = { value: { n: 1 } };
    let self!: { update: () => void };
    const binding = createBinding<{ n: number } | undefined>((live) => {
      self = live;
      return {
        build: () => ({ ...cell.value }),
        equal: (a, b) => a?.n === b?.n,
        attach: () => {},
        detach: () => {},
      };
    });
    const onChange = vi.fn();
    binding.subscribe(onChange);
    const before = binding.getSnapshot();

    self.update();
    expect(onChange).not.toHaveBeenCalled();
    expect(binding.getSnapshot()).toBe(before); // the old Snapshot stays
  });

  test('set replaces the Snapshot without reading the Engine and notifies if it changed', () => {
    let self!: { set: (v: number | undefined) => void };
    const binding = createBinding<number | undefined>((live) => {
      self = live;
      return { build: () => 5, attach: () => {}, detach: () => {} };
    });
    const onChange = vi.fn();
    binding.subscribe(onChange);

    self.set(undefined);
    expect(binding.getSnapshot()).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
    self.set(undefined);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('build receives the Snapshot being replaced, for structural sharing', () => {
    const seen: unknown[] = [];
    let self!: { update: () => void };
    let n = 0;
    createBinding<number | undefined>((live) => {
      self = live;
      return {
        build: (prev) => {
          seen.push(prev);
          return ++n;
        },
        attach: () => {},
        detach: () => {},
      };
    });
    self.update();
    expect(seen).toEqual([undefined, 1]);
  });
});

describe('createRegistry', () => {
  function numberRegistry() {
    const created: string[] = [];
    const registry = createRegistry<number | undefined>((key) => {
      created.push(key);
      return { build: () => key.length, attach: () => {}, detach: () => {} };
    });
    return { registry, created };
  }

  test('one Binding per key, shared by every acquirer', () => {
    const { registry, created } = numberRegistry();
    const a = registry.acquire('vp');
    const b = registry.acquire('vp');
    expect(a).toBe(b);
    expect(created).toEqual(['vp']);
    expect(registry.size).toBe(1);
  });

  test('the last unsubscribe evicts the Binding; the next acquire builds a fresh one', () => {
    const { registry, created } = numberRegistry();
    const first = registry.acquire('vp');
    const offA = first.subscribe(() => {});
    const offB = first.subscribe(() => {});
    offA();
    expect(registry.size).toBe(1);
    offB();
    expect(registry.size).toBe(0);

    const second = registry.acquire('vp');
    expect(second).not.toBe(first);
    expect(created).toEqual(['vp', 'vp']);
  });

  test('an evicted Binding that is subscribed again re-registers itself (StrictMode: off then on)', () => {
    const { registry } = numberRegistry();
    const binding = registry.acquire('vp');
    binding.subscribe(() => {})(); // subscribe, then unsubscribe: evicted
    expect(registry.size).toBe(0);

    binding.subscribe(() => {}); // the same hook instance re-subscribes
    expect(registry.size).toBe(1);
    expect(registry.acquire('vp')).toBe(binding); // and is the shared one again
  });

  test('a Binding that never had a consumer is not evicted by another key', () => {
    const { registry } = numberRegistry();
    registry.acquire('a');
    const b = registry.acquire('b');
    b.subscribe(() => {})();
    expect(registry.size).toBe(1);
  });
});

describe('deepFreeze', () => {
  test('freezes nested objects and arrays in place and returns the value', () => {
    const value = { a: [1, { b: 2 }], c: { d: 'x' } };
    expect(deepFreeze(value)).toBe(value);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.a)).toBe(true);
    expect(Object.isFrozen(value.a[1])).toBe(true);
    expect(Object.isFrozen(value.c)).toBe(true);
  });

  test('passes primitives and null through', () => {
    expect(deepFreeze(3)).toBe(3);
    expect(deepFreeze(null)).toBe(null);
    expect(deepFreeze(undefined)).toBe(undefined);
  });
});
