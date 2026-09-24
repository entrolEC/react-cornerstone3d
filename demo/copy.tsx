import type { ReactNode } from 'react';

export type Lang = 'ko' | 'en';

interface StoryCopy {
  tab: string;
  intro: ReactNode;
  /** One per visible step, in order. */
  captions: ReactNode[];
  verdict: ReactNode;
}

export interface Copy {
  htmlLang: string;
  common: { copy: string; copied: string; next: string; restart: string };
  nav: { theme: string; language: string };
  /** <meta name="description">, swapped with the language. */
  description: string;
  hero: {
    kicker: string;
    caption: string;
    waiting: string;
    title: ReactNode;
    sub: ReactNode;
    demo: string;
    github: string;
    /** Three facts a reader can check on this page, before any prose. */
    proof: {
      lines: (byHand: number, hook: number) => string;
      linesLabel: string;
      effects: string;
      effectsLabel: string;
      provider: string;
      providerLabel: string;
    };
  };
  loading: string;
  failed: string;
  panel1: {
    eyebrow: string;
    title: string;
    lead: ReactNode;
    tabHook: string;
    tabByHand: string;
    lines: (n: number) => string;
    viewportHint: string;
    running: string;
    note: ReactNode;
  };
  panel2: {
    eyebrow: string;
    title: string;
    lead: ReactNode;
    drag: string;
    slowNote: string;
    purge: string;
    purged: string;
    crashed: string;
    /** The fact, at the moment it happens. The mechanism is panel 3's job. */
    fact: ReactNode;
    decode: string;
    rules: { title: string; items: string[] };
    captions: ReactNode[];
    verdict: ReactNode;
  };
  panel3: {
    eyebrow: string;
    title: string;
    lead: ReactNode;
    bookTitle: string;
    bookBadge: string;
    hookTitle: string;
    hookBadge: string;
    seeSource: string;
    identity: {
      naiveTitle: (renders: number) => string;
      noRun: string;
      replay: string;
      ran: string;
      hookTitle: string;
      /** total renders, distinct snapshot objects */
      holdTitle: string;
      hold: string;
      /** Header of the console: how many distinct objects the run produced. */
      objects: (n: number) => string;
      empty: string;
      /** Engine events counted live, beside the objects they turned into. */
      engineNote: (events: number) => ReactNode;
      naiveVerdict: ReactNode;
      hookVerdict: ReactNode;
    };
    netNote: ReactNode;
    purge: string;
    purged: string;
    slowNote: string;
    cite: { ohif: string; cs3d: string };
    scarsTitle: string;
    scarsEnd: ReactNode;
    captions: ReactNode[];
    verdict: ReactNode;
  };
  panel4: {
    eyebrow: string;
    title: string;
    lead: ReactNode;
    withSelector: string;
    withoutSelector: string;
    renders: (n: number) => string;
    nudge: string;
    nudgeHint: string;
    items: { title: string; label: string; code: string; mark?: string; body: ReactNode }[];
    shorts: { title: string; body: ReactNode }[];
  };
  footer: ReactNode;
}

