import { useViewportState } from 'react-cornerstone3d';

// One call, one shared Snapshot: the slice and the camera come out of the same
// read, and the reference only changes when the state actually does.
export function WholeState({ viewportId }: { viewportId: string }) {
  const state = useViewportState(viewportId);

  if (!state) return <span className="ind ind--empty">—</span>;
  return (
    <span className="ind ind--small">
      {(state.sliceIndex ?? 0) + 1} / {state.numberOfSlices}
      <br />
      zoom {Math.round(state.camera.parallelScale ?? 0)}
    </span>
  );
}
