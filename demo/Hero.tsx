import { useState } from 'react';
import { Code, Panel, useCopy } from './ui';
import { CtViewport, LoadTrack, SliceSlider } from './CtViewport';
import {
  BY_HAND_SOURCE,
  HOOK_SOURCE,
  SliceIndicator,
  SliceIndicatorByHand,
  lineCount,
} from './widgets';

const VIEWPORT_ID = 'demo-hero';

export function Hero({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel1;
  const [tab, setTab] = useState<'hook' | 'byHand'>('hook');
  const hook = tab === 'hook';

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
      <div className="split">
        <div className="split__viewer">
          <CtViewport viewportId={VIEWPORT_ID} imageIds={imageIds} />
          <SliceSlider viewportId={VIEWPORT_ID} />
          <LoadTrack viewportId={VIEWPORT_ID} />
          <p className="hint">{t.viewportHint}</p>

          <div className="card">
            <div className="card__head">
              {t.running}
              <span className={`badge badge--${hook ? 'ok' : 'bad'}`}>
                {hook ? 'useViewportState' : 'useEffect'}
              </span>
            </div>
            <div className="card__body card__body--center">
              {hook ? (
                <SliceIndicator viewportId={VIEWPORT_ID} />
              ) : (
                <SliceIndicatorByHand viewportId={VIEWPORT_ID} />
              )}
            </div>
          </div>
        </div>

        <div className="split__code">
          <div className="tabs" role="tablist">
            <button className="tab" role="tab" aria-selected={hook} onClick={() => setTab('hook')}>
              {t.tabHook} <span>{t.lines(lineCount(HOOK_SOURCE))}</span>
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={!hook}
              onClick={() => setTab('byHand')}
            >
              {t.tabByHand} <span>{t.lines(lineCount(BY_HAND_SOURCE))}</span>
            </button>
          </div>
          <Code
            theme={theme}
            title="demo/widgets.tsx"
            code={hook ? HOOK_SOURCE : BY_HAND_SOURCE}
          />
          {/* Beside the code it is about, in the height the viewer column
              already occupies — not stacked under the whole panel. */}
          <div className="note">{t.note}</div>
        </div>
      </div>
    </Panel>
  );
}
