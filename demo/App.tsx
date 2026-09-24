import { getRenderingEngine } from '@cornerstonejs/core';
import { useEffect, useState } from 'react';
import { setup, renderingEngineId } from './cornerstone';
import { Hero } from './Hero';
import { MountRace } from './MountRace';
import { useTheme } from './ui';

const REPO = 'https://github.com/entrolEC/react-cornerstone3d';

export function App() {
  const { theme, toggle } = useTheme();
  const [imageIds, setImageIds] = useState<string[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setup().then(setImageIds, (cause: Error) => setError(cause.message));
  }, []);

  useEffect(() => {
    const onResize = () => getRenderingEngine(renderingEngineId)?.resize(true, false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      <nav className="navbar">
        <div className="wrap">
          <a className="navbar__brand" href={REPO}>
            react-cornerstone3d
          </a>
          <span className="navbar__version">v0.4</span>
          <span className="navbar__spacer" />
          <a className="navbar__link" href="https://www.cornerstonejs.org/">
            Cornerstone3D
          </a>
          <a className="navbar__link" href="https://www.npmjs.com/package/react-cornerstone3d">
            npm
          </a>
          <a className="navbar__link" href={REPO}>
            GitHub
          </a>
          <button className="navbar__toggle" onClick={toggle} aria-label="테마 전환">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <h1>Cornerstone3D의 엔진 상태를, React 상태로</h1>
          <p>
            뷰포트 상태를 읽는 <code>useSyncExternalStore</code> 바인딩. tearing 없이, Provider
            없이, 여러분의 엔진 관리 방식은 그대로 둔 채로.
          </p>
          <div className="install">
            npm install react-cornerstone3d
            <button onClick={() => void navigator.clipboard.writeText('npm install react-cornerstone3d')}>
              복사
            </button>
          </div>
          <div className="hero__buttons">
            <a className="button button--primary" href="#demo">
              데모 보기
            </a>
            <a className="button button--secondary" href={REPO}>
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main id="demo">
        {error && (
          <div className="loading">
            DICOM 데이터를 불러오지 못했습니다 — {error}
          </div>
        )}
        {!error && !imageIds && <div className="loading">CT 시리즈를 불러오는 중…</div>}
        {imageIds && (
          <>
            <Hero imageIds={imageIds} theme={theme} />
            <MountRace imageIds={imageIds} />
          </>
        )}
      </main>

      <footer className="footer">
        <div className="wrap">
          MIT · <a href={REPO}>GitHub</a> ·{' '}
          <a href="https://www.npmjs.com/package/react-cornerstone3d">npm</a>
          <br />
          영상 데이터는 Cornerstone3D 공식 예제가 사용하는 공개 CT 시리즈입니다.
        </div>
      </footer>
    </>
  );
}
