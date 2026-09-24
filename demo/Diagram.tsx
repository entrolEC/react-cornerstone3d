import { useCopy } from './ui';

/**
 * What the library carries, in six boxes.
 *
 * Inline SVG rather than an exported image: the page has a language toggle and
 * a theme toggle, so a picture would be four files, and four files drift from
 * the code the moment anything changes. Every colour is a theme token and
 * every string comes from copy.tsx, so this follows both toggles for free —
 * the same reason the line counts on panel 1 are measured rather than typed.
 *
 * SVG text does not wrap, so every label here is short enough to fit its box
 * in both languages and the sentences live in the caption. The first draft put
 * prose inside the boxes and it ran straight out of them in English.
 *
 * The design source is the "Binding event map" artifact, which has twelve
 * boxes, ADR numbers and a release legend. Those are the words of a design
 * document. What is left is what a reader of panel 4 has a question about: who
 * reads the Engine, what decides that nothing changed, and what happens when
 * events arrive faster than frames.
 */
export function Diagram() {
  const t = useCopy().panel5.diagram;

  return (
    <figure className="diagram">
      <svg viewBox="0 0 960 300" role="img" aria-label={t.alt}>
        <defs>
          <marker
            id="dg-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" className="dg-head" />
          </marker>
        </defs>

        <text x="8" y="14" className="dg-col">
          {t.engine}
        </text>
        <text x="330" y="14" className="dg-col dg-col--accent">
          react-cornerstone3d
        </text>
        <text x="712" y="14" className="dg-col">
          React
        </text>

        {/* ---- Engine ---- */}
        <rect x="8" y="28" width="268" height="84" rx="6" className="dg-box" />
        <text x="24" y="50" className="dg-h">
          {t.getters}
        </text>
        <text x="24" y="72" className="dg-m sm">
          getSliceIndex() · getCamera()
        </text>
        <text x="24" y="94" className="dg-s">
          {t.gettersNote}
        </text>

        <rect x="8" y="132" width="268" height="84" rx="6" className="dg-box" />
        <text x="24" y="154" className="dg-h">
          {t.events}
        </text>
        <text x="24" y="176" className="dg-m sm">
          STACK_NEW_IMAGE
        </text>
        <text x="24" y="196" className="dg-m sm">
          CAMERA_MODIFIED · VOI_MODIFIED · …
        </text>

        {/* ---- Binding ---- */}
        <rect x="330" y="28" width="304" height="188" rx="6" className="dg-box dg-box--accent" />
        <text x="346" y="50" className="dg-h dg-h--accent">
          {t.binding}
        </text>
        <text x="346" y="76" className="dg-m">
          build(prev)
        </text>
        <text x="346" y="94" className="dg-s">
          {t.build}
        </text>
        <text x="346" y="120" className="dg-m">
          equal?
        </text>
        <text x="346" y="138" className="dg-s">
          {t.equal}
        </text>
        <rect x="346" y="156" width="272" height="44" rx="5" className="dg-box dg-box--fill" />
        <text x="362" y="174" className="dg-h">
          Snapshot
        </text>
        <text x="362" y="192" className="dg-s">
          {t.snapshot}
        </text>

        {/* ---- Scheduler ---- */}
        <rect x="330" y="236" width="304" height="56" rx="6" className="dg-box" />
        <text x="346" y="258" className="dg-h">
          {t.scheduler}
        </text>
        <text x="346" y="278" className="dg-s">
          {t.schedulerA}
        </text>

        {/* ---- React ---- */}
        <rect x="688" y="28" width="264" height="104" rx="6" className="dg-box" />
        <text x="704" y="50" className="dg-m sm">
          useViewportState(id, sel?)
        </text>
        <text x="704" y="72" className="dg-s">
          useSyncExternalStore
        </text>
        <text x="704" y="92" className="dg-s">
          {t.selector}
        </text>
        <text x="704" y="114" className="dg-s">
          {t.objectIs}
        </text>

        <rect x="688" y="164" width="264" height="52" rx="6" className="dg-box dg-box--app" />
        <text x="704" y="186" className="dg-h">
          {t.component}
        </text>
        <text x="704" y="204" className="dg-s">
          {t.componentNote}
        </text>

        {/* ---- wires ---- */}
        <path
          d="M276 70 L300 70 L300 84 L328 84"
          className="dg-wire dg-wire--dash"
          markerEnd="url(#dg-arrow)"
        />
        <text x="286" y="62" className="dg-lb">
          {t.read}
        </text>
        <path
          d="M276 174 L300 174 L300 130 L328 130"
          className="dg-wire"
          markerEnd="url(#dg-arrow)"
        />
        <text x="286" y="190" className="dg-lb">
          {t.fire}
        </text>

        {/* Binding -> scheduler -> React */}
        <line x1="482" y1="216" x2="482" y2="234" className="dg-wire" markerEnd="url(#dg-arrow)" />
        <path
          d="M634 264 L660 264 L660 80 L686 80"
          className="dg-wire dg-wire--accent"
          markerEnd="url(#dg-arrow)"
        />
        <text x="648" y="240" className="dg-lb dg-lb--accent">
          {t.notify}
        </text>

        <line x1="820" y1="132" x2="820" y2="162" className="dg-wire" markerEnd="url(#dg-arrow)" />
      </svg>
      <figcaption>{t.caption}</figcaption>
    </figure>
  );
}
