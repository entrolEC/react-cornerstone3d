import { useEffect, useRef, useState } from 'react';
import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useViewportState } from 'react-cornerstone3d';
import { Panel, Steps, useCopy } from './ui';
import { CtViewport } from './CtViewport';
import { LogView, type LogLine } from './LogView';

const VIEWPORT_ID = 'demo-snapshot';
const STEPS = 3;

/**
 * The answer to panel 3, and the proof that it is one.
 *
 * Step 1 runs panel 3's log again with the hook in place: the same table, and
 * this time the id column stops moving. Panel 3's A B C against this panel's
 * A A A is the strongest single scene the page has, and splitting the two
 * across a panel boundary is fine as long as the table looks identical.
 *
 * Step 2 is the part you cannot see by reading: a selector re-renders less,
 * and "less" is a number.
 */
export function Panel4({ imageIds, theme: _theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel4;
  const common = useCopy().common;
  const [step, setStep] = useState(0);

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead} alt>
      {/* One log per step. Stacking both put the panel at 1169px and buried
          the second one, which is the half that carries the point. */}
      {step < 2 && (
        <div className="stage">
          <div className="stage__image">
            <CtViewport viewportId={VIEWPORT_ID} imageIds={imageIds} showOverlay={false} />
            <p className="stage__note">{step === 0 ? t.dragNote : t.holdNote}</p>
          </div>
          <div className="focus">
            {step === 0 ? (
              <HookDragLog viewportId={VIEWPORT_ID} />
            ) : (
              <SameWrite viewportId={VIEWPORT_ID} />
            )}
          </div>
        </div>
      )}

      {step === 2 && <SelectorCost imageIds={imageIds} />}

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

/** The identity of every object the hook hands this component, as it happens. */
function useHookLog(viewportId: string) {
  const state = useViewportState(viewportId);
  const lines = useRef<LogLine[]>([]);
  const ids = useRef(new Map<object, number>());
  // The render that exists only to paint the previous line is not a render the
  // app asked for. Logging it would log the logger, and printing on every
  // render is the infinite loop this panel is about.
  const painting = useRef(false);
  const [, bump] = useState(0);

  useEffect(() => {
    if (painting.current) {
      painting.current = false;
      return;
    }
    if (!state) return;
    let id = ids.current.get(state);
    if (id === undefined) {
      id = ids.current.size + 1;
      ids.current.set(state, id);
    }
    lines.current = [...lines.current, { id, value: print(state) }].slice(-MAX_LINES);
    painting.current = true;
    bump((n) => n + 1);
  });

  return { lines: lines.current, objects: ids.current.size };
}

/** Step 4: the value changes, so the object does. */
function HookDragLog({ viewportId }: { viewportId: string }) {
  const t = useCopy().panel4.identity;
  const { lines, objects } = useHookLog(viewportId);

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

/**
 * Step 2: a write that changes nothing still makes the Engine fire, and React
 * is never asked.
 *
 * `setCamera(viewport.getCamera())` dispatches CAMERA_MODIFIED — one of the
 * five events the Binding listens to — while every value in the Snapshot stays
 * exactly where it was. Measured: three presses, three CAMERA_MODIFIED, slice
 * and voiRange and camera position all identical afterwards. (The other two
 * obvious nudges are silent: CS3D fires nothing for setProperties with the
 * same voiRange, or setImageIdIndex with the current index.)
 *
 * This used to be a log with a "record from here" button that armed once and
 * disarmed on the first line, so the card sat still no matter what the reader
 * did — including moving the slider, which is the first thing anyone tries.
 * Nothing was being shown. What makes the absence visible is a number that
 * climbs beside one that does not.
 *
 * The button was called "shake the Engine", which is a metaphor this codebase
 * made up. It is a write, and CONTEXT.md already has a word for that — a
 * Command — so the label says what it does with the vocabulary the rest of the
 * page uses.
 */
function SameWrite({ viewportId }: { viewportId: string }) {
  const t = useCopy().panel4.sameWrite;
  return (
    <div className="samewrite">
      <div className="samewrite__row">
        <button
          className="button button--primary button--sm"
          onClick={() => {
            const viewport = getEnabledElementByViewportId(viewportId)?.viewport as
              | Types.IViewport
              | undefined;
            if (!viewport) return;
            // The same camera, handed straight back. A fresh object with
            // identical values — which is the Engine's whole habit.
            viewport.setCamera(viewport.getCamera());
            viewport.render();
          }}
        >
          {t.nudge}
        </button>
        <p className="samewrite__hint">{t.hint}</p>
      </div>
      <div className="samewrite__meters">
        {/* Each counter is its own component. Counting engine events
            re-renders whatever holds that number, and if the two shared a
            component the event count would drive the render count it is being
            compared against. */}
        <EngineCount viewportId={viewportId} />
        <ReadCount viewportId={viewportId} />
      </div>
      <p className="samewrite__verdict">{t.verdict}</p>
    </div>
  );
}

/**
 * Both counters start measuring once the viewport has settled. Opening the
 * step costs a rebuild or two of its own — the camera reset after setStack —
 * and those are real notifications, but they are not what the reader came to
 * see. Counting from the same moment on both sides is what makes the pair
 * comparable at all.
 */
const SETTLE_MS = 800;

function useSettled() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), SETTLE_MS);
    return () => clearTimeout(id);
  }, []);
  return ready;
}

