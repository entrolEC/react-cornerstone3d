import { useState } from 'react';
import { Code, Panel, useCopy, type CodeNote } from './ui';
import { CtViewport } from './CtViewport';
import { SliderByHand, BY_HAND_SOURCE, BY_HAND_WIRING } from './slider-by-hand';
import { SliderBySnapshot, HOOK_SOURCE, HOOK_WIRING } from './slider-by-snapshot';

const VIEWPORT_ID = 'demo-hero';

const lineCount = (code: string) => code.split('\n').length;

/**
 * The pitch, in one number: the same slider, wired two ways.
 *
 * The tab swaps the slider that is actually running under the image, not just
 * the code beside it — the page's strongest claim is that both of these are
 * real, and a tab that only changes a listing does not make it.
 *
 * Both work here. That is the point: if the hand-rolled one were visibly worse
 * at this stage there would be nothing left for panel 2 to reveal, and "the
 * line count is the small problem" would have nowhere to go.
 */
export function Panel1({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const t = useCopy().panel1;
  const [tab, setTab] = useState<'hook' | 'byHand'>('hook');
  const hook = tab === 'hook';

  // One word each. What each line costs you is panel 2's story; here they are
  // only counted, so the reader leaves with "there are five of these" rather
  // than a paragraph they have no reason to read yet.
  const notes: readonly CodeNote[] = [
    { at: 'if (!enabled) return', label: t.marks.mount },
    { at: 'update();', label: t.marks.first },
    { at: 'element.addEventListener', label: t.marks.pick },
    { at: 'return () => {', label: t.marks.leak },
    { at: '}, [viewportId]);', label: t.marks.resub },
  ];

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
      <div className="split">
        <div className="split__viewer">
          <CtViewport viewportId={VIEWPORT_ID} imageIds={imageIds} />
          {hook ? (
            <SliderBySnapshot viewportId={VIEWPORT_ID} />
          ) : (
            <SliderByHand viewportId={VIEWPORT_ID} />
          )}
          {/* Under the viewer, not the code. The code column is the tall one
              now, and the viewer column was sitting on 400px of nothing. */}
          <div className="note">{t.note}</div>
        </div>

        <div className="split__code">
          <div className="tabs" role="tablist">
            <button className="tab" role="tab" aria-selected={hook} onClick={() => setTab('hook')}>
              {t.tabHook} <span>{t.lines(lineCount(HOOK_WIRING))}</span>
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={!hook}
              onClick={() => setTab('byHand')}
            >
              {t.tabByHand} <span>{t.lines(lineCount(BY_HAND_WIRING))}</span>
            </button>
          </div>
          <Code
            theme={theme}
            title={hook ? 'demo/slider-by-snapshot.tsx' : 'demo/slider-by-hand.tsx'}
            code={hook ? HOOK_SOURCE : BY_HAND_SOURCE}
            notes={hook ? undefined : notes}
            dimFrom="// Everything below is the same"
            dimLabel={t.same}
          />
        </div>
      </div>
    </Panel>
  );
}
