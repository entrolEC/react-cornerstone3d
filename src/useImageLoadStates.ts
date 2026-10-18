import { useRef, useSyncExternalStore } from 'react';
import { sameStrings, type Binding } from './binding.js';
import { imageBindings, type ImageLoadState } from './useImageLoadState.js';

const EMPTY: readonly ImageLoadState[] = Object.freeze([]);

function sameIds(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return sameStrings(a, b);
}

// What one list of ids subscribes to. Rebuilt only when the list's content
// changes: useSyncExternalStore resubscribes whenever `subscribe` changes
// identity, and here that is N unsubscribes and N subscribes.
interface Subscription {
  readonly ids: readonly string[] | undefined;
  readonly targets: readonly Binding<ImageLoadState>[] | undefined;
  readonly subscribe: (onChange: () => void) => () => void;
  /** The server's answer for this list: no cache there, so every image is absent. */
  readonly server: readonly ImageLoadState[] | undefined;
}

const NONE: Subscription = {
  ids: undefined,
  targets: undefined,
  subscribe: () => () => {},
  server: undefined,
};

/**
 * The Image Load State of each image in a list — `useImageLoadState` for a
 * whole stack. It owns no state of its own: it reads the same per-image
 * Bindings a tick component would (ADR 0007, one Binding per key) and
 * gathers their answers into one frozen array.
 *
 * The array is replaced only when some entry changed; otherwise the previous
 * array is returned, so a consumer re-renders once per frame in which an
 * image arrived or left. `undefined` in, `undefined` out; an empty list
 * gives one stable empty array. A server render reads `'absent'` per image.
 *
 * Cost, N = list length: N subscriptions per list change, one comparison
 * pass per read. ponytail: k arrivals in one frame notify k times and each
 * notification reads all N (O(N·k), about 1ms at k = N = 1000); a dirty flag
 * per frame would make it O(N) if that ever shows.
 */
export function useImageLoadStates(
  imageIds: readonly string[] | undefined,
): readonly ImageLoadState[] | undefined {
  const sub = useRef<Subscription>(NONE);
  if (!sameIds(sub.current.ids, imageIds)) {
    if (imageIds === undefined) {
      sub.current = NONE;
    } else {
      // Bindings acquired here are the ones both subscribe and getSnapshot
      // use; acquiring again per render could hand getSnapshot a Binding the
      // subscription does not hold.
      const targets = imageIds.map((id) => imageBindings.acquire(id));
      sub.current = {
        ids: [...imageIds], // the caller may mutate theirs
        targets,
        subscribe: (onChange) => {
          const offs = targets.map((binding) => binding.subscribe(onChange));
          return () => offs.forEach((off) => off());
        },
        server:
          imageIds.length === 0 ? EMPTY : Object.freeze(imageIds.map(() => 'absent' as const)),
      };
    }
  }
  const { targets, subscribe, server } = sub.current;

  // Seeded with the server's array: a client whose images are all absent
  // returns that same array, so hydration has nothing to re-render.
  const memo = useRef<readonly ImageLoadState[]>(server ?? EMPTY);
  return useSyncExternalStore(
    subscribe,
    () => {
      if (targets === undefined) return undefined;
      if (targets.length === 0) return EMPTY;
      const prev = memo.current;
      if (
        prev.length === targets.length &&
        targets.every((binding, i) => binding.getSnapshot() === prev[i])
      ) {
        return prev;
      }
      const next = Object.freeze(targets.map((binding) => binding.getSnapshot()));
      memo.current = next;
      return next;
    },
    () => server,
  );
}
