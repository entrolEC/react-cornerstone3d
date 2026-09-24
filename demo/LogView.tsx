import { useEffect, useRef, type ReactNode } from 'react';

/**
 * One printed line. `id` is the identity of the object that render was handed:
 * same object, same number. Letters ran out at F and, worse, read as a label
 * somebody chose — a number reads as what the console would show you.
 */
export interface LogLine {
  readonly id: number;
  readonly value: string;
}

/**
 * A console, because that is where a developer already reads this. Nothing is
 * folded and nothing is capped at three: the whole run is here and scrolls,
 * which is the only way "the same object came back nine times" is a thing you
 * see rather than a number you are asked to trust.
 */
export function LogView({
  call,
  lines,
  tone,
  empty,
  count,
  foot,
}: {
  /** Printed as the call that produced these lines. */
  call: string;
  lines: readonly LogLine[];
  tone: 'ok' | 'bad';
  empty: string;
  /** Right side of the header — what the run adds up to. */
  count: string;
  foot?: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);

  // A console stays on its newest line.
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div className={`log log--${tone}`}>
      <div className="log__head">
        <code className="log__call">{call}</code>
        <span className="log__count">{count}</span>
      </div>
      <div className="log__body" ref={body}>
        {lines.length === 0 ? (
          <p className="log__empty">{empty}</p>
        ) : (
          lines.map((line, i) => (
            <div className="log__line" key={i}>
              <span className="log__n">{i + 1}</span>
              <span className="log__arrow" aria-hidden>
                ▸
              </span>
              <span className={`log__id log__id--${tone}`}>#{line.id}</span>
              <code className="log__value">{line.value}</code>
            </div>
          ))
        )}
      </div>
      {foot && <div className="log__foot">{foot}</div>}
    </div>
  );
}
