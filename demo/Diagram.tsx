import { useCopy } from './ui';

/**
 * What the library carries, in three materials.
 *
 * The first version was six identical rounded boxes in an SVG, with three
 * tracked all-caps column headers — the label treatment this page threw out on
 * purpose, and a card grid it never uses. It also ran English straight out of
 * its boxes, because SVG text does not wrap.
 *
 * So: HTML, and weight carries the meaning the way it does everywhere else
 * here. The Engine is the sunken well the code blocks are made of — not ours.
 * The library is the one thing on white with a rule over it. React is an
 * outline, a destination rather than a mechanism. No shadows: the viewport is
 * the only object on this page that casts one.
 *
 * Placement is explicit rather than flowed. A wire has to meet the box it
 * names, and letting three columns of unequal height decide that put every
 * arrow a few dozen pixels off the thing it pointed at. Two rows, five
 * columns, and each wire sits in the row it belongs to.
 *
 * DOM order is the reading order; the wires are decoration and sit out of it.
 */
export function Diagram() {
  const t = useCopy().panel5.diagram;

  return (
    <figure className="dgm">
      <div className="dgm__grid">
        <h4 className="dgm__where dgm__at--engine">{t.engine}</h4>
        <div className="dgm__well dgm__at--getters">
          <p className="dgm__name">{t.getters}</p>
          <code>getSliceIndex()</code>
          <code>getCamera()</code>
          <p className="dgm__aside">{t.gettersNote}</p>
        </div>
        <div className="dgm__well dgm__at--events">
          <p className="dgm__name">{t.events}</p>
          <code>STACK_NEW_IMAGE</code>
          <code>CAMERA_MODIFIED</code>
          <code>VOI_MODIFIED</code>
        </div>

        <h4 className="dgm__where dgm__where--core dgm__at--lib">react-cornerstone3d</h4>
        {/* One slab, not two boxes: this is one library, and the notify wire
            should leave from one place. */}
        <div className="dgm__slab dgm__at--binding">
          <p className="dgm__name">
            Binding <span className="dgm__key">{t.bindingKey}</span>
          </p>
          <dl className="dgm__steps">
            <dt>
              <code>build(prev)</code>
            </dt>
            <dd>{t.build}</dd>
            <dt>
              <code>equal?</code>
            </dt>
            {/* The finding, marked the way the code panels mark the line that
                matters — a soft fill behind a rule, not a fill-in. */}
            <dd className="dgm__found">{t.equal}</dd>
          </dl>
          <p className="dgm__part">
            Snapshot <span>{t.snapshot}</span>
          </p>
          <p className="dgm__part">
            {t.queue} <span>{t.queueNote}</span>
          </p>
        </div>

        <h4 className="dgm__where dgm__at--react">React</h4>
        <div className="dgm__out dgm__at--hook">
          <code>useViewportState(id, sel?)</code>
          <p className="dgm__aside">{t.hook}</p>
        </div>
        <div className="dgm__out dgm__at--component">
          <p className="dgm__name">{t.component}</p>
          <p className="dgm__aside">{t.componentNote}</p>
        </div>

        <span className="dgm__wire dgm__wire--dashed dgm__at--read" aria-hidden>
          {t.read}
        </span>
        <span className="dgm__wire dgm__at--fire" aria-hidden>
          {t.fire}
        </span>
        <span className="dgm__wire dgm__at--notify" aria-hidden>
          {t.notify}
        </span>
      </div>
      <figcaption>{t.caption}</figcaption>
    </figure>
  );
}
