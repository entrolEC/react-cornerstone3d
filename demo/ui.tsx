import { Highlight, type PrismTheme } from 'prism-react-renderer';
import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { COPY, type Copy, type Lang } from './copy';

/* ---------------- syntax colours ---------------- */

/**
 * Written here rather than taken from a vendor theme because every colour has
 * to clear 4.5:1 on our own paper, and because `fontStyle: 'italic'` on
 * comments is unusable: IBM Plex Mono carries no Hangul, so a Korean comment
 * falls back to a proportional face and the browser synthesises the slant.
 */
const makeTheme = (plain: string, bg: string, c: Record<string, string>): PrismTheme => ({
  plain: { color: plain, backgroundColor: bg },
  styles: [
    { types: ['comment', 'prolog', 'cdata'], style: { color: c.comment } },
    { types: ['punctuation', 'operator'], style: { color: c.punctuation } },
    { types: ['string', 'char', 'attr-value', 'regex'], style: { color: c.string } },
    { types: ['number', 'boolean', 'constant', 'symbol'], style: { color: c.number } },
    { types: ['keyword', 'tag', 'selector', 'important'], style: { color: c.keyword } },
    { types: ['function', 'function-variable', 'method'], style: { color: c.function } },
    { types: ['class-name', 'maybe-class-name', 'builtin'], style: { color: c.type } },
    { types: ['attr-name', 'property', 'variable'], style: { color: c.property } },
    { types: ['deleted'], style: { color: c.number } },
    { types: ['inserted'], style: { color: c.string } },
  ],
});

const LIGHT_CODE = makeTheme('#10141c', 'transparent', {
  comment: '#5b6472',
  punctuation: '#4a5261',
  string: '#0a6b3d',
  number: '#a3400b',
  keyword: '#9a2a9c',
  function: '#0151d9',
  type: '#7a4c00',
  property: '#0c5f8a',
});

const DARK_CODE = makeTheme('#e4ebf3', 'transparent', {
  comment: '#93a1b5',
  punctuation: '#9fadbf',
  string: '#8ce0a0',
  number: '#ffb68a',
  keyword: '#d7a8ff',
  function: '#5acce6',
  type: '#ffd493',
  property: '#8ce0f0',
});

/* ---------------- language ---------------- */

const LangContext = createContext<Copy>(COPY.ko);

/** Every string on the page comes from here, so the two locales can't drift. */
export const useCopy = () => useContext(LangContext);

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={COPY[lang]}>{children}</LangContext.Provider>;
}

const readLang = (): Lang => {
  try {
    const stored = localStorage.getItem('lang');
    if (stored === 'ko' || stored === 'en') return stored;
  } catch {
    /* private mode — fall through to the browser's preference */
  }
  return navigator.language.startsWith('ko') ? 'ko' : 'en';
};

export function useLang() {
  const [lang, set] = useState<Lang>(readLang);

  useEffect(() => {
    document.documentElement.lang = COPY[lang].htmlLang;
    // The description is in the served HTML, so it stays Korean for an English
    // reader unless it is swapped with everything else.
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', COPY[lang].description);
    try {
      localStorage.setItem('lang', lang);
    } catch {
      /* the page still works; the choice just won't stick */
    }
  }, [lang]);

  return [lang, set] as const;
}

