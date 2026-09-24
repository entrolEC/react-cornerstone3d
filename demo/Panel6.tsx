import { Code, Panel, useCopy } from './ui';

/**
 * A reference panel, not a walkthrough. The five before it are stepped and
 * hands-on; this one lays the rules out flat and lets the reader scan. A flat
 * last panel is the right shape — what must not be flat is the middle, and
 * panel 5 opens on a wall for exactly that reason.
 *
 * The live render meters that used to sit in item 1 moved to panel 4, where
 * "it re-renders less" is the claim being made.
 */
export function Panel6({ theme }: { theme: 'light' | 'dark' }) {
  const t = useCopy().panel6;

  return (
    <Panel eyebrow={t.eyebrow} title={t.title} lead={t.lead} alt>
      <ol className="recs">
        {t.items.map((item, index) => (
          <li className="rec" key={item.title}>
            <h3 className="rec__title">
              <span className="rec__n">{index + 1}</span>
              {item.title}
            </h3>
            <Code theme={theme} title={item.label} code={item.code} mark={item.mark} />
            <p className="rec__body">{item.body}</p>
          </li>
        ))}
      </ol>

      <ul className="shorts">
        {t.shorts.map((short) => (
          <li className="short" key={short.title}>
            <b className="short__title">{short.title}</b>
            <p className="short__body">{short.body}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
