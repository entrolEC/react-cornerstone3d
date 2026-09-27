import { useCopy } from './ui';

/**
 * Why the hook gives you some things and not others.
 *
 * This was a full-bleed admin table with a tracked all-caps `GETTER` head, red
 * and green cells, and a 340px column of nothing on the left. Red said
 * something had gone wrong; nothing has. Those two values are simply not
 * fields, and an absence should read as an absence.
 *
 * So the rule is stated once, and each row is checked against it with the two
 * halves shown as what they are: a name, or a dash and the reason there is
 * none. The row that passes is the one the marker points at — the same gesture
 * the code panels use for the line that matters.
 */
export function Fields() {
  const t = useCopy().panel5.fields;

  return (
    <div className="fields">
      <p className="fields__rule">{t.rule}</p>
      <ul className="fields__list">
        {t.rows.map((row) => (
          <li className={`fields__row${row.field ? ' fields__row--in' : ''}`} key={row.name}>
            <p className="fields__what">{row.name}</p>
            {/* No column labels. `getSliceIndex()` is plainly a getter and
                `STACK_NEW_IMAGE` is plainly an event; where one is missing the
                sentence says which. Repeating the names above every cell was
                telling the reader what they can already see. */}
            <p className={`fields__half${row.hasGetter ? '' : ' fields__half--none'}`}>
              {row.hasGetter ? <code>{row.getter}</code> : row.getter}
            </p>
            <p className={`fields__half${row.hasEvent ? '' : ' fields__half--none'}`}>
              {row.hasEvent ? <code>{row.event}</code> : row.event}
            </p>
            <p className="fields__verdict">{row.result}</p>
          </li>
        ))}
      </ul>
      <p className="fields__note">{t.note}</p>
    </div>
  );
}
