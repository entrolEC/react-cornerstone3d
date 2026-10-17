import type { ReactNode } from 'react';

/**
 * The slider with the two numbers that make it. Panel 2 spends a whole step
 * arguing that a slider is exactly `value` and `max` — so the slider shows
 * them, under the attribute names the code beside it uses.
 */
export function SliderLine({
  value,
  max,
  children,
}: {
  value: number;
  /** Undefined while the second value has not been read yet. */
  max?: number;
  /** Omitted before there is anything to read: the track holds its place, inert. */
  children?: ReactNode;
}) {
  return (
    <div className="sliderline">
      {children ?? <input className="slider" type="range" value={0} disabled readOnly />}
      <dl className="sliderline__read">
        <div>
          <dt>value</dt>
          <dd>{value}</dd>
        </div>
        <div>
          <dt>max</dt>
          <dd>{max ?? '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