/** What the Engine emitted — counted live, not quoted. */
function EngineCount({ viewportId }: { viewportId: string }) {
  const t = useCopy().panel4.sameWrite;
  const [events, setEvents] = useState(0);
  const ready = useSettled();

  useEffect(() => {
    if (!ready) return;
    const element = getEnabledElementByViewportId(viewportId)?.viewport?.element;
    if (!element) return;
    const count = () => setEvents((n) => n + 1);
    for (const type of ENGINE_EVENTS) element.addEventListener(type, count);
    return () => {
      for (const type of ENGINE_EVENTS) element.removeEventListener(type, count);
    };
  }, [viewportId, ready]);

  return <Tally label={t.engine} value={events} tone="bad" />;
}

/**
 * What reached React. Not a render count: StrictMode doubles those and mounting
 * costs a couple of its own, so a card that opens on "4" makes "it did not
 * move" something the reader has to take on trust. Counting distinct Snapshots
 * instead starts at zero by construction — the first one is the baseline, and
 * every later one is a time the hook told React something changed.
 */
function ReadCount({ viewportId }: { viewportId: string }) {
  const t = useCopy().panel4.sameWrite;
  const state = useViewportState(viewportId);
  const ready = useSettled();
  const seen = useRef(new Map<object, number>());
  // Whatever arrived while the viewport was settling is the baseline, not a
  // finding. The Snapshot on screen when the window opens becomes #1.
  if (!ready) seen.current = new Map();
  if (state && !seen.current.has(state)) seen.current.set(state, seen.current.size + 1);

  const told = Math.max(0, seen.current.size - 1);
  return (
    <Tally
      label={t.renders}
      value={told}
      tone="ok"
      suffix={state ? ` · #${seen.current.get(state)}` : ''}
    />
  );
}

function Tally({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'bad';
  suffix?: string;
}) {
  return (
    <div className={`tally tally--${tone}`}>
      <span className="tally__value">
        {value}
        {suffix && <i>{suffix}</i>}
      </span>
      <span className="tally__label">{label}</span>
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
  const t = useCopy().panel4.identity;
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


/** Counts how many times a hook actually re-rendered its component. */
function useRenderCount() {
  const count = useRef(0);
  count.current += 1;
  return count.current;
}

/** Reads one number through a selector — a camera move must not reach it. */
function Narrow({ viewportId }: { viewportId: string }) {
  const slice = useViewportState(viewportId, (s) => s.sliceIndex);
  const t = useCopy().panel4.cost;
  return <Meter label={t.withSelector} value={slice} renders={useRenderCount()} tone="ok" />;
}

/** Reads the whole snapshot — every change to any part of it lands here. */
function Wide({ viewportId }: { viewportId: string }) {
  const state = useViewportState(viewportId);
  const t = useCopy().panel4.cost;
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
  const t = useCopy().panel4.cost;
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
  const t = useCopy().panel4.cost;
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
