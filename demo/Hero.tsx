import { useState } from 'react';
import { Code, Panel } from './ui';
import { CtViewport, LoadTrack, SliceSlider } from './CtViewport';
import {
  BY_HAND_SOURCE,
  HOOK_SOURCE,
  SliceIndicator,
  SliceIndicatorByHand,
  lineCount,
} from './widgets';

const VIEWPORT_ID = 'demo-hero';

export function Hero({ imageIds, theme }: { imageIds: string[]; theme: 'light' | 'dark' }) {
  const [tab, setTab] = useState<'hook' | 'byHand'>('hook');
  const hook = tab === 'hook';

  return (
    <Panel
      eyebrow="패널 1"
      title="훅 한 번 호출이 위젯 하나의 배선을 전부 대신합니다"
      lead={
        <>
          아래 CT는 진짜 Cornerstone3D 엔진입니다. 스크롤하거나 슬라이더를 움직이면 슬라이스가
          바뀌고, 옆의 위젯은 그 변화를 React 상태로 읽습니다. 탭을 바꾸면 <b>지금 화면에서
          실제로 실행 중인 구현</b>이 바뀝니다.
        </>
      }
    >
      <div className="grid">
        <div>
          <CtViewport viewportId={VIEWPORT_ID} imageIds={imageIds} />
          <SliceSlider viewportId={VIEWPORT_ID} />
          <LoadTrack viewportId={VIEWPORT_ID} />
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card__head">
              실행 중인 위젯
              <span className={`badge badge--${hook ? 'ok' : 'bad'}`}>
                {hook ? 'useViewportState' : 'useEffect'}
              </span>
            </div>
            <div className="card__body" style={{ textAlign: 'center' }}>
              {hook ? (
                <SliceIndicator viewportId={VIEWPORT_ID} />
              ) : (
                <SliceIndicatorByHand viewportId={VIEWPORT_ID} />
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="tabs" role="tablist">
            <button
              className="tab"
              role="tab"
              aria-selected={hook}
              onClick={() => setTab('hook')}
            >
              useViewportState <span>{lineCount(HOOK_SOURCE)}줄</span>
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={!hook}
              onClick={() => setTab('byHand')}
            >
              직접 배선 <span>{lineCount(BY_HAND_SOURCE)}줄</span>
            </button>
          </div>
          <Code
            theme={theme}
            title="demo/widgets.tsx"
            code={hook ? HOOK_SOURCE : BY_HAND_SOURCE}
          />
        </div>
      </div>

      <div className="note">
        <strong>오른쪽 코드는 지어낸 게 아닙니다.</strong>
        이 페이지가 실제로 import해서 렌더링하는 파일(<code>demo/widgets.tsx</code>)에서 그대로
        뽑아옵니다. 그리고 직접 배선한 쪽은 Cornerstone3D + React 프로젝트가 위젯마다 반복해서
        쓰는 바로 그 패턴입니다 — 줄 수보다 나쁜 건, 저 {lineCount(BY_HAND_SOURCE)}줄을 다 쓰고도 버그가
        남아있다는 점입니다. 다음 패널에서 보여드립니다. ↓
      </div>
    </Panel>
  );
}
