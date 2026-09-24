import { useCopy } from './ui';

/**
 * Why the hook gives you some things and not others.
 *
 * The rule needs both halves: a getter to read the value now, and an event to
 * know it moved. Miss either one and a Snapshot field would be a lie — either
 * stale forever, or unreadable at the moment it is asked for.
 *
 * The design artifact draws this as a quadrant over the image-cache domain
 * (loading, quality, max, available, cancelled). None of those appear anywhere
 * on this page, so the rejected examples here are the two the reader has
 * already run into: the slice that had not loaded yet in panel 5's first step,
 * and the difference between "told to show" and "painted" that the slider has
 * been demonstrating since panel 1.
 */
export function Fields() {
  const t = useCopy().panel5.fields;

  return (
    <div className="fields">
      <table className="fields__table">
        <thead>
          <tr>
            <th />
            <th>{t.getter}</th>
            <th>{t.event}</th>
            <th>{t.result}</th>
          </tr>
        </thead>
        <tbody>
          {t.rows.map((row) => (
            <tr key={row.name} className={row.field ? 'fields__row--in' : 'fields__row--out'}>
              <th scope="row">{row.name}</th>
              <td className={row.hasGetter ? 'yes' : 'no'}>{row.getter}</td>
              <td className={row.hasEvent ? 'yes' : 'no'}>{row.event}</td>
              <td>{row.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fields__note">{t.note}</p>
    </div>
  );
}
