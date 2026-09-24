import { useRef, useState } from 'react';
import { Catch, Code, Panel, Steps, region, useCopy } from './ui';
import { CtViewport } from './CtViewport';
import { HalfSlider } from './half-slider';
import { SliceAndTotal } from './two-values';
import { LogView } from './LogView';
import { idByIdentity } from './read-many';
import oneNumberSource from './one-number.tsx?raw';
import twoValuesSource from './two-values.tsx?raw';

const VIEWPORT_ID = 'demo-store';
const STEPS = 3;
const ONE_NUMBER = oneNumberSource.trim();

/**
 * React's own answer for state outside React, and the wall it runs into here.
 *
 * The crash and its explanation live in one panel. They used to be two, which
 * is why there was a module whose whole job was carrying a log across the
 * boundary; a ref in this component does it now, because step 3 is a separate
 * render from step 2 and the ref is still there when it runs.
 */
export function Panel3({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel3;
  const common = useCopy().common;
  const [step, setStep] = useState(0);
  // A key, not a flag: re-running the loop means mounting it again.
  const [run, setRun] = useState(0);

  // What React was actually handed, in order, while the component was looping.
  // Bounded only so a runaway loop cannot grow it without limit.
  const handed = useRef<{ slice: number; total: number }[]>([]);
  const renders = useRef(0);

  const record = (value: { slice: number; total: number } | undefined) => {
    renders.current += 1;
    if (value && handed.current.length < 400) handed.current.push(value);
  };

  const restart = () => {
    setStep(0);
    setRun((n) => n + 1);
    handed.current = [];
    renders.current = 0;
  };

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
      <div className="stage">
        <div className="stage__image">
          <CtViewport
            viewportId={VIEWPORT_ID}
            imageIds={imageIds}
            showOverlay={false}
            control={step === 0 ? <HalfSlider viewportId={VIEWPORT_ID} /> : undefined}
          />
          <p className="stage__note">{t.notes[step]}</p>
        </div>

        <div className="focus">
          {step === 0 && (
            <Code
              theme={theme}
              title="demo/one-number.tsx"
              code={ONE_NUMBER}
              mark="useSyncExternalStore(subscribe"
            />
          )}

          {step === 1 && (
            <div className="focus__stack">
              <Catch key={run} fallback={(error) => <Crash error={error} />}>
                <SliceAndTotal viewportId={VIEWPORT_ID} onSnapshot={record} />
              </Catch>
              <Code
                theme={theme}
                title="demo/two-values.tsx"
                code={region(twoValuesSource, 'snapshot')}
                mark="return { slice:"
              />
            </div>
          )}

          {step === 2 && <Identity handed={handed.current} renders={renders.current} />}
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
          onRestart={restart}
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

/** A production React build ships error #185 as a bare code, so say it in words. */
const minifiedCode = (message: string) => /Minified React error #(\d+)/.exec(message)?.[1];

function Crash({ error }: { error: Error }) {
  const t = useCopy().panel3;
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

/**
 * Not a staged experiment: this is what React was handed while the component
 * the reader just broke was looping. Values identical, objects all different —
 * printed by identity, because `Object.is` is too abstract to carry it.
 */
function Identity({
  handed,
  renders,
}: {
  handed: readonly { slice: number; total: number }[];
  renders: number;
}) {
  const t = useCopy().panel3.identity;
  if (handed.length === 0) return <div className="ident">{t.noRun}</div>;

  const ids = idByIdentity(handed);
  const lines = handed.map((value, i) => ({
    id: ids[i],
    value: `{ slice: ${value.slice}, total: ${value.total} }`,
  }));

  return (
    <div className="ident">
      <p className="ident__title">{t.naiveTitle(renders)}</p>
      <LogView
        call="console.log(getSnapshot())"
        lines={lines}
        tone="bad"
        empty={t.empty}
        count={t.objects(ids.length ? Math.max(...ids) : 0)}
      />
      <p className="ident__verdict">{t.naiveVerdict}</p>
    </div>
  );
}
