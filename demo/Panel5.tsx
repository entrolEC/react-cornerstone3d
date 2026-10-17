import { useMemo, useState } from 'react';
import { cache } from '@cornerstonejs/core';
import { Cite, Code, Panel, Steps, useCopy } from './ui';
import { CtViewport } from './CtViewport';
import { slowImageIds } from './cornerstone';
import { SliderByEvents, EVENTS_SUBSCRIBE } from './slider-by-events';
import { Diagram } from './Diagram';
import { Fields } from './Fields';
import {
  CACHE_BRANCH,
  CS3D_SCROLL_PERMALINK,
  OHIF_SCARS,
  OHIF_SLIDER_CODE,
} from './citations';

const VIEWPORT_ID = 'demo-wall';
const STEPS = 3;

/**
 * The hinge. Panels 1-4 answered "how do I read Engine state"; this one starts
 * from the question they leave behind — *which* event, and *when* — and that
 * question is the reason there is a library at all rather than a snippet.
 *
 * It opens on a wall rather than an answer. Three panels of resolution in a
 * row is the shape the previous rewrite diagnosed as the reason readers
 * finished the page asking "so what was the problem again".
 */
export function Panel5({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel5;
  const common = useCopy().common;
  const [step, setStep] = useState(0);

  // This step loads its own copies of the series so the slow profile applies
  // here and nowhere else.
  const slow = useMemo(() => slowImageIds(imageIds), [imageIds]);

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead} alt>
      {step === 0 && <Wall imageIds={slow} theme={theme} />}
      {/* The OHIF evidence sits with "the library decides this", not with the
          wall. Step 1 is for feeling the lag; one piece of evidence under it
          is enough, and two folded blocks side by side only ask the reader to
          choose between them. */}
      {step === 1 && (
        <>
          <Diagram />
          <Scars theme={theme} />
        </>
      )}
      {step === 2 && <Fields />}

      <div className="stepbar">
        <Steps
          count={STEPS}
          index={step}
          caption={t.captions[step]}
          next={common.next}
          restart={common.restart}
          onNext={() => setStep((n) => n + 1)}
          onRestart={() => setStep(0)}
        />
        {step === STEPS - 1 && (
          <div className="verdict verdict--ok">
            <div className="verdict__text">{t.verdict}</div>
          </div>
        )}
      </div>
    </Panel>
  );
}

/**
 * The slider from panel 3, finished: two primitives, so `Object.is` settles
 * and nothing loops. It is correct React and it still does not follow your
 * finger, because the event whose name matches "the slice changed" is the one
 * the Engine fires only after the image has finished loading.
 */
function Wall({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel5.wall;
  const [purged, setPurged] = useState(false);

  return (
    <div className="stage">
      <div className="stage__image">
        <CtViewport
          viewportId={VIEWPORT_ID}
          imageIds={imageIds}
          showOverlay={false}
          control={<SliderByEvents viewportId={VIEWPORT_ID} />}
        />
        <p className="stage__note">{t.slowNote}</p>
      </div>

      <div className="focus">
        <div className="focus__stack">
          <div className="lab__foot">
            <div className="lab__controls">
              <button
                className="button button--secondary button--sm purge"
                onClick={() => {
                  cache.purgeCache();
                  setPurged(true);
                }}
              >
                {purged ? t.purged : t.purge}
              </button>
            </div>
          </div>
          <Code
            theme={theme}
            title="demo/slider-by-events.tsx"
            code={EVENTS_SUBSCRIBE}
            mark="Enums.Events.STACK_NEW_IMAGE, onChange"
          />
          <details className="fold">
            <summary>{t.seeSource}</summary>
            <div className="fold__body fold__body--flush">
              <Cite what={t.cite.cs3d} href={CS3D_SCROLL_PERMALINK}>
                <pre className="cite__code">{CACHE_BRANCH}</pre>
              </Cite>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

/**
 * OHIF's own words at the places where these files fight the platform. The
 * point is that the problem is hard, not that the project is careless — the
 * largest viewer in this field is wiring the same slider to the same event.
 */
function Scars({ theme }: { theme: 'light' | 'dark' }) {
  const t = useCopy().panel5.wall;
  return (
    <details className="fold">
      <summary>{t.scarsTitle}</summary>
      <div className="fold__body">
        <Code theme={theme} title={t.cite.ohif} code={OHIF_SLIDER_CODE} />
        <div className="scars">
          {OHIF_SCARS.map((scar) => (
            <div className="scar" key={scar.where}>
              <div className="scar__head">
                <code className="scar__code">{scar.code}</code>
                <a className="scar__where" href={scar.href} target="_blank" rel="noreferrer">
                  {scar.where}
                </a>
              </div>
              <p className="scar__quote">“{scar.quote}”</p>
            </div>
          ))}
          <p className="scars__end">{t.scarsEnd}</p>
        </div>
      </div>
    </details>
  );
}
