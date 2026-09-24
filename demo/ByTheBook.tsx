import { useEffect, useMemo, useState } from 'react';
import { Catch, Code, Panel, Steps, region, useCopy } from './ui';
import { CtViewport, useAutoScroll } from './CtViewport';
import { HalfSlider } from './half-slider';
import { SliceAndTotal } from './two-values';
import { SliderByEvents, EVENTS_SUBSCRIBE } from './slider-by-events';
import { clearSnapshotLog } from './snapshot-log';
import { slowImageIds } from './cornerstone';
import { cache } from '@cornerstonejs/core';
import source from './one-number.tsx?raw';
import twoValuesSource from './two-values.tsx?raw';

const VIEWPORT_ID = 'demo-book';
const SOURCE = source.trim();
const STEPS = 5;

// A production React build ships error #185 as a bare code, so the page says
// what failed in words and links React's own page for it.
const minifiedCode = (message: string) => /Minified React error #(\d+)/.exec(message)?.[1];

/**
 * The reader builds the thing themselves here, and hits both walls with their
 * own hands. Panel 3 only has to explain what they already felt — it neither
 * stages the failure nor mentions the library.
 */
export function ByTheBook({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel2;
  const common = useCopy().common;
  const [step, setStep] = useState(0);
  // A key, not a flag: remounting is what re-runs the crash.
  const [run, setRun] = useState(0);

  // Every slice here arrives late on purpose — step 5 is a control bound to
  // load completion, and on a fast connection there would be nothing to see.
  // Steps 1-3 are unaffected: the readout tracks the image, and the image is
  // what is late, so they stay in step.
  const slow = useMemo(() => slowImageIds(imageIds), [imageIds]);

  // Step 3 is the claim "it works", so the image has to be moving.
  useAutoScroll(VIEWPORT_ID, step === 2);

  // Cached slices skip the loader, so a warm cache hides the whole of step 5.
  useEffect(() => {
    if (step === 4) cache.purgeCache();
  }, [step]);

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead} alt>
      <div className="stage">
        <div className="stage__image">
          <CtViewport
            viewportId={VIEWPORT_ID}
            imageIds={slow}
            showOverlay={false}
            control={
              step === 4 ? (
                <SliderByEvents viewportId={VIEWPORT_ID} />
              ) : (
                <HalfSlider viewportId={VIEWPORT_ID} />
              )
            }
            failed={step === 3 ? <span className="vp__failed__text">{t.crashed}</span> : undefined}
          />
          <p className="stage__note">{t.slowNote}</p>
        </div>
        <div className="focus">
          {step === 0 && (
            <Code
              theme={theme}
              title="demo/one-number.tsx"
              code={SOURCE}
              mark="useSyncExternalStore(subscribe"
            />
          )}

          {step === 1 && <RuleBox />}

          {step === 2 && (
            <Code
              theme={theme}
              title="demo/one-number.tsx"
              code={SOURCE}
              mark="?.getSliceIndex(),"
            />
          )}

          {step === 3 && (
            <div className="focus__stack">
              {/* `run` is a remount key: Start over has to re-run the loop. */}
              <Catch key={run} fallback={(error) => <Crash error={error} />}>
                <SliceAndTotal viewportId={VIEWPORT_ID} />
              </Catch>
              <Code
                theme={theme}
                title="demo/two-values.tsx"
                code={region(twoValuesSource, 'snapshot').trim()}
                mark="return { slice:"
              />
            </div>
          )}

          {step === 4 && (
            <div className="focus__stack">
              <div className="lab__foot">
                <div className="lab__controls">
                  <PurgeButton />
                  <p className="lab__note">{t.drag}</p>
                </div>
              </div>
              <Code
                theme={theme}
                title="demo/slider-by-events.tsx"
                code={EVENTS_SUBSCRIBE}
                mark="Enums.Events.STACK_NEW_IMAGE, onChange"
              />
            </div>
          )}
        </div>
      </div>

      <div className="stepbar">
        <Steps
          count={STEPS}
          index={step}
          caption={t.captions[step]}
          next={common.next}
          restart={common.restart}
          onNext={() => setStep((n) => n + 1)}
          onRestart={() => {
            setStep(0);
            setRun((n) => n + 1);
            clearSnapshotLog();
          }}
        />
        {step === STEPS - 1 && (
          <div className="verdict verdict--bad">
            <div className="verdict__text">{t.verdict}</div>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Empties the Engine's image cache, so the next drag runs the cold path again. */
function PurgeButton() {
  const t = useCopy().panel2;
  const [purged, setPurged] = useState(false);

  return (
    <button
      className="button button--secondary button--sm purge"
      onClick={() => {
        cache.purgeCache();
        setPurged(true);
      }}
    >
      {purged ? t.purged : t.purge}
    </button>
  );
}

/** React's contract for getSnapshot — the rule the next step breaks. */
function RuleBox() {
  const t = useCopy().panel2.rules;
  return (
    <div className="probe">
      <p className="probe__title">{t.title}</p>
      <ol className="rules">
        {t.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </div>
  );
}

function Crash({ error }: { error: Error }) {
  const t = useCopy().panel2;
  const code = minifiedCode(error.message);
  return (
    <div className="crash">
      <p className="crash__message">{error.message}</p>
      <p className="crash__fact">{t.fact}</p>
      {code && (
        <a
          className="crash__link"
          href={`https://react.dev/errors/${code}`}
          target="_blank"
          rel="noreferrer"
        >
          {t.decode} → react.dev/errors/{code}
        </a>
      )}
    </div>
  );
}
