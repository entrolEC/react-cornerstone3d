import { Code, Panel, useCopy } from './ui';

/**
 * A reference panel, not a walkthrough: the three before it are stepped and
 * hands-on, so this one lays the recommendations out flat and lets the reader
 * scan. Only the first one needs a demo, because "it re-renders less" is the
 * one claim you cannot see by reading.
 */
export function Practices({ theme }: { theme: 'light' | 'dark' }) {
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