export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (next: Lang) => void }) {
  return (
    <div className="langswitch" role="group" aria-label={COPY[lang].nav.language}>
      {(['en', 'ko'] as const).map((candidate) => (
        <button
          key={candidate}
          className="langswitch__option"
          aria-pressed={candidate === lang}
          onClick={() => onChange(candidate)}
        >
          {candidate.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* ---------------- theme ---------------- */

type Theme = 'light' | 'dark';

const read = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);

  const toggle = useCallback(() => {
    const next = read() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* private mode — the page still works, the choice just won't stick */
    }
    setTheme(next);
  }, []);

  return { theme, toggle };
}

/**
 * True once the page has left the hero. The navbar sits on a dark band at rest
 * and has to become a light bar the moment it stops overlapping it.
 */
export function useScrolled(threshold = 24) {
  const [scrolled, set] = useState(false);

  useEffect(() => {
    const read = () => {
      set(window.scrollY > threshold);
      // Written straight to the custom property: a progress bar that re-rendered
      // the page on every scroll frame would cost more than it is worth.
      const travel = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = travel > 0 ? Math.min(1, window.scrollY / travel) : 0;
      document.documentElement.style.setProperty('--scroll-progress', String(ratio));
    };
    read();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, [threshold]);

  return scrolled;
}

/* ---------------- code ---------------- */

/**
 * Pulls a `// #region name` … `// #endregion` block out of a source file
 * imported with `?raw`, so a code panel can never drift from the component
 * running beside it.
 */
export function region(source: string, name: string): string {
  // The closing marker has to carry the name too: regions nest, and an
  // unnamed match would stop at the first inner `#endregion`.
  const match = source.match(
    new RegExp(
      `^[ \\t]*// #region ${name}[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n[ \\t]*// #endregion ${name}\\b`,
      'm',
    ),
  );
  if (!match) return `// region "${name}" not found`;

  // Inner markers are bookkeeping, not code to read; and a region can sit
  // inside a function, so show the block at its own left margin.
  const body = match[1].split('\n').filter((line) => !/^\s*\/\/ #(end)?region\b/.test(line));
  const widths = body.filter((line) => line.trim()).map((line) => /^\s*/.exec(line)![0].length);
  const indent = widths.length ? Math.min(...widths) : 0;
  return body.map((line) => line.slice(indent)).join('\n');
}

/** A line worth naming, and the one word that names it. */
export interface CodeNote {
  /** Substring of the line. The first line that contains it wins. */
  readonly at: string;
  /** One word, printed at the end of that line. */
  readonly label: string;
}

export function Code({
  code,
  title,
  theme,
  mark,
  notes,
  dimFrom,
  dimLabel,
}: {
  code: string;
  title: string;
  theme: Theme;
  /** Substring of the one line that matters: it is highlighted and scrolled to. */
  mark?: string;
  /** Lines to name. Each gets its label at the end of the line. */
  notes?: readonly CodeNote[];
  /**
   * Substring of the first line that is the same in the version beside this
   * one. From there down the block is dimmed: what a comparison counts is what
   * differs, and saying so is more honest than quietly leaving it in the total.
   */
  dimFrom?: string;
  /** Printed on the first dimmed line — e.g. "identical on both sides". */
  dimLabel?: string;
}) {
  const t = useCopy().common;
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const [clip, setClip] = useState('');

  // Line numbers are resolved once per (code, notes, dimFrom) rather than per
  // line: a note names the *first* line that matches, and asking that question
  // inside the map would give every `addEventListener` the same label.
  const lines = useMemo(() => code.split('\n'), [code]);
  const labels = useMemo(() => {
    const found = new Map<number, string>();
    for (const note of notes ?? []) {
      const i = lines.findIndex((line, n) => line.includes(note.at) && !found.has(n));
      if (i >= 0) found.set(i, note.label);
    }
    return found;
  }, [lines, notes]);
  const dimAt = useMemo(() => {
    if (dimFrom === undefined) return undefined;
    const i = lines.findIndex((line) => line.includes(dimFrom));
    return i < 0 ? undefined : i;
  }, [lines, dimFrom]);

  useEffect(() => {
    const pre = preRef.current;
    const line = markRef.current;
    if (!pre || !line) return;
    // Only the block scrolls — scrollIntoView would drag the page with it.
    pre.scrollTop = Math.max(0, line.offsetTop - pre.clientHeight / 2 + line.clientHeight / 2);
  }, [code, mark]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    // 'u' is content above the fold. The block opens scrolled to the marked
    // line, so a reader can land in the middle of a file with hidden lines
    // above and — with only a bottom fade — nothing saying the file has a top.
    const read = () =>
      setClip(
        `${pre.scrollWidth > pre.clientWidth + 1 ? 'x' : ''}${
          pre.scrollHeight > pre.clientHeight + pre.scrollTop + 1 ? 'y' : ''
        }${pre.scrollTop > 1 ? 'u' : ''}`,
      );
    read();
    const observer = new ResizeObserver(read);
    observer.observe(pre);
    pre.addEventListener('scroll', read, { passive: true });
    return () => {
      observer.disconnect();
      pre.removeEventListener('scroll', read);
    };
  }, [code, mark]);

  return (
    <div className="code" data-clip={clip || undefined}>
      <div className="code__head">
        <span>{title}</span>
        <button
          className="code__copy"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
          }}
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <Highlight
        code={code}
        language="tsx"
        theme={theme === 'dark' ? DARK_CODE : LIGHT_CODE}
      >
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre ref={preRef} style={{ ...style, backgroundColor: 'transparent' }}>
            {tokens.map((line, i) => {
              const props = getLineProps({ line });
              const marked =
                mark !== undefined && line.map((token) => token.content).join('').includes(mark);
              const label = labels.get(i);
              const dim = dimAt !== undefined && i >= dimAt;
              return (
                <div
                  key={i}
                  {...props}
                  ref={marked ? markRef : undefined}
                  className={`${props.className ?? ''}${marked ? ' code__mark' : ''}${
                    label ? ' code__named' : ''
                  }${dim ? ' code__dim' : ''}`}
                >
                  <span className="line-no">{i + 1}</span>
                  {line.map((token, j) => (
                    <span key={j} {...getTokenProps({ token })} />
                  ))}
                  {label && <span className="code__note">{label}</span>}
                  {dim && i === dimAt && dimLabel && (
                    <span className="code__note code__note--same">{dimLabel}</span>
                  )}
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

/* ---------------- panel shell ---------------- */

export function Panel({
  eyebrow,
  title,
  lead,
  alt = false,
  id,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  alt?: boolean;
  /** An anchor, for a jump link from the hero. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel${alt ? ' panel--alt' : ''}`} id={id}>
      <div className="wrap">
        <header className="panel__head">
          <div className="panel__eyebrow">{eyebrow}</div>
          <h2 className="panel__title">{title}</h2>
          <p className="panel__lead">{lead}</p>
        </header>
        {children}
      </div>
    </section>
  );
}

/* ---------------- citation ---------------- */

/**
 * A claim about somebody else's code. The link is pinned to a commit (see
 * `citations.ts`) so a reader can check the quote instead of taking it.
 */
export function Cite({
  what,
  href,
  children,
}: {
  what: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <figure className="cite">
      <div className="cite__body">{children}</div>
      <figcaption className="cite__source">
        <a href={href} target="_blank" rel="noreferrer">
          {what}
        </a>
      </figcaption>
    </figure>
  );
}

/* ---------------- error boundary ---------------- */

/**
 * Without one of these, the naive binding in panel 2 takes the whole page
 * down with it — which is exactly what it does in a real app.
 */
export class Catch extends Component<
  { children: ReactNode; fallback: (error: Error) => ReactNode },
  { error?: Error }
> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // React already logged it; the fallback shows the message on the page.
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

/* ---------------- stepper ---------------- */

/** Shared by panels 2 and 3 so a walkthrough always looks and works the same. */
export function Steps({
  count,
  index,
  caption,
  next,
  restart,
  onNext,
  onRestart,
}: {
  count: number;
  index: number;
  caption: ReactNode;
  next: string;
  restart: string;
  onNext: () => void;
  onRestart: () => void;
}) {
  const done = index === count - 1;
  return (
    <div className="steps">
      <div className="steps__dots" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`dot ${i <= index ? 'dot--on' : ''}`} />
        ))}
      </div>
      <p className="steps__caption">
        <b className="steps__n">{index + 1}.</b> {caption}
      </p>
      <div className="steps__buttons">
        {!done && (
          <button
            className="button button--primary button--sm"
            onClick={onNext}
          >
            {next}
          </button>
        )}
        {index > 0 && (
          <button className="button button--secondary button--sm" onClick={onRestart}>
            {restart}
          </button>
        )}
      </div>
    </div>
  );
}