export const COPY: Record<Lang, Copy> = {
  ko: {
    htmlLang: 'ko',
    common: { copy: '복사', copied: '복사됨', next: '다음', restart: '처음부터' },
    nav: { theme: '테마 전환', language: '언어' },
    description:
      '슬라이스 번호 하나를 화면에 띄우려고 useEffect와 이벤트 구독을 매번 새로 짜지 않아도 됩니다. Cornerstone3D 뷰포트 상태를 읽는 React 훅입니다.',
    hero: {
      kicker: 'Cornerstone3D v5 · React 18+',
      title: <>Cornerstone3D의 엔진 상태를, React 상태로</>,
      sub: (
        <>
          슬라이스 번호 하나를 화면에 띄우려고 <code>useEffect</code> 하나와 이벤트 구독 세 개,
          cleanup을 매번 새로 짜고 계신가요? <code>useViewportState</code> 훅 하나로 해결해보세요.
        </>
      ),
      proof: {
        lines: (byHand, hook) => `${byHand}줄 → ${hook}줄`,
        linesLabel: '같은 위젯을 만드는 코드',
        effects: 'useEffect 0개',
        effectsLabel: '이벤트 구독도 cleanup도 없습니다',
        provider: 'Provider 0개',
        providerLabel: '앱 구조를 바꾸지 않습니다',
      },
      caption: '진짜 Cornerstone3D 엔진입니다. 옆의 숫자는 훅이 읽고 있습니다.',
      waiting: '읽는 중',
      demo: '데모 보기',
      github: 'GitHub',
    },
    loading: 'CT 시리즈를 불러오는 중…',
    failed: 'DICOM 데이터를 불러오지 못했습니다',
    panel1: {
      eyebrow: '1',
      title: '읽을 값마다 훅 한 줄, 배선은 그걸로 끝입니다',
      lead: (
        <>
          아래 CT는 진짜 Cornerstone3D 엔진입니다. 스크롤하거나 슬라이더를 움직이면 옆의 위젯이
          그 값을 화면에 반영합니다. 탭을 바꾸면{' '}
          <b>지금 실행 중인 구현</b>이 바뀝니다.
        </>
      ),
      tabHook: 'useViewportState',
      tabByHand: '직접 배선',
      lines: (n) => `${n}줄`,
      viewportHint: '스크롤하거나 슬라이더를 끌어 슬라이스를 옮기세요',
      running: '실행 중인 위젯',
      note: (
        <>
          <strong>오른쪽 코드는 설명용으로 새로 쓴 것이 아닙니다.</strong>
          <p>
            이 페이지가 실제로 렌더링하는 <code>demo/widgets.tsx</code>에서 그대로 읽어 온 것이고,
            직접 배선한 쪽은 Cornerstone3D + React 프로젝트가 위젯마다 반복하는 패턴입니다.
          </p>
          <p>
            그런데 줄 수는 작은 문제입니다. 저 코드는 결국{' '}
            <b>엔진이 이미 갖고 있는 상태를 <code>setState</code>로 한 번 더 복사</b>합니다.
            사본은 다음 렌더에야 반영되고, 이벤트를 놓치면 갱신되지 않습니다. 옆 위젯이 들고 있는
            사본과 값이 달라집니다. 다음 패널에서는
            복사하지 않고 읽어 보겠습니다. ↓
          </p>
        </>
      ),
    },
    panel2: {
      eyebrow: '2',
      title: 'React의 정답으로 슬라이더를 만들어 보겠습니다',
      lead: (
        <>
          패널 1의 코드는 엔진이 이미 갖고 있는 상태를 React state로 복사했습니다. React 18에는
          복사하지 않고 <b>구독해서 읽는</b> 공식 훅이 있습니다. 이름은{' '}
          <code>useSyncExternalStore</code>입니다. 이걸로 <b>실제 화면에 쓸 컨트롤</b>을 만들어
          보겠습니다. 어디까지 되는지 직접 해보세요.
        </>
      ),
      drag: '빠르게 끌어보세요.',
      slowNote: '이 패널의 뷰포트는 슬라이스 도착을 450ms 의도적으로 늦춥니다 — 빠른 회선에서도 슬라이더가 버벅이는 것이 보이게 하기 위해서입니다. 엔진 동작은 그대로입니다.',
      purge: '엔진 캐시 비우기',
      purged: '비웠습니다. 이제 다시 끌어보세요.',
      crashed: '렌더링이 중단됐습니다',
      fact: (
        <>
          바꾼 것은 <code>{'{ slice, total }'}</code> 한 줄뿐입니다.{' '}
          <b>객체를 만들어 돌려주자 렌더링이 중단됐습니다.</b>
        </>
      ),
      decode: '에러 코드 해설',
      rules: {
        title: 'React가 getSnapshot을 쓰는 방법',
        items: [
          '렌더할 때마다 getSnapshot()을 호출합니다',
          '지난번에 받은 값과 Object.is로 비교합니다',
          '다르면 상태가 바뀐 것으로 보고 다시 렌더합니다',
        ],
      },
      captions: [
        <>
          인자는 두 개입니다. 첫째는 <b>구독 함수</b> — 값이 바뀌면 React에게 알려줄 방법을
          등록합니다. 둘째가 <b><code>getSnapshot</code></b> — React가 <i>"지금 값 줘"</i> 하고
          부를 때 실행되는 함수입니다. 여기서는 슬라이스 번호 <b>하나만</b> 돌려줍니다.
        </>,
        <>
          React는 그 <code>getSnapshot</code>을 이렇게 씁니다. 지금은 <b>2번</b>만 기억해
          두세요 — 비교가 <code>Object.is</code>라는 점입니다.
        </>,
        <>
          그리고 <b>동작합니다.</b> 슬라이스가 바뀔 때마다 숫자가 같이 갱신됩니다.{' '}
          <code>setState</code> 사본도 필요 없습니다. <b>값 하나는 이걸로 끝입니다.</b> 그런데
          슬라이더에는 <b>전체 장수</b>도 있어야 합니다. 값을 하나 더 읽어야 합니다.
        </>,
        <>
          값이 둘이니 하나의 객체로 묶어 돌려주는 것이 자연스럽습니다. 오른쪽 코드에서 바뀐
          것은 <code>return</code> 한 줄뿐입니다. <b>그런데 이 컴포넌트가 렌더 도중 에러를 던집니다.</b>
        </>,
        <>
          객체를 만들지 않고 <b>원시값 두 개를 훅 두 개로 따로 읽는 것</b>으로 해결할 수
          있습니다. <b>슬라이더가 완성됐습니다.</b> 하지만 슬라이더를 <b>빠르게 끌면 슬라이더가
          버벅입니다.</b> 직접 해보세요.
        </>,
      ],
      verdict: (
        <>
          <b>두 번 실패했습니다.</b> 한 번은 <b>무한 루프</b>, 한 번은{' '}
          <b>버벅이는 슬라이더</b>입니다. 값 하나짜리 화면은 없으니 둘 다 실제로 만나게 됩니다.
          <br />
          <br />
          그런데 이 둘은 <b>같은 원인에서 나옵니다.</b> 다음 패널에서 그것을 봅니다. ↓
        </>
      ),
    },
    panel3: {
      eyebrow: '3',
      title: '무한 루프와 버벅이는 슬라이더, 원인은 하나입니다',
      lead: (
        <>
          패널 2에서 에러가 났고, 슬라이더가 버벅였습니다. 이번 패널은 <b>그 둘이 왜 생겼는지</b>,
          그리고 왜 <b>원인이 하나인지</b>를 봅니다.
        </>
      ),
      bookTitle: '직접 배선한 슬라이더',
      bookBadge: '정석',
      hookTitle: 'useViewportState 슬라이더',
      hookBadge: 'react-cornerstone3d',
      seeSource: '엔진 소스에서 확인하기',
      netNote: (
        <>
          슬라이더는 <b>사용자 조작에 반응해야 합니다.</b> 로드 완료 이벤트에 연결하는 순간,
          손잡이는 사용자가 아니라 네트워크 사정에 따라 움직입니다. <b>조작에 반응하지 않는 컨트롤은 어떤 값을 표시하든
          잘못된 컨트롤입니다.</b> 위 슬라이더를 직접 끌어보셨다면 더 설명이 필요하지 않습니다.
        </>
      ),
      slowNote: '이 패널의 뷰포트도 슬라이스 도착을 450ms 의도적으로 늦춥니다. 엔진 동작은 그대로입니다.',
      purge: '엔진 캐시 비우기',
      purged: '비웠습니다. 이제 다시 끌어보세요.',
      cite: {
        ohif: 'OHIF/Viewers, 41c03bcf에서 발췌',
        cs3d: 'cornerstone3D, StackViewport.scroll (264ca707)',
      },
      scarsTitle: '그런데 같은 파일들에 이런 것도 같이 남아 있습니다 — OHIF가 직접 써놓은 주석입니다.',
      scarsEnd: (
        <>
          <b>모르고 있는 게 아닙니다.</b> 넷 다 같은 지점에서 실패한 기록입니다. 그러고도 손잡이는
          여전히 로드 완료 이벤트에 연결돼 있습니다. <b>이 분야에서 가장 크고 오래된 뷰어도 아직
          풀지 못했습니다</b> — 플랫폼이 상태를 React 밖에 두기 때문입니다.
        </>
      ),
      identity: {
        naiveTitle: (n) =>
          `패널 2에서 객체를 돌려줬을 때 React가 이 컴포넌트를 ${n}번 실행했습니다. 그때마다 getSnapshot이 돌려준 값입니다.`,
        noRun: '패널 2에서 객체를 돌려주는 단계를 아직 지나지 않으셨습니다. 여기서 그 순간을 재현할 수 있습니다.',
        replay: '그 순간 재현하기',
        ran: '재현했습니다. 기록이 아래에 남았습니다.',
        hookTitle: '슬라이더를 움직여 보세요. 렌더될 때마다 훅이 돌려준 객체를 찍습니다.',
        holdTitle: '이번에는 슬라이더를 건드리지 마세요. 버튼을 누르면 렌더만 다시 일어납니다.',
        hold: '다시 렌더',
        objects: (n) => `객체 ${n}개`,
        empty: '아직 찍힌 것이 없습니다.',
        engineNote: (events) => (
          <>
            같은 시간 동안 <b>엔진 이벤트 {events}회</b>가 지나갔습니다. 훅은 이것을 프레임당 한
            번으로 모으고, <b>스냅샷 전체를 비교해</b> 달라졌을 때만 새 객체를 만듭니다.
          </>
        ),
        naiveVerdict: (
          <>
            값은 처음부터 끝까지 같습니다. 그런데 <b>객체 번호는 한 번도 반복되지 않습니다.</b>{' '}
            <code>return {'{ slice, total }'}</code> — <b>이 중괄호가 실행될 때마다 객체가 하나씩
            새로 만들어지기</b> 때문입니다. 담긴 값이 같아도 다른 객체입니다.
            <br />
            <br />
            그리고 <b>React는 값이 아니라 객체를 비교합니다.</b> 그래서 매번 “바뀌었다”고 보고
            다시 렌더하고, 다시 렌더하면 또 부르고, 또 새 객체가 나옵니다 — 위에서 본 그
            반복입니다. 그리고 이것은 우리가 객체를 만들었을 때만 생기는 일이 아닙니다.{' '}
            <code>viewport.getCamera()</code>도 부를 때마다 새 객체를 돌려줍니다.
          </>
        ),
        hookVerdict: (
          <>
            객체가 <b>만들어지는 시점</b>이 다릅니다. 직접 배선은 값이 그대로인데도{' '}
            <b>렌더마다 새 객체</b>를 만들었습니다. 훅은 <b>엔진이 상태가 바뀌었다고 알릴 때만</b>{' '}
            만들고, 그 사이 렌더에는 보관해 둔 객체를 그대로 돌려줍니다.
          </>
        ),
      },
      captions: [
        <>
          <b>첫 번째로 무한 루프 이슈부터 살펴보겠습니다.</b> 패널 2의 <b>1번 규칙</b>을 떠올려
          보세요 — React는 렌더할 때마다 <code>getSnapshot</code>을 부릅니다.
        </>,
        <>
          <b>두 번째로 버벅이는 슬라이더 이슈입니다.</b> 범인은 오른쪽 코드가 고른 이벤트 하나입니다. 인덱스는{' '}
          <b>동기로</b> 바뀌는데 <code>STACK_NEW_IMAGE</code>는 이미지가 <b>도착한 뒤에</b>{' '}
          옵니다.
        </>,
        <>
          우리 힘으로는 여기까지입니다. <b>이 분야 최대 커뮤니티인 OHIF</b>는 어떻게 풀었는지
          궁금하지 않으신가요? 소스를 열어봤더니 <b>같은 이벤트에 연결돼 있습니다.</b>
        </>,
        <>
          <b>원인은 하나</b>입니다 — 엔진에는 상태를 <b>보관해 둔 객체가 없습니다.</b> 훅은 그
          객체를 만들어 둡니다. 슬라이더를 움직여 보세요 — 값이 바뀌면 새 객체가 쌓입니다.
        </>,
        <>
          여기까지는 당연합니다. <b>값이 바뀌지 않을 때</b>가 문제였습니다. 1번 표에서는 값이
          그대로인데도 객체가 <b>매번 달랐고</b>, 그게 무한 루프였습니다. 값을 그대로 둔 채
          렌더만 반복해 보세요.
        </>,
      ],
      verdict: (
        <>
          Redux나 Zustand에서 <code>getSnapshot</code>이{' '}
          <code>() =&gt; store.getState()</code> 한 줄로 끝나는 것은{' '}
          <b>그 라이브러리들이 안정된 상태 객체를 이미 보유하고 있기 때문</b>입니다.
          Cornerstone3D에 없는 것이 그 <b>스토어</b>이고,{' '}
          <code>useViewportState</code>가 <b>엔진 이벤트로 그것을 만들어 뷰포트당 하나씩
          공유합니다.</b>
        </>
      ),
    },
    panel4: {
      eyebrow: '4',
      title: '그래서, 어떻게 쓰면 되는지 보겠습니다',
      lead: (
        <>
          훅이 돌려주는 그 상태 객체를 <b>스냅샷</b>, 스냅샷에서 필요한 값만 골라 읽는 함수를{' '}
          <b>셀렉터</b>라고 부릅니다. 알아둘 규칙은 몇 가지 안 되고, 대부분 앞의 세 패널에서 이미
          본 것들입니다. 순서대로 훑어보세요.
        </>
      ),
      withSelector: '셀렉터로 읽기',
      withoutSelector: '스냅샷 전체 읽기',
      renders: (n) => `리렌더 ${n}회`,
      nudge: '카메라 움직이기',
      nudgeHint: '줌만 바꿉니다. 영상은 움직이는데 슬라이스 번호는 그대로입니다 — 리렌더 횟수가 어느 쪽에서만 올라가는지 보세요.',
      items: [
        {
          title: '셀렉터 안에서 새 객체를 만들지 마세요',
          label: '셀렉터',
          mark: 'const voi',
          code: `// 이 값이 바뀔 때만 리렌더됩니다
const slice = useViewportState(id, (s) => s.sliceIndex);

// 스냅샷에 이미 있는 값을 읽는 것도 안전합니다
const camera = useViewportState(id, (s) => s.camera);

// 셀렉터 안에서 새로 만들면 — 고른 값이 그대로여도 매번 리렌더됩니다
const voi = useViewportState(id, (s) => ({ ...s.voiRange }));`,
          body: (
            <>
              셀렉터가 없으면 카메라만 움직여도 슬라이스 표시기가 다시 그려집니다. 그리고 셀렉터
              안에서 객체를 만들면 <b>리렌더가 전혀 줄지 않습니다</b> — 비교가{' '}
              <code>Object.is</code>라서, 고른 값이 그대로여도 매번 새 객체가 되기 때문입니다. 패널 3의{' '}
              <code>A B C</code>가 여기서 다시 나옵니다.
            </>
          ),
        },
        {
          title: '읽기는 훅, 쓰기는 Cornerstone3D',
          label: '쓰기',
          mark: 'setImageIdIndex',
          code: `const slice = useViewportState(id, (s) => s.sliceIndex);

// 이 라이브러리에는 쓰기 API가 없습니다. 엔진을 그대로 부르세요.
<input
  type="range"
  value={slice}
  onChange={(e) => viewport.setImageIdIndex(Number(e.target.value))}
/>`,
          body: (
            <>
              일부러 없습니다. 엔진에 쓰면 <b>엔진이 이벤트를 발생시키고</b>, 훅이 그 이벤트로
              스냅샷을 갱신합니다. 상태를 두 군데 두지 않으니 두 값이 달라질 일도 없습니다.
            </>
          ),
        },
        {
          title: 'undefined는 오류가 아니라 정상 상태입니다',
          label: '없음 다루기',
          mark: 'slice === undefined',
          code: `const slice = useViewportState(id, (s) => s.sliceIndex);

// 뷰포트가 아직 없거나, 영상이 아직 없거나, 검사를 닫았습니다 — 전부 정상입니다
if (slice === undefined) return <span className="empty">—</span>;

return <span>{slice + 1}</span>;`,
          body: (
            <>
              훅은 뷰포트가 없으면 <code>undefined</code>를 돌려줍니다. 던지지도, 기다리지도
              않습니다. <code>!</code>로 단언하지 말고 <b>빈 상태를 그리세요</b> — 영상이 로드되면
              엔진이 이벤트를 발생시키고, 훅이 갱신한 값이 이 자리에 들어옵니다.
            </>
          ),
        },
        {
          title: '엔진은 앱이 소유합니다 — Provider가 없습니다',
          label: '붙이는 법',
          mark: "useViewportState('ct-axial')",
          code: `// 앱이 이미 만들어 쓰던 엔진 그대로
new RenderingEngine('my-engine');

// 훅은 viewportId만 받습니다. 감싸는 것도, Provider도 없습니다.
const state = useViewportState('ct-axial');

// enableElement를 직접 하고 있다면 그대로 두세요. 이 컴포넌트는 선택입니다.
<CornerstoneViewport viewportId="ct-axial" type={ViewportType.STACK} />`,
          body: (
            <>
              라이브러리는 엔진을 생성하지도, 보유하지도, 설정하지도 않습니다. Cornerstone3D의
              전역 레지스트리에서 <code>viewportId</code>로 찾아갈 뿐입니다. 그래서{' '}
              <b>기존 앱에 리팩터링 없이 적용됩니다.</b>
            </>
          ),
        },
        {
          title: 'Stack과 Volume을 같은 코드로',
          label: '뷰포트 종류',
          mark: 'state.kind',
          code: `// Slice Position은 모든 뷰포트 종류에 공통입니다
const slice = useViewportState(id, (s) => s.sliceIndex);
const total = useViewportState(id, (s) => s.numberOfSlices);

// 종류별 필드가 필요할 때만 좁히세요
const state = useViewportState(id);
if (state?.kind === 'stack') { /* ... */ }`,
          body: (
            <>
              슬라이스 컨트롤 하나로 Stack과 MPR을 함께 다룹니다. 직접 짜면 Volume에서 갱신이 멈춥니다 —
              Volume에는 <code>STACK_NEW_IMAGE</code>가 오지 않고, 슬라이스가 카메라에서
              유도되기 때문입니다. 훅이 그 차이를 내부에서 처리합니다.
            </>
          ),
        },
      ],
      shorts: [
        {
          title: '위젯을 여러 컴포넌트로 나눠도 구독은 하나입니다',
          body: (
            <>
              <code>viewportId</code>당 바인딩 하나, 스냅샷 하나를 모든 소비자가 공유합니다.
              오버레이를 작은 컴포넌트 여럿으로 나눠도 비용이 늘지 않습니다.
            </>
          ),
        },
        {
          title: '스냅샷은 읽기 전용입니다',
          body: (
            <>
              중첩된 객체까지 전부 <code>Object.freeze</code>돼 있습니다. 직접 수정하지 말고
              파생해서 쓰세요.
            </>
          ),
        },
        {
          title: '{ batch: false }는 정말 필요할 때만 쓰세요',
          body: (
            <>
              이 옵션을 주면 엔진 이벤트가 올 때마다 리렌더합니다. 기본값은 프레임당 한 번으로
              모읍니다 — 드래그 중에는 엔진 이벤트가 초당 수십 번 오기 때문입니다.
            </>
          ),
        },
      ],
    },
    footer: (
      <>
        영상 데이터는 Cornerstone3D 공식 예제가 사용하는 공개 CT 시리즈입니다.
      </>
    ),
  },

  en: {
    htmlLang: 'en',
    common: { copy: 'Copy', copied: 'Copied', next: 'Next', restart: 'Start over' },
    nav: { theme: 'Toggle theme', language: 'Language' },
    description:
      'Stop writing a useEffect and event subscriptions every time you need a slice number on screen. A React hook that reads Cornerstone3D viewport state.',
    hero: {
      kicker: 'Cornerstone3D v5 · React 18+',
      title: <>Cornerstone3D engine state, as React state</>,
      sub: (
        <>
          Still writing a <code>useEffect</code> and three event subscriptions every time you need
          a slice number on screen? Solve it with one hook — <code>useViewportState</code>.
        </>
      ),
      proof: {
        lines: (byHand, hook) => `${byHand} lines → ${hook} lines`,
        linesLabel: 'to build the same widget',
        effects: 'No useEffect',
        effectsLabel: 'no subscriptions, no cleanup',
        provider: 'No Provider',
        providerLabel: 'your app structure is untouched',
      },
      caption: 'A real Cornerstone3D engine. The numbers beside it are the hook reading.',
      waiting: 'reading',
      demo: 'See the demo',
      github: 'GitHub',
    },
    loading: 'Loading the CT series…',
    failed: 'Could not load the DICOM data',
    panel1: {
      eyebrow: '1',
      title: 'One hook line per value — that is the whole wiring',
      lead: (
        <>
          The CT below is a real Cornerstone3D engine. Scroll it or drag the slider and the widget
          beside it follows. Switching tabs swaps{' '}
          <b>the implementation actually running on this page</b>.
        </>
      ),
      tabHook: 'useViewportState',
      tabByHand: 'Hand-rolled',
      lines: (n) => `${n} lines`,
      viewportHint: 'Scroll or drag the slider to change slice',
      running: 'Currently running',
      note: (
        <>
          <strong>The code on the right isn’t an illustration.</strong>
          <p>
            It is read from the file this page imports and renders
            (<code>demo/widgets.tsx</code>), and the hand-rolled side is the pattern every
            Cornerstone3D + React project repeats per widget.
          </p>
          <p>
            But the line count is the smaller half of it. That code{' '}
            <b>keeps a second copy of state the engine already owns</b>, pushed across by{' '}
            <code>setState</code>. A copy lands a render late, stops updating when an event is
            missed, and disagrees with the widget next to it. The next panel reads instead of
            copying. ↓
          </p>
        </>
      ),
    },
    panel2: {
      eyebrow: '2',
      title: 'Let’s build a slider with the answer React ships',
      lead: (
        <>
          The code in panel 1 copied state the engine already owns into React state. React 18
          ships an official hook that doesn’t copy it but{' '}
          <b>subscribes and reads it on demand</b> — <code>useSyncExternalStore</code>. Let’s use
          it to build <b>something a real screen needs</b>, and see how far it gets.
        </>
      ),
      drag: 'Try dragging it quickly.',
      slowNote: 'This panel’s viewport holds each slice back by 450ms on purpose, so the stall shows on a fast connection too. Engine behaviour is untouched.',
      purge: 'Empty the engine cache',
      purged: 'Emptied. Drag it again.',
      crashed: 'The render stopped',
      fact: (
        <>
          The only change was <code>{'{ slice, total }'}</code>.{' '}
          <b>Returning an object stopped the render.</b>
        </>
      ),
      decode: 'What the code means',
      rules: {
        title: 'How React uses getSnapshot',
        items: [
          'Call getSnapshot() on every render',
          'Compare the result with the previous one using Object.is',
          'If they differ, treat the state as changed and render again',
        ],
      },
      captions: [
        <>
          It takes two arguments. The first is a <b>subscribe function</b> — it registers how
          React gets told the value changed. The second is{' '}
          <b><code>getSnapshot</code></b> — what React calls when it wants{' '}
          <i>“the value, now”</i>. Here it returns <b>one thing</b>: the slice number.
        </>,
        <>
          Here is how React uses that <code>getSnapshot</code>. For now just remember{' '}
          <b>line 2</b> — the comparison is <code>Object.is</code>.
        </>,
        <>
          And <b>it works.</b> The number follows every time the image moves. No{' '}
          <code>setState</code> copy to keep. <b>One value is done.</b> But a slider also needs{' '}
          <b>the total</b>. That is a second value to read.
        </>,
        <>
          Two values, so returning them together is the natural move. The only thing that
          changed in the code on the right is the <code>return</code> line.{' '}
          <b>And this component throws during render.</b>
        </>,
        <>
          Reading <b>two primitives with two hooks</b>, instead of building an object, solves
          it. <b>The slider is done.</b> But <b>drag it fast and the slider stutters.</b> Try it.
        </>,
      ],
      verdict: (
        <>
          <b>Two failures.</b> One is an <b>infinite loop</b>; the other is a{' '}
          <b>stuttering slider</b>. No screen shows just one value, so you will meet both.
          <br />
          <br />
          And they have <b>the same cause.</b> That is the next panel. ↓
        </>
      ),
    },
    panel3: {
      eyebrow: '3',
      title: 'An infinite loop and a stuttering slider, one cause',
      lead: (
        <>
          In panel 2 you hit an error, and the slider stuttered. This panel works out{' '}
          <b>why both happened</b>, and why they have <b>one cause</b>.
        </>
      ),
      bookTitle: 'Hand-wired slider',
      bookBadge: 'by the book',
      hookTitle: 'useViewportState slider',
      hookBadge: 'react-cornerstone3d',
      seeSource: 'See it in the engine’s source',
      netNote: (
        <>
          A slider has to be bound to <b>the input</b>. Bind it to the load instead and the thumb
          moves at the network’s convenience rather than the user’s. <b>A control that locks up is
          the wrong control, whatever number it is showing.</b> If you dragged the slider above,
          there is nothing left to explain.
        </>
      ),
      slowNote: 'This panel’s viewport also holds each slice back by 450ms on purpose. Engine behaviour is untouched.',
      purge: 'Empty the engine cache',
      purged: 'Emptied. Now drag it again.',
      cite: {
        ohif: 'OHIF/Viewers, abridged from 41c03bcf',
        cs3d: 'cornerstone3D, StackViewport.scroll (264ca707)',
      },
      scarsTitle: 'And the same files carry these, too — OHIF’s own comments.',
      scarsEnd: (
        <>
          <b>They know.</b> All four mark the same spot. And after all that, the thumb is still
          bound to a successful load. <b>The largest and oldest viewer in this field hasn’t solved
          it either</b> — the platform keeps its state outside React.
        </>
      ),
      identity: {
        naiveTitle: (n) =>
          `When panel 2 returned an object, React ran this component ${n} times before it stopped. Here is what getSnapshot returned each time.`,
        noRun: 'You haven’t reached the step in panel 2 that returns the object. You can replay that moment here.',
        replay: 'Replay that moment',
        ran: 'Done — the log is recorded. Step forward and back and it will be here.',
        hookTitle: 'Drag the slider. Every render prints the object the hook handed back.',
        holdTitle: 'Now leave the slider alone. The button re-renders this component, nothing else.',
        hold: 'Render again',
        objects: (n) => `${n} object${n === 1 ? '' : 's'}`,
        empty: 'Nothing printed yet.',
        engineNote: (events) => (
          <>
            <b>{events} engine events</b> went by in the same time. The hook coalesces them to one
            update per frame and <b>compares the whole snapshot</b>, building a new object only
            when it actually changed.
          </>
        ),
        naiveVerdict: (
          <>
            The value never changes. But <b>the object number never repeats</b>.{' '}
            <code>return {'{ slice, total }'}</code> — <b>those braces build a new object every
            time the line runs</b>. Same contents, different object.
            <br />
            <br />
            And <b>React compares the object, not the value.</b> So every time it reads “this
            changed”, re-renders, calls again, and gets another new object — the loop above. And
            it isn’t only because you composed the object:{' '}
            <code>viewport.getCamera()</code> hands back a new one on every call too.
          </>
        ),
        hookVerdict: (
          <>
            What differs is <b>when an object gets built</b>. The hand-wired version built{' '}
            <b>a new one every render</b>, value unchanged. The hook builds one{' '}
            <b>only when the engine reports a change</b>, and hands back that same one in between.
          </>
        ),
      },
      captions: [
        <>
          <b>First, the infinite loop.</b> Remember <b>line 1</b> from panel 2 — React calls{' '}
          <code>getSnapshot</code> on every render.
        </>,
        <>
          <b>Second, the stuttering slider.</b> The culprit is the one event picked in the code on the
          right. The index changes <b>synchronously</b>, but <code>STACK_NEW_IMAGE</code> only
          arrives <b>after the image does</b>.
        </>,
        <>
          That is as far as we get on our own. How did <b>OHIF</b>, the largest community in this
          field, solve it? We opened their source — and found the <b>same event</b>.
        </>,
        <>
          <b>One cause</b> — the engine has <b>no object holding the state</b>. The hook keeps
          one. Drag the slider — each change in the value adds an object.
        </>,
        <>
          So far, so obvious. The problem was <b>when the value does not change</b>. In the first
          table the value stayed the same and the object was <b>different every time</b> — that
          was the loop. Leave the value alone and re-render.
        </>,
      ],
      verdict: (
        <>
          With Redux or Zustand <code>getSnapshot</code> is one line,{' '}
          <code>() =&gt; store.getState()</code> — <b>because those libraries already hold a
          stable state object</b>. Cornerstone3D has no such <b>store</b>;{' '}
          <code>useViewportState</code> <b>builds one out of engine events and shares it per
          viewport</b>.
        </>
      ),
    },
    panel4: {
      eyebrow: '4',
      title: 'So how do you use it?',
      lead: (
        <>
          The state object the hook returns is the <b>snapshot</b>; a function that picks just the
          values you need out of it is a <b>selector</b>. There aren’t many rules, and most of them
          you have already seen in the three panels above. Here they are in order.
        </>
      ),
      withSelector: 'with a selector',
      withoutSelector: 'whole snapshot',
      renders: (n) => `${n} renders`,
      nudge: 'Nudge the camera',
      nudgeHint: 'This changes the zoom only. The image moves, the slice number does not — watch which render count climbs.',
      items: [
        {
          title: 'A selector picks; it must not build',
          label: 'selectors',
          mark: 'const voi',
          code: `// re-renders only when this value changes
const slice = useViewportState(id, (s) => s.sliceIndex);

// pulling out something the snapshot already holds is fine too
const camera = useViewportState(id, (s) => s.camera);

// build one inside the selector and it re-renders every time — same value or not
const voi = useViewportState(id, (s) => ({ ...s.voiRange }));`,
          body: (
            <>
              Without a selector, moving the camera redraws your slice readout. And building an
              object inside the selector <b>stops it saving any renders at all</b> — the
              comparison is <code>Object.is</code>, so a fresh object every time reads as a
              change every time. That’s panel 3’s <code>A B C</code>, again.
            </>
          ),
        },
        {
          title: 'Read with the hook, write with Cornerstone3D',
          label: 'writing',
          mark: 'setImageIdIndex',
          code: `const slice = useViewportState(id, (s) => s.sliceIndex);

// this library has no write API. Call the engine directly.
<input
  type="range"
  value={slice}
  onChange={(e) => viewport.setImageIdIndex(Number(e.target.value))}
/>`,
          body: (
            <>
              Deliberately missing. Write to the engine and <b>the engine emits an event</b>; the
              hook updates the snapshot from it. State lives in one place, so two values can never
              disagree.
            </>
          ),
        },
        {
          title: 'undefined is a normal state, not an error',
          label: 'absence',
          mark: 'slice === undefined',
          code: `const slice = useViewportState(id, (s) => s.sliceIndex);

// no viewport yet, no image yet, or the study was closed — all normal
if (slice === undefined) return <span className="empty">—</span>;

return <span>{slice + 1}</span>;`,
          body: (
            <>
              With no viewport the hook returns <code>undefined</code>. It does not throw and it
              does not wait. Don’t insist with <code>!</code> — <b>render the empty state</b>. When
              an image loads, the engine emits an event and the value the hook updates lands here.
            </>
          ),
        },
        {
          title: 'The app owns the engine — no Provider',
          label: 'wiring it in',
          mark: "useViewportState('ct-axial')",
          code: `// the engine your app already creates
new RenderingEngine('my-engine');

// the hook takes a viewportId. No wrapper, no Provider.
const state = useViewportState('ct-axial');

// already calling enableElement yourself? Keep it. This component is optional.
<CornerstoneViewport viewportId="ct-axial" type={ViewportType.STACK} />`,
          body: (
            <>
              The library never creates, holds or configures an engine. It looks a{' '}
              <code>viewportId</code> up in Cornerstone3D’s own global registry. Which is why it{' '}
              <b>drops into an existing app with no refactor.</b>
            </>
          ),
        },
        {
          title: 'One piece of code for Stack and Volume',
          label: 'viewport kinds',
          mark: 'state.kind',
          code: `// Slice Position is common to every viewport kind
const slice = useViewportState(id, (s) => s.sliceIndex);
const total = useViewportState(id, (s) => s.numberOfSlices);

// narrow only when you need a kind-specific field
const state = useViewportState(id);
if (state?.kind === 'stack') { /* ... */ }`,
          body: (
            <>
              One slice control serves both a stack and an MPR. Hand-wired code breaks here:{' '}
              <code>STACK_NEW_IMAGE</code> never arrives on a volume, where the slice is derived
              from the camera instead. The hook absorbs that difference.
            </>
          ),
        },
      ],
      shorts: [
        {
          title: 'Split widgets freely — still one subscription',
          body: (
            <>
              One binding and one snapshot per <code>viewportId</code>, shared by every consumer.
              Breaking an overlay into several small components costs nothing.
            </>
          ),
        },
        {
          title: 'The snapshot is read-only',
          body: (
            <>
              Every nested object is <code>Object.freeze</code>d. Derive from it rather than
              changing it in place.
            </>
          ),
        },
        {
          title: '{ batch: false } only when you truly need it',
          body: (
            <>
              Pass it and every engine event re-renders. The default coalesces them to one update
              per frame — during a drag, engine events arrive dozens of times a second.
            </>
          ),
        },
      ],
    },
    footer: (
      <>The image data is the public CT series the official Cornerstone3D examples use.</>
    ),
  },
};
