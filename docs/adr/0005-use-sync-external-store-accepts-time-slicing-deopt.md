# `useSyncExternalStore`: accept the time-slicing de-opt for tearing-freedom

The hook that bridges Engine state to React is `useSyncExternalStore`. Its "Sync" means synchronous: React reads the store during render and will not interleave with other work, which prevents tearing (two components seeing different slice numbers in the same frame) but opts the subtree out of time slicing and `useTransition` pending states — under `useTransition`, a Zustand-style store shows a Suspense fallback instead of keeping the stale tree on screen while the new one prepares (Daishi Kato, "Why useSyncExternalStore Is Not Used in Jotai"). We chose this trade-off because, in a medical viewer, a slice number that disagrees between a toolbar and a viewport is a correctness failure, not a cosmetic one; tearing-freedom outranks concurrent optimization. The rejected alternatives each avoid the de-opt but pay elsewhere:

| Strategy | Example | What it gives up |
|---|---|---|
| `useState` + `useEffect` | Jotai | Brief tearing is possible during concurrent renders — two reads in the same frame can disagree |
| Version counter | MobX (`getSnapshot() → new Symbol()`) | No object is returned; selectors must derive everything, and the version bump is unconditional |
| Proxy read tracking | Valtio `proxy-compare`, Signals | Requires a Proxy layer over every object the consumer touches; Cornerstone3D objects are not ours to wrap |
| Raw `useState`, tearing ignored | — | Tearing is accepted as a given; unsuitable when visual consistency is a safety concern |

This decision is consistent with ADR 0001: `useSyncExternalStore` enforces a read-only, Engine-to-React flow — it subscribes and reads, never writes.
