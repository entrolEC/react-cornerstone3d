import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { cache, Enums, getEnabledElementByViewportId } from '@cornerstonejs/core';
import { useViewportState } from 'react-cornerstone3d';
import { Catch, Cite, Code, Panel, Steps, useCopy } from './ui';
import { CtViewport } from './CtViewport';
import { slowImageIds } from './cornerstone';
import { SliderByEvents, EVENTS_SUBSCRIBE } from './slider-by-events';
import { SliderBySnapshot } from './slider-by-snapshot';
import { idByIdentity } from './read-many';
import { snapshotLog, subscribeSnapshotLog } from './snapshot-log';
import { SliceAndTotal } from './two-values';
import { LogView, type LogLine } from './LogView';
import {
  CACHE_BRANCH,
  CS3D_SCROLL_PERMALINK,
  OHIF_SCARS,
  OHIF_SLIDER_CODE,
  OHIF_SLIDER_PERMALINK,
} from './citations';

const VIEWPORT_ID = 'demo-wall';
const STEPS = 5;
const CALLS = 3;

/**
 * Panel 2 left the reader with two walls they hit themselves. This panel only
 * explains them — it stages nothing, and the library appears exactly once, at
 * the end, as the answer to what the explanation turned up.
 */
export function Breakdown({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel3;
  const common = useCopy().common;
  const [step, setStep] = useState(0);

  // This panel loads its own copies of the series so its network profile can
  // apply here and nowhere else.
  const slow = useMemo(() => slowImageIds(imageIds), [imageIds]);

  // The reader's slider stays up while they read why it stalls (step 2) and
  // when it finally starts following (step 4). Step 3 goes to look at somebody
  // else's codebase, so it leaves the workbench behind.
  const sliders = step === 1 || step === 3 || step === 4;

  // Arriving with a warm cache shows nothing at all: cached slices skip the
  // loader entirely. Start cold.
  useEffect(() => {
    if (sliders) cache.purgeCache();
  }, [sliders]);

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
      <div className={`stage${step === 2 ? ' stage--wide' : ''}`}>
        {step !== 2 && (
          <div className="stage__image">
            <CtViewport
              viewportId={VIEWPORT_ID}
              imageIds={slow}
              showOverlay={false}
              control={step >= 3 ? undefined : <SliderByEvents viewportId={VIEWPORT_ID} />}
            />
            <p className="stage__note">{t.slowNote}</p>
          </div>
        )}

        <div className="focus">
          {step === 0 && (
            <div className="focus__stack">
              <NaiveIdentity viewportId={VIEWPORT_ID} />
            </div>
          )}

          {step === 2 && (
            <div className="focus__stack">
              <Code
                theme={theme}
                title={t.cite.ohif}
                code={OHIF_SLIDER_CODE}
                mark="Enums.Events.STACK_NEW_IMAGE"
              />
              <Scars />
            </div>
          )}

          {sliders && (
            <div className="focus__stack">
              {step === 3 && <SliderLab viewportId={VIEWPORT_ID} withHook />}

              {step === 1 && (
                <>
                  <div className="lab__foot">
                    <div className="lab__controls">
                      <PurgeButton />
                      <p className="lab__note">{t.netNote}</p>
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
                </>
              )}

              {step === 3 && <HookDragLog viewportId={VIEWPORT_ID} />}

              {step === 4 && <HookHoldLog viewportId={VIEWPORT_ID} />}
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
 * OHIF's own comments, at the three places where those files fight the
 * platform. Their words, linked to the line — the point is that the problem is
 * hard, not that the project is careless.
 */
function Scars() {
  const t = useCopy().panel3;
  return (
    <div className="scars">
      <p className="scars__title">{t.scarsTitle}</p>
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
  );
}

/** The reader's own slider from panel 2. The library's joins it only at the end. */
function SliderLab({ viewportId, withHook }: { viewportId: string; withHook: boolean }) {
  const t = useCopy().panel3;
  return (
    <div className="lab">
      <div className="lab__row">
        <span className="lab__name">
          {t.bookTitle} <span className="badge badge--bad">{t.bookBadge}</span>
        </span>
        <SliderByEvents viewportId={viewportId} />
      </div>
      {withHook && (
        <div className="lab__row">
          <span className="lab__name">
            {t.hookTitle} <span className="badge badge--ok">{t.hookBadge}</span>
          </span>
          <SliderBySnapshot viewportId={viewportId} />
        </div>
      )}
      <div className="lab__foot">
        <div className="lab__controls">
          <PurgeButton />
        </div>
      </div>
    </div>
  );
}

/**
 * Empties the Engine's image cache, so the next drag runs the cold path again.
 */
function PurgeButton() {
  const t = useCopy().panel3;
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

/**
 * Not a staged experiment: this is what React was actually handed while the
 * component the reader broke in panel 2 was looping. If they skipped that,
 * the card offers to run it here.
 */
function NaiveIdentity({ viewportId }: { viewportId: string }) {
  const t = useCopy().panel3.identity;
  const [replay, setReplay] = useState(0);
  const { handed, renders } = useSyncExternalStore(subscribeSnapshotLog, snapshotLog);

  if (handed.length === 0) {
    return (
      <div className="ident">
        <p className="ident__title">{t.noRun}</p>
        {replay === 0 ? (
          <button className="button button--primary button--sm" onClick={() => setReplay(1)}>
            {t.replay}
          </button>
        ) : (
          // Mounting it is what fills the log; its output is beside the point.
          <Catch key={replay} fallback={() => <span className="ident__aside">{t.ran}</span>}>
            <SliceAndTotal viewportId={viewportId} />
          </Catch>
        )}
      </div>
    );
  }

  const ids = idByIdentity(handed);
  const lines = (handed as readonly { slice: number; total: number }[]).map((value, i) => ({
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

/** The identity of every object the hook hands this component, as it happens. */
function useHookLog(viewportId: string, mode: 'drag' | 'hold') {
  const state = useViewportState(viewportId);
  const lines = useRef<LogLine[]>([]);
  const ids = useRef(new Map<object, number>());
  // The render that exists only to paint the previous line is not a render the
  // app asked for. Logging it would log the logger, and printing on every
  // render is the infinite loop this panel is about.
  const painting = useRef(false);
  const armed = useRef(mode === 'drag');
  const [, bump] = useState(0);

  useEffect(() => {
    if (painting.current) {
      painting.current = false;
      return;
    }
    if (!state || !armed.current) return;
    if (mode === 'hold') armed.current = false;
    let id = ids.current.get(state);
    if (id === undefined) {
      id = ids.current.size + 1;
      ids.current.set(state, id);
    }
    lines.current = [...lines.current, { id, value: print(state) }].slice(-MAX_LINES);
    painting.current = true;
    bump((n) => n + 1);
  });

  return {
    lines: lines.current,
    objects: ids.current.size,
    record: () => {
      armed.current = true;
      bump((n) => n + 1);
    },
  };
}

/** Step 4: the value changes, so the object does. */
function HookDragLog({ viewportId }: { viewportId: string }) {
  const t = useCopy().panel3.identity;
  const { lines, objects } = useHookLog(viewportId, 'drag');

  return (
    <div className="ident ident--ok">
      <p className="ident__title">{t.hookTitle}</p>
      <LogView
        call={`console.log(useViewportState('${viewportId}'))`}
        lines={lines}
        tone="ok"
        empty={t.empty}
        count={t.objects(objects)}
        // Its own component: counting engine events re-renders whatever holds
        // that number, and if that were this card the count would change the
        // log it sits under.
        foot={<EngineMeter viewportId={viewportId} />}
      />
    </div>
  );
}

/** Step 5: the value does not change, so the object does not either. */
function HookHoldLog({ viewportId }: { viewportId: string }) {
  const t = useCopy().panel3.identity;
  const { lines, objects, record } = useHookLog(viewportId, 'hold');

  return (
    <div className="ident ident--ok">
      <p className="ident__title">{t.holdTitle}</p>
      <LogView
        call={`console.log(useViewportState('${viewportId}'))`}
        lines={lines}
        tone="ok"
        empty={t.empty}
        count={t.objects(objects)}
        foot={
          <button className="button button--primary button--sm" onClick={record}>
            {t.hold}
          </button>
        }
      />
      <p className="ident__verdict">{t.hookVerdict}</p>
    </div>
  );
}

/**
 * What the Engine actually emits, counted live rather than quoted. One slice
 * change is a burst of these; the hook turns the burst into the handful of
 * objects the log above is showing.
 */
const ENGINE_EVENTS = [
  Enums.Events.PRE_STACK_NEW_IMAGE,
  Enums.Events.STACK_NEW_IMAGE,
  Enums.Events.CAMERA_MODIFIED,
  Enums.Events.VOI_MODIFIED,
  Enums.Events.IMAGE_RENDERED,
];

function EngineMeter({ viewportId }: { viewportId: string }) {
  const t = useCopy().panel3.identity;
  const [events, setEvents] = useState(0);

  useEffect(() => {
    const element = getEnabledElementByViewportId(viewportId)?.viewport?.element;
    if (!element) return;
    const count = () => setEvents((n) => n + 1);
    for (const type of ENGINE_EVENTS) element.addEventListener(type, count);
    return () => {
      for (const type of ENGINE_EVENTS) element.removeEventListener(type, count);
    };
  }, [viewportId]);

  return <p className="log__note">{t.engineNote(events)}</p>;
}

const MAX_LINES = 400;

/**
 * The snapshot as a console would show it — every key, nested objects collapsed
 * to the marker devtools uses. Printing only sliceIndex and numberOfSlices hid
 * why two entries with the same slice are different objects: the hook compares
 * the whole snapshot, and the camera is in there.
 */
function print(state: {
  kind: string;
  sliceIndex: number | undefined;
  numberOfSlices: number | undefined;
}) {
  return `{ kind: '${state.kind}', sliceIndex: ${state.sliceIndex}, numberOfSlices: ${state.numberOfSlices}, voiRange: {…}, camera: {…} }`;
}

