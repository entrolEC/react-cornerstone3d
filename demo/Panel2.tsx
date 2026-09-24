import { useEffect, useState } from 'react';
import { Code, Panel, Steps, useCopy } from './ui';
import { CtViewport } from './CtViewport';
import { SliderWithSeed } from './gap';
import { SliderByHand, BY_HAND_SOURCE } from './slider-by-hand';
import { SliderBySnapshot } from './slider-by-snapshot';

const VIEWPORT_ID = 'demo-copy';
const STEPS = 3;

/**
 * What is actually in those 24 lines. Panel 1 named five places; this one gets
 * three of them wrong on purpose — and the reader is the one who does it, so
 * the cause is theirs rather than something the page staged off screen.
 *
 * Tearing is the fourth item in the README's bug layer and it is not here as a
 * demonstration: reproducing it needs concurrent rendering the demo never
 * enters. It gets a footnote and a link to ADR 0005, which is where the
 * library's reason for picking useSyncExternalStore actually lives.
 */
export function Panel2({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel2;
  const common = useCopy().common;
  const [step, setStep] = useState(0);

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead} alt>
      {step === 0 && <Gap theme={theme} imageIds={imageIds} />}
      {step === 1 && <Order imageIds={imageIds} />}
      {step === 2 && <Divergence imageIds={imageIds} />}

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
          <div className="verdict verdict--bad">
            <div className="verdict__text">{t.verdict}</div>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ---------------- 1. the seed ---------------- */

/**
 * The line is `update()`. With it the slider is right the moment it mounts;
 * without it the slider is right the moment something else happens — and on a
 * study that has finished loading, nothing else happens.
 */
function Gap({ theme, imageIds }: { theme: 'light' | 'dark'; imageIds: string[] }) {
  const t = useCopy().panel2.gap;
  const [seed, setSeed] = useState(true);

  return (
    <div className="stage">
      <div className="stage__image">
        <CtViewport viewportId={VIEWPORT_ID} imageIds={imageIds} showOverlay={false} />
        {/* Keyed on `seed`: taking the line out means mounting the component
            without it, which is the thing being shown. */}
        <SliderWithSeed key={String(seed)} viewportId={VIEWPORT_ID} seed={seed} />
        <p className="stage__note">{seed ? t.withSeed : t.withoutSeed}</p>
      </div>
      <div className="focus">
        <div className="focus__stack">
          <div className="lab__foot">
            <div className="lab__controls">
              <button
                className="button button--secondary button--sm"
                onClick={() => setSeed((on) => !on)}
              >
                {seed ? t.remove : t.restore}
              </button>
              <p className="lab__note">{t.hint}</p>
            </div>
          </div>
          <Code
            theme={theme}
            title="demo/slider-by-hand.tsx"
            code={BY_HAND_SOURCE}
            mark="update();"
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- 2. the order ---------------- */

interface Scene {
  /** Is the image on screen in this scene? */
  readonly image: boolean;
  /** Are the two sliders on screen in this scene? */
  readonly sliders: boolean;
}

/** Two orders, and the whole story is which of the two existed first. */
const STORIES: readonly { readonly imageFirst: boolean; readonly scenes: readonly Scene[] }[] = [
  // The image arrives after the UI. The commonest order there is.
  { imageFirst: false, scenes: [{ image: false, sliders: true }, { image: true, sliders: true }] },
  // The study was open and gets closed.
  { imageFirst: true, scenes: [{ image: true, sliders: true }, { image: false, sliders: true }] },
];

function Order({ imageIds }: { imageIds: string[] }) {
  const t = useCopy().panel2.order;
  const [story, setStory] = useState(0);
  const [scene, setScene] = useState(-1);
  const [run, setRun] = useState(0);

  const current = STORIES[story];
  const at = current.scenes[scene];
  const last = scene === current.scenes.length - 1;

  // Before the first scene the image sits where the story needs it and the
  // sliders do not exist yet. That one beat is the whole point: which of the
  // two was there first.
  useEffect(() => {
    setScene(-1);
    const id = setTimeout(() => setScene(0), 450);
    return () => clearTimeout(id);
  }, [story, run]);

  const image = at ? at.image : current.imageFirst;
  const sliders = at?.sliders ?? false;

  return (
    <>
      <div className="tabs" role="tablist">
        {t.tabs.map((tab, i) => (
          <button
            key={tab}
            className="tab"
            role="tab"
            aria-selected={i === story}
            onClick={() => setStory(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="stage">
        <div className="stage__image">
          {image ? (
            <CtViewport viewportId={VIEWPORT_ID} imageIds={imageIds} showOverlay={false} />
          ) : (
            <div className="vp vp--off">{t.noImage}</div>
          )}
          <p className="stage__note">{at ? t.scenes[story][scene] : t.settling}</p>
        </div>

        <div className="focus">
          <div className="lab">
            <div className="lab__row">
              <span className="lab__name">
                {t.byHand} <span className="badge badge--bad">useState</span>
              </span>
              {sliders ? <SliderByHand viewportId={VIEWPORT_ID} /> : <Waiting />}
            </div>
            <div className="lab__row">
              <span className="lab__name">
                {t.hook} <span className="badge badge--ok">useViewportState</span>
              </span>
              {sliders ? <SliderBySnapshot viewportId={VIEWPORT_ID} /> : <Waiting />}
            </div>
            <div className="lab__foot">
              <div className="lab__controls">
                <button
                  className="button button--primary button--sm"
                  disabled={!at || last}
                  onClick={() => setScene((n) => n + 1)}
                >
                  {t.nextScene}
                </button>
                <button
                  className="button button--secondary button--sm"
                  onClick={() => setRun((n) => n + 1)}
                >
                  {t.again}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Waiting() {
  const t = useCopy().panel2.order;
  return <span className="ind ind--empty">{t.notYet}</span>;
}

/* ---------------- 3. two copies, one engine ---------------- */

/**
 * The reader adds a second hand-rolled slider while the first one is running.
 * Same file, same engine, and for as long as nothing happens they disagree —
 * because each keeps its own copy and only one of them was ever filled.
 */
function Divergence({ imageIds }: { imageIds: string[] }) {
  const t = useCopy().panel2.split;
  const [extra, setExtra] = useState(0);

  return (
    <div className="stage">
      <div className="stage__image">
        <CtViewport viewportId={VIEWPORT_ID} imageIds={imageIds} showOverlay={false} />
        <p className="stage__note">{t.note}</p>
      </div>
      <div className="focus">
        <div className="lab">
          <div className="lab__row">
            <span className="lab__name">{t.first}</span>
            <SliderByHand viewportId={VIEWPORT_ID} />
          </div>
          {Array.from({ length: extra }, (_, i) => (
            <div className="lab__row" key={i}>
              <span className="lab__name">{t.late(i + 2)}</span>
              {/* Mounted now, with no seed — the state panel 1 called
                  "first render" and step 1 took the line out for. */}
              <SliderWithSeed viewportId={VIEWPORT_ID} seed={false} />
            </div>
          ))}
          <div className="lab__foot">
            <div className="lab__controls">
              <button
                className="button button--primary button--sm"
                onClick={() => setExtra((n) => n + 1)}
              >
                {t.add}
              </button>
              <p className="lab__note">{t.hint}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
