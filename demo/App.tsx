import { getRenderingEngine } from '@cornerstonejs/core';
import { useEffect, useState } from 'react';
import { setup, renderingEngineId } from './cornerstone';
import { Panel3 } from './Panel3';
import { Panel2 } from './Panel2';
import { Panel1 } from './Panel1';
import { Panel4 } from './Panel4';
import { Panel5 } from './Panel5';
import { Panel6 } from './Panel6';
import { HeroViewer } from './HeroViewer';
import { LangProvider, LangSwitch, useCopy, useLang, useScrolled, useTheme } from './ui';
import { BY_HAND_WIRING } from './slider-by-hand';
import { HOOK_WIRING } from './slider-by-snapshot';

const REPO = 'https://github.com/entrolEC/react-cornerstone3d';
const NPM = 'https://www.npmjs.com/package/react-cornerstone3d';
const INSTALL = 'npm install react-cornerstone3d';

export function App() {
  const [lang, setLang] = useLang();
  return (
    <LangProvider lang={lang}>
      <Page lang={lang} onLang={setLang} />
    </LangProvider>
  );
}

const lineCount = (code: string) => code.split('\n').length;

/**
 * Three numbers before any prose, so the first screen answers "why do I need
 * this". The counts are the wiring regions of the two sliders panel 1 runs —
 * measured from the files, so the headline can never claim a number the code
 * no longer has, and never a different number from the panel below it.
 */
function Proof() {
  const t = useCopy().hero.proof;
  const facts = [
    { value: t.lines(lineCount(BY_HAND_WIRING), lineCount(HOOK_WIRING)), label: t.linesLabel },
    { value: t.effects, label: t.effectsLabel },
    { value: t.provider, label: t.providerLabel },
  ];
  return (
    <dl className="proof">
      {facts.map((fact) => (
        <div className="proof__item" key={fact.label}>
          <dt className="proof__value">{fact.value}</dt>
          <dd className="proof__label">{fact.label}</dd>
        </div>
      ))}
    </dl>
  );
}

function Page({ lang, onLang }: { lang: 'ko' | 'en'; onLang: (next: 'ko' | 'en') => void }) {
  const t = useCopy();
  const { theme, toggle } = useTheme();
  const [imageIds, setImageIds] = useState<string[]>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const scrolled = useScrolled();

  useEffect(() => {
    setup().then(setImageIds, (cause: Error) => setError(cause.message));
  }, []);

  useEffect(() => {
    const onResize = () => getRenderingEngine(renderingEngineId)?.resize(true, false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <>
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
        <div className="wrap navbar__inner">
          <a className="navbar__brand" href={REPO}>
            react-cornerstone3d
          </a>
          <span className="navbar__spacer" />
          <a className="navbar__link" href="https://www.cornerstonejs.org/">
            Cornerstone3D
          </a>
          <a className="navbar__link" href={NPM}>
            npm
          </a>
          <a className="navbar__link" data-keep="1" href={REPO}>
            GitHub
          </a>
          <LangSwitch lang={lang} onChange={onLang} />
          <button className="iconbutton" onClick={toggle} aria-label={t.nav.theme}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap hero__grid">
          <div className="hero__say">
            <p className="hero__kicker">{t.hero.kicker}</p>
            <h1>{t.hero.title}</h1>
            <p className="hero__sub">{t.hero.sub}</p>

            <button
              className="install"
              onClick={() => {
                void navigator.clipboard.writeText(INSTALL);
                setCopied(true);
              }}
            >
              <code>{INSTALL}</code>
              <span className="install__action">{copied ? t.common.copied : t.common.copy}</span>
            </button>

            <div className="hero__buttons">
              <a className="button button--primary" href="#demo">
                {t.hero.demo}
              </a>
              <a className="button button--secondary" href={REPO}>
                {t.hero.github}
              </a>
              <a className="button button--secondary" href="#how">
                {t.hero.howTo}
              </a>
            </div>

            <Proof />
          </div>

          {/* The characteristic thing in this subject's world, running, first. */}
          <HeroViewer imageIds={imageIds} />
        </div>
      </header>

      <main id="demo">
        {error && (
          <div className="notice">
            {t.failed} — {error}
          </div>
        )}
        {!error && !imageIds && (
          <div className="notice">
            <span className="spinner" aria-hidden /> {t.loading}
          </div>
        )}
        {imageIds && (
          <>
            <Panel1 imageIds={imageIds} theme={theme} />
            <Panel2 imageIds={imageIds} theme={theme} />
            <Panel3 imageIds={imageIds} theme={theme} />
            <Panel4 imageIds={imageIds} theme={theme} />
            <Panel5 imageIds={imageIds} theme={theme} />
            <Panel6 theme={theme} />
          </>
        )}
      </main>

      <footer className="footer">
        <div className="wrap">
          <div className="footer__links">
            <a href={REPO}>GitHub</a>
            <a href={NPM}>npm</a>
            <a href={`${REPO}/blob/main/LICENSE`}>MIT</a>
          </div>
          <p>{t.footer}</p>
        </div>
      </footer>
    </>
  );
}
