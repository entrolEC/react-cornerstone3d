import { useRef } from 'react';
import { getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useViewportState } from 'react-cornerstone3d';
import { Code, Panel, useCopy } from './ui';
import { CtViewport } from './CtViewport';

/**
 * A reference panel, not a walkthrough: the three before it are stepped and
 * hands-on, so this one lays the recommendations out flat and lets the reader
 * scan. Only the first one needs a demo, because "it re-renders less" is the
 * one claim you cannot see by reading.
 */
export function Practices({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel4;

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead} alt>
      <ol className="recs">
        {t.items.map((item, index) => (
          <li className="rec" key={item.title}>
            <h3 className="rec__title">
              <span className="rec__n">{index + 1}</span>
              {item.title}
            </h3>
            <Code theme={theme} title={item.label} code={item.code} mark={item.mark} />
            <p className="rec__body">{item.body}</p>
            {index === 0 && <SelectorCost imageIds={imageIds} />}
          </li>
        ))}
      </ol>

      <ul className="shorts">
        {t.shorts.map((short) => (
          <li className="short" key={short.title}>
            <b className="short__title">{short.title}</b>
            <p className="short__body">{short.body}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Counts how many times a hook actually re-rendered its component. */
function useRenderCount() {
  const count = useRef(0);
  count.current += 1;
  return count.current;
}

/** Reads one number through a selector — a camera move must not reach it. */
function Narrow({ viewportId }: { viewportId: string }) {
  const slice = useViewportState(viewportId, (s) => s.sliceIndex);
  const t = useCopy().panel4;
  return <Meter label={t.withSelector} value={slice} renders={useRenderCount()} tone="ok" />;
}

/** Reads the whole snapshot — every change to any part of it lands here. */
function Wide({ viewportId }: { viewportId: string }) {
  const state = useViewportState(viewportId);
  const t = useCopy().panel4;
  return (
    <Meter label={t.withoutSelector} value={state?.sliceIndex} renders={useRenderCount()} tone="bad" />
  );
}

function Meter({
  label,
  value,
  renders,
  tone,
}: {
  label: string;
  value: number | undefined;
  renders: number;
  tone: 'ok' | 'bad';
}) {
  const t = useCopy().panel4;
  return (
    <div className="meter">
      <span className="meter__label">{label}</span>
      <span className="meter__value">{value === undefined ? '—' : value + 1}</span>
      <span className={`badge badge--${tone}`}>{t.renders(renders)}</span>
    </div>
  );
}

/**
 * Nudging the camera changes the snapshot's camera and nothing else, so the
 * selector's number stays put — and so should its render count.
 */
function SelectorCost({ imageIds }: { imageIds: string[] }) {
  const t = useCopy().panel4;
  // Its own viewport, on screen beside the meters. Nudging one four thousand
  // pixels up the page looked broken, however correct the counters were.
  const viewportId = 'demo-selector';
  // A ref, not state: state here would re-render both meters from above and
  // the counters would measure this button instead of the hooks.
  const zoomIn = useRef(true);

  return (
    <div className="cost">
      <div className="cost__stage">
        <div className="cost__vp">
          <CtViewport viewportId={viewportId} imageIds={imageIds} showOverlay={false} />
        </div>
        <div className="cost__meters">
          <Narrow viewportId={viewportId} />
          <Wide viewportId={viewportId} />
        </div>
      </div>
      <div className="cost__foot">
        <button
          className="button button--secondary button--sm"
          onClick={() => {
            const viewport = getEnabledElementByViewportId(viewportId)?.viewport as
              | Types.IStackViewport
              | undefined;
            if (!viewport) return;
            const camera = viewport.getCamera();
            // Big enough to see at a glance: a few percent moved the camera but
            // read as nothing happening, which is the same as being broken.
            viewport.setCamera({
              ...camera,
              parallelScale: (camera.parallelScale ?? 1) * (zoomIn.current ? 1 / 1.45 : 1.45),
            });
            viewport.render();
            zoomIn.current = !zoomIn.current;
          }}
        >
          {t.nudge}
        </button>
        <p className="cost__hint">{t.nudgeHint}</p>
      </div>
    </div>
  );
}
