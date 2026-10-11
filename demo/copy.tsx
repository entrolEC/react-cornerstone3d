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
    /** The wiring line count on a tab. */
    lines: (n: number) => string;
    /** Printed on the first line the two versions share. */
    same: string;
    /** One word per line that the hand-rolled version has to get right. */
    marks: { mount: string; first: string; pick: string; leak: string; resub: string };
    note: ReactNode;
  };
  panel2: {
    eyebrow: string;
    title: string;
    lead: ReactNode;
    captions: ReactNode[];
    verdict: ReactNode;
    gap: {
      remove: string;
      restore: string;
      hint: ReactNode;
    };
    order: {
      /** One line per scene, per story. */
      scenes: ReactNode[][];
      settling: string;
      noImage: string;
      notYet: string;
      byHand: string;
      hook: string;
    };
    split: {
      first: string;
      late: (n: number) => string;
      add: string;
      hint: ReactNode;
      note: ReactNode;
    };
  };
  panel3: {
    eyebrow: string;
    title: string;
    lead: ReactNode;
    captions: ReactNode[];
    /** One line under the image, per step. */
    notes: ReactNode[];
    verdict: ReactNode;
    /** The fact, at the moment it happens. */
    fact: ReactNode;
    decode: string;
    identity: {
      naiveTitle: (renders: number) => string;
      noRun: string;
      objects: (n: number) => string;
      empty: string;
      naiveVerdict: ReactNode;
    };
  };
  panel4: {
    eyebrow: string;
    title: string;
    lead: ReactNode;
    captions: ReactNode[];
    verdict: ReactNode;
    dragNote: ReactNode;
    identity: {
      hookTitle: string;
      objects: (n: number) => string;
      empty: string;
      engineNote: (events: number) => ReactNode;
      hookVerdict: ReactNode;
    };
    sameWrite: {
      nudge: string;
      hint: ReactNode;
      engine: string;
      renders: string;
      verdict: ReactNode;
    };
    cost: {
      withSelector: string;
      withoutSelector: string;
      renders: (n: number) => string;
      nudge: string;
      nudgeHint: string;
    };
  };
  panel5: {
    eyebrow: string;
    title: string;
    lead: ReactNode;
    captions: ReactNode[];
    verdict: ReactNode;
    wall: {
      slowNote: ReactNode;
      purge: string;
      purged: string;
      seeSource: string;
      scarsTitle: string;
      scarsEnd: ReactNode;
      cite: { ohif: string; cs3d: string };
    };
    diagram: {
      engine: string;
      getters: string;
      gettersNote: string;
      events: string;
      /** What one Binding is keyed by. */
      bindingKey: string;
      build: string;
      /** The finding. Carries the marker. */
      equal: string;
      snapshot: string;
      queue: string;
      queueNote: string;
      hook: string;
      component: string;
      componentNote: string;
      read: string;
      fire: string;
      notify: string;
      caption: ReactNode;
    };
    fields: {
      rows: {
        name: string;
        getter: string;
        hasGetter: boolean;
        event: string;
        hasEvent: boolean;
        result: string;
        field: boolean;
      }[];
      note: ReactNode;
    };
  };
  panel6: {
    eyebrow: string;
    title: string;
    lead: ReactNode;
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
      caption: '진짜 Cornerstone3D 엔진입니다. 드래그하면 W/L이 바뀌고, 옆의 숫자는 훅이 읽고 있습니다.',
      waiting: '읽는 중',
      demo: '데모 보기',
      github: 'GitHub',
    },
    loading: 'CT 시리즈를 불러오는 중…',
    failed: 'DICOM 데이터를 불러오지 못했습니다',
    panel1: {
      eyebrow: '1',
      title: '24줄 vs 2줄',
      lead: (
        <>
          아래 CT는 진짜 Cornerstone3D 엔진입니다. 스크롤로 슬라이스를,{' '}
          <b>드래그로 W/L</b>을 바꿀 수 있습니다. 탭은 <b>실제로 돌고 있는 슬라이더</b>를
          바꿉니다.
        </>
      ),
      tabHook: 'useViewportState',
      tabByHand: 'useState + useEffect',
      lines: (n) => `배선 ${n}줄`,
      same: '여기부터 양쪽 동일',
      marks: {
        mount: '마운트 순서',
        first: '첫 렌더',
        pick: '이벤트 선택',
        leak: '누수',
        resub: '재구독',
      },
      note: (
        <>
          <strong>두 슬라이더 다 잘 동작합니다.</strong>
          <p>
            다른 건 값을 읽어 오는 부분뿐입니다. 흐린 쪽은 양쪽이 똑같아서 흐리게 뒀습니다.
          </p>
          <p>
            그런데 줄 수는 작은 문제입니다. 직접 짠 24줄에 붙은 <b>이름 다섯 개</b>를 보세요.
            <b>다섯 군데를 전부 맞게 써야</b> 돌아갑니다. ↓
          </p>
        </>
      ),
    },
    panel2: {
      eyebrow: '2',
      title: '24줄에서 틀리기 쉬운 세 가지',
      lead: (
        <>
          패널 1이 이름 붙인 다섯 군데 중 <b>셋을 직접 틀려 봅니다.</b> 코드가 잘못돼서가
          아니라 <b>엔진의 값을 React state로 복사</b>했기 때문입니다.
        </>
      ),
      captions: [
        <>
          <b>첫 렌더에 값이 안 들어옵니다.</b> <code>update()</code> 한 줄을 빼면 슬라이더가 빕니다. 영상을
          스크롤해야 살아납니다. 다 불러온 검사에서는 <b>아무 이벤트도 오지 않습니다.</b>
        </>,
        <>
          <b>영상이 나중에 오면 값을 못 읽습니다.</b> 뷰어가 먼저 열리고 영상이 나중에 왔습니다. 흔한 순서인데,
          직접 배선한 쪽은 <b>영영 비어 있습니다.</b>
        </>,
        <>
          <b>검사를 닫아도 숫자가 남습니다.</b> 이번엔 영상이 먼저 있었고, 그다음 닫았습니다. 직접
          배선한 쪽이 <b>없는 영상의 숫자</b>를 붙잡고 있습니다.
        </>,
        <>
          <b>위젯마다 사본이 따로 생깁니다.</b> 하나 더 붙이면 같은 엔진을 보는데 <b>서로 다른 답</b>을
          합니다. 영상을 스크롤하면 그제서야 맞춰집니다.
        </>,
      ],
      verdict: (
        <>
          셋 다 <b>사본</b> 때문입니다. 복사하지 말고 <b>구독해서 읽으면</b> 한꺼번에
          없어집니다. ↓
        </>
      ),
      gap: {
        remove: 'update() 한 줄 빼기',
        restore: 'update() 되돌리기',
        hint: <>빼고 나서 <b>영상을 스크롤</b>해 보세요. 이벤트가 와야 살아납니다.</>,
      },
      order: {
        scenes: [
          [
            <>뷰어 화면이 먼저 열렸습니다. 슬라이더 두 개도 이때 만들어졌고, 읽을 영상이 없습니다.</>,
            <>
              영상이 도착했습니다. <b>훅 쪽은 바로 채워졌고</b>, 직접 짠 쪽은 그대로 비어
              있습니다. <code>getEnabledElementByViewportId</code>가 그때{' '}
              <code>undefined</code>를 돌려줬고, 다시 시도할 일이 없습니다.
            </>,
          ],
          [
            <>영상이 이미 떠 있는 상태에서 슬라이더가 만들어졌습니다. 이 순서에서는 둘 다 정상입니다.</>,
            <>
              검사를 닫았습니다. 영상은 사라졌는데 <b>직접 짠 쪽은 방금 전 숫자를 그대로 붙잡고
              있습니다.</b> 없는 영상의 슬라이스 번호입니다. 훅은 비웁니다.
            </>,
          ],
        ],
        settling: '준비 중…',
        noImage: '아직 영상이 없음',
        notYet: '아직 화면에 없음',
        byHand: '직접 배선',
        hook: '훅',
      },
      split: {
        first: '처음부터 있던 위젯',
        late: (n) => `${n}번째 위젯 (방금 붙음)`,
        add: '위젯 하나 더 붙이기',
        hint: <>지금 붙은 위젯은 <b>자기 사본이 비어 있습니다.</b> 영상을 스크롤하면 그제서야 맞춰집니다.</>,
        note: <>실제 뷰어는 같은 값을 읽는 위젯을 여럿 답니다. 툴바, 오버레이, 썸네일, 스크롤바.</>,
      },
    },
    panel3: {
      eyebrow: '3',
      title: 'useSyncExternalStore로 바꾸면 생기는 문제',
      lead: (
        <>
          React 18에는 <b>복사하지 않고 구독해서 읽는</b> 공식 훅{' '}
          <code>useSyncExternalStore</code>가 있습니다. 값이 둘이 되는 순간 막힙니다.
        </>
      ),
      captions: [
        <>
          <b>값 하나는 잘 됩니다.</b> 슬라이스 번호만 읽었습니다. 복사도, <code>useEffect</code>도,
          첫 렌더 갭도 없습니다. 그런데 슬라이더에는 <code>max</code>도 필요합니다. 지금은
          브라우저 기본값 100이라 손잡이가 엉뚱한 데 있습니다.
        </>,
        <>
          <b>전체 장수도 같이 읽습니다.</b> 두 값을 객체 하나로 묶어 돌려주는 방법이 제일
          자연스럽습니다. <b>눌러 보세요.</b>
        </>,
        <>
          <b>객체가 매번 새것이라 멈췄습니다.</b> React가 매 렌더에서 받은 것을 그대로 찍었습니다. 값은 전부 같은데{' '}
          <b>객체는 매번 새것</b>입니다.
        </>,
      ],
      notes: [
        <><code>max</code>를 안 읽어서 손잡이 위치가 틀립니다. 값 하나로는 슬라이더가 안 됩니다.</>,
        <>오른쪽 카드가 <b>슬라이더가 있어야 할 자리</b>입니다.</>,
        <>같은 값, 다른 객체. React는 값이 아니라 객체를 비교합니다.</>,
      ],
      fact: (
        <>
          <b>슬라이더가 없습니다.</b> 컴포넌트가 던졌고, 자기 화면을 들고 같이 사라졌습니다.
        </>
      ),
      decode: '에러 코드 설명 보기',
      identity: {
        naiveTitle: (renders) => `React가 포기하기까지 ${renders}번 렌더했습니다`,
        noRun: '아직 실행 전입니다. 2단계에서 버튼을 눌러 주세요.',
        objects: (n) => `서로 다른 객체 ${n}개`,
        empty: '아직 없음',
        naiveVerdict: (
          <>
            <code>getSnapshot</code>이 <b>매번 새 객체</b>를 돌려줍니다. React는{' '}
            <code>Object.is</code>로 비교하니 매번 "바뀌었다"가 되고, 바뀌었으니 다시 렌더하고,
            다시 렌더하니 또 새 객체가 나옵니다. React가 루프를 알아채고 끊습니다.
          </>
        ),
      },
      verdict: (
        <>
          엔진의 getter는 부를 때마다 새 객체를 줍니다. <code>getCamera()</code>를 두 번
          불러도 서로 다른 객체입니다. 그래서 <b>값이 진짜 바뀌었을 때만 새 객체를 만드는
          무언가</b>가 중간에 필요합니다. 다음 패널에서 다룹니다. ↓
        </>
      ),
    },
    panel4: {
      eyebrow: '4',
      title: '이벤트는 쌓이고 리렌더는 그대로',
      lead: (
        <>
          <code>useViewportState</code>는 엔진 이벤트가 올 때만 Snapshot을 다시 만들고,{' '}
          <b>같으면 아무에게도 알리지 않습니다.</b> 패널 3의 로그를 훅으로 다시 돌립니다.
        </>
      ),
      captions: [
        <>
          <b>값이 바뀌면 객체도 바뀝니다.</b> 값이 바뀌니 객체도
          바뀝니다. 여기까지는 패널 3과 같아 보입니다.
        </>,
        <>
          <b>같은 값을 다시 써도 엔진은 이벤트를 냅니다.</b> 버튼을 여러 번 눌러 보세요. 패널
          3에서는 여기서 <code>#1 #2 #3</code>이 나왔습니다.
        </>,
        <>
          <b>selector로 한 값만 읽습니다.</b> 스냅샷을 통째로 읽으면 카메라가 움직여도 리렌더됩니다.
          한 값만 읽으면 그 값이 바뀔 때만 리렌더됩니다. <b>카메라를 움직여 보세요.</b>
        </>,
      ],
      dragNote: <>영상을 스크롤하거나 끌어 보세요. 옆의 로그가 실시간으로 쌓입니다.</>,
      verdict: (
        <>
          패널 3의 <code>#1 #2 #3</code>과 위 <code>#1 #1 #1</code>은 같은 표입니다. 중간에{' '}
          <b>스냅샷</b>이 있느냐만 다릅니다.
          <br />
          여기까지가 <b>어떻게 읽는가</b>였습니다. 남은 건 <b>무엇을 언제 읽는가</b>이고,
          그게 훨씬 어렵습니다. ↓
        </>
      ),
      identity: {
        hookTitle: '옮기는 중',
        objects: (n) => `서로 다른 객체 ${n}개`,
        empty: '아직 없음',
        engineNote: (events) => (
          <>
            그동안 엔진이 낸 이벤트: <b>{events}개</b>. 훅이 그걸 위 몇 개의 객체로 줄였습니다.
          </>
        ),
        hookVerdict: (
          <>
            <b>엔진은 조용하지 않습니다.</b> 한 번의 슬라이스 이동이 이벤트 여러 개입니다.
            그런데 컴포넌트가 받는 객체는 <b>값이 실제로 달라졌을 때만</b> 새것입니다.
          </>
        ),
      },
      sameWrite: {
        nudge: '같은 값으로 다시 쓰기',
        hint: (
          <>
            누를 때마다 <code>setCamera(viewport.getCamera())</code>를 부릅니다. 방금 읽은
            카메라를 그대로 다시 씁니다. 그래도 엔진은 이벤트를 내고,{' '}
            <b>값은 한 군데도 달라지지 않습니다.</b>
          </>
        ),
        engine: '엔진이 낸 이벤트',
        renders: '훅이 React에 알린 횟수',
        verdict: (
          <>
            왼쪽만 올라갑니다. <b>리렌더는 일어나지 않았습니다.</b> 값이 그대로라서
            훅이 React에 알리지 않았습니다.
            <br />
            이번엔 슬라이더를 움직여 보세요. 값이 진짜 바뀌니 오른쪽도 올라갑니다.
          </>
        ),
      },
      cost: {
        withSelector: 'selector로 한 값만',
        withoutSelector: 'Snapshot 통째로',
        renders: (n) => `렌더 ${n}회`,
        nudge: '카메라 움직이기',
        nudgeHint: (
          'Snapshot의 camera가 바뀌니 통째로 읽는 쪽은 리렌더됩니다. selector 쪽 숫자는 그대로입니다.'
        ),
      },
    },
    panel5: {
      eyebrow: '5',
      title: '이벤트를 잘못 고르면 생기는 일',
      lead: (
        <>
          여기까지는 <b>어떻게 읽는가</b>였습니다. 남은 질문은{' '}
          <b>무엇을 언제 읽는가</b>입니다.
        </>
      ),
      captions: [
        <>
          <b>이벤트 이름은 맞는데 타이밍이 틀립니다.</b> <code>STACK_NEW_IMAGE</code>는{' '}
          <b>이미지를 다 받은 뒤에</b> 나옵니다. 캐시를 비우고 슬라이더를 빠르게 끌어 보세요.
          손잡이가 뒤에서 따라옵니다.
        </>,
        <>
          <b>라이브러리가 대신 정합니다.</b> 어떤 getter를 어떤 이벤트에 묶을지, 다시
          만든 게 정말 달라졌는지, 한 프레임에 몇 번 알릴지.
        </>,
        <>
          <b>아무 값이나 주지 않습니다.</b> 값을 읽을 getter와, 값이 움직였다고 알려줄
          이벤트가 둘 다 있어야 필드가 됩니다. <b>딱 한 줄만 빼고요.</b>
        </>,
      ],
      verdict: (
        <>
          <code>useViewportState</code>가 대신 해 주는 건 훅 한 줄이 아니라 <b>이 결정들</b>
          입니다. 어떤 이벤트에 어떤 값이 바뀌는지, 무엇을 안 바뀐 걸로 볼지, 한 프레임에 몇 번
          알릴지. 위젯마다 다시 정할 일이 아닙니다.
        </>
      ),
      wall: {
        slowNote: '이 단계만 슬라이스 도착을 450ms 늦춰 뒀습니다. 빠른 회선에서도 보이게 하려고요. 엔진 동작은 그대로입니다.',
        purge: '캐시 비우기',
        purged: '비웠습니다',
        seeSource: '엔진 소스에서 확인하기',
        scarsTitle: 'OHIF도 같은 자리에서 막혔습니다',
        scarsEnd: (
          <>
            <b>넷 다 같은 자리에서 싸운 기록입니다.</b> 그런데도 손잡이는 여전히 로드 완료
            이벤트에 묶여 있습니다. 상태가 React 밖에 있어서 그렇습니다.
          </>
        ),
        cite: {
          ohif: 'OHIF/Viewers @ 41c03bcfd8ac',
          cs3d: 'cornerstone3D/StackViewport.ts @ 264ca707f481',
        },
      },
      diagram: {
        engine: 'Cornerstone3D 엔진',
        getters: 'viewport getter',
        gettersNote: '부를 때마다 새 객체를 돌려준다',
        events: 'element 이벤트',
        bindingKey: 'viewportId 하나당 하나',
        build: '이벤트가 오면 다시 만든다. 안 움직인 부분은 이전 참조를 그대로 둔다',
        equal: '다시 만든 게 이전과 같으면, 아무에게도 알리지 않는다',
        snapshot: '불변이고 참조가 안정적이다',
        queue: '프레임 큐 하나',
        queueNote: '한 프레임에 더러워진 Binding을 모아 한 번만 알린다',
        hook: 'Object.is가 다를 때만 리렌더한다',
        component: '컴포넌트',
        componentNote: '엔진 상태의 순수 함수',
        read: '읽기',
        fire: '발사',
        notify: '알림',
        caption: (
          <>
            쓰기는 이 그림에 없습니다. 컴포넌트가 Cornerstone3D를 직접 부르고, 그 결과는{' '}
            <b>엔진 이벤트로 되돌아와서만</b> React에 도착합니다. 읽기 경로가 하나뿐인
            이유이고, 패널 1에서 흐리게 뒀던 그 부분입니다.
          </>
        ),
      },
      fields: {
        rows: [
          {
            name: '슬라이스, 장수, W/L, 카메라',
            getter: 'getSliceIndex() 등',
            hasGetter: true,
            event: 'STACK_NEW_IMAGE 등',
            hasEvent: true,
            result: 'useViewportState',
            field: true,
          },
          {
            name: '이 슬라이스가 캐시에 있는가',
            getter: 'cache.isLoaded()',
            hasGetter: true,
            event: 'IMAGE_CACHE_IMAGE_ADDED',
            hasEvent: true,
            result: 'useImageLoadState',
            field: true,
          },
          {
            name: '이 슬라이스가 로드에 실패했는가',
            getter: '실패하면 캐시가 항목을 지워서, 요청한 적 없는 것과 구분되지 않습니다',
            hasGetter: false,
            event: 'IMAGE_LOAD_FAILED',
            hasEvent: true,
            result: 'useImageLoadState',
            field: true,
          },
          {
            name: '이 슬라이스가 로딩 중인가',
            getter: 'cache.getImageLoadObject()',
            hasGetter: true,
            event: '요청이 시작될 때 나오는 이벤트가 없습니다',
            hasEvent: false,
            result: '앱이 직접 읽습니다',
            field: false,
          },
        ],
        note: (
          <>
            셋째 줄은 getter가 없는데도 훅이 줍니다. 실패한 뒤에 올 수 있는 건 재시도 성공
            아니면 또 한 번의 실패뿐이고, <b>둘 다 훅이 듣습니다.</b> 그래서 기억해 둬도
            틀릴 일이 없습니다.
            <br />
            넷째 줄은 요청이 시작되는 걸 알려주는 이벤트가 없습니다. 기억해 두면 틀린 채로
            남습니다.
          </>
        ),
      },
    },
    panel6: {
      eyebrow: '6',
      title: '자주 쓰는 패턴',
      lead: (
        <>
          훅이 돌려주는 상태 객체가 <b>스냅샷</b>, 거기서 값만 골라 읽는 함수가{' '}
          <b>셀렉터</b>입니다. 규칙은 대부분 앞에서 이미 봤습니다.
        </>
      ),
      items: [
        {
          title: '셀렉터 안에서 새 객체를 만들지 마세요',
          label: '셀렉터',
          mark: 'const voi',
          code: `// 이 값이 바뀔 때만 리렌더됩니다
const slice = useViewportState(id, (s) => s.sliceIndex);

// 스냅샷에 이미 있는 값을 읽는 것도 안전합니다
const camera = useViewportState(id, (s) => s.camera);

// 셀렉터 안에서 새로 만들면, 고른 값이 그대로여도 매번 리렌더됩니다
const voi = useViewportState(id, (s) => ({ ...s.voiRange }));`,
          body: (
            <>
              셀렉터가 없으면 카메라만 움직여도 슬라이스 표시기가 다시 그려집니다. 그리고 셀렉터
              안에서 객체를 만들면 <b>리렌더가 전혀 줄지 않습니다.</b> 비교가{' '}
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
          title: 'undefined는 정상 상태입니다',
          label: '없음 다루기',
          mark: 'slice === undefined',
          code: `const slice = useViewportState(id, (s) => s.sliceIndex);

// 뷰포트가 아직 없거나, 영상이 아직 없거나, 검사를 닫았습니다. 전부 정상입니다
if (slice === undefined) return <span className="empty">—</span>;

return <span>{slice + 1}</span>;`,
          body: (
            <>
              훅은 뷰포트가 없으면 <code>undefined</code>를 돌려줍니다. 던지지도, 기다리지도
              않습니다. <code>!</code>로 단언하지 말고 <b>빈 상태를 그리세요.</b> 영상이 로드되면
              엔진이 이벤트를 발생시키고, 훅이 갱신한 값이 이 자리에 들어옵니다.
            </>
          ),
        },
        {
          title: 'Provider가 필요 없습니다',
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
          title: 'Stack과 Volume을 같은 코드로 다룹니다',
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
              슬라이스 컨트롤 하나로 Stack과 MPR을 함께 다룹니다. 직접 짜면 Volume에서
              갱신이 멈춥니다. Volume에는 <code>STACK_NEW_IMAGE</code>가 안 오고, 슬라이스가
              카메라에서 나옵니다. 훅이 그 차이를 알아서 처리합니다.
            </>
          ),
        },
        {
          title: '캐시 상태도 읽을 수 있습니다',
          label: '다른 훅',
          mark: 'useImageLoadState',
          code: `// 슬라이스 하나가 캐시에 있는지
const state = useImageLoadState(imageId);     // 'absent' | 'loaded' | 'failed'

// 스택 전체를 한 번에
const states = useImageLoadStates(imageIds);  // 같은 값의 배열

// 캐시가 지금 쥐고 있는 바이트
const { imageBytes } = useCacheState();`,
          body: (
            <>
              출처가 다릅니다. 위의 <code>useViewportState</code>는 <b>뷰포트의 말</b>이고,
              이 셋은 <b>캐시 모듈의 말</b>입니다. <code>'loaded'</code>는 캐시에 들어왔다는
              뜻이지 캔버스에 그려졌다는 뜻이 아닙니다. 둘을 합치는 건 앱이 합니다.
              라이브러리는 합쳐 주지 않습니다.
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
          title: 'cleanup을 빠뜨릴 일이 없습니다',
          body: (
            <>
              StrictMode는 마운트를 두 번 합니다. 직접 배선한 위젯에서{' '}
              <code>removeEventListener</code> 세 줄을 빠뜨리면 리스너가 그대로 쌓입니다.
              패널 1에서 '누수'라고 이름 붙인 그 줄들입니다. 훅을 쓰면 그 세 줄이 필요
              없습니다.
            </>
          ),
        },
        {
          title: '한 프레임에 한 번만 알립니다',
          body: (
            <>
              드래그 중에는 엔진 이벤트가 초당 수십 번 옵니다. 같은 프레임에 온 건 모아서 한
              번만 알립니다. 끄는 옵션은 없습니다. 훅 둘이 서로 다른 프레임을 읽으면 화면이
              어긋나기 때문입니다.
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
      caption: 'A real Cornerstone3D engine. Drag it for window/level — the numbers beside it are the hook reading.',
      waiting: 'reading',
      demo: 'See the demo',
      github: 'GitHub',
    },
    loading: 'Loading the CT series…',
    failed: 'Could not load the DICOM data',
    panel1: {
      eyebrow: '1',
      title: 'One slider: 24 lines of wiring become 2',
      lead: (
        <>
          The CT below is a real Cornerstone3D engine. Scroll for the slice,{' '}
          <b>drag for window/level</b>. The tabs switch{' '}
          <b>the slider actually running under it</b>.
        </>
      ),
      tabHook: 'useViewportState',
      tabByHand: 'useState + useEffect',
      lines: (n) => `${n} lines of wiring`,
      same: 'identical below',
      marks: {
        mount: 'mount order',
        first: 'first render',
        pick: 'which event',
        leak: 'leak',
        resub: 're-subscribe',
      },
      note: (
        <>
          <strong>Both sliders work, right now.</strong>
          <p>
            They differ only above the <code>&lt;input&gt;</code>, in how the values are read.
            Everything below it — the markup and the <code>setImageIdIndex</code> write — is
            identical, which is why it is dimmed. Writes are plain Cornerstone3D calls; this
            library has no write API.
          </p>
          <p>
            And the line count is the small problem. Look at the <b>five names</b> on the
            hand-rolled version. It is not that it is long — it is that all five have to be
            right. The next panel gets each of them wrong. ↓
          </p>
        </>
      ),
    },
    panel2: {
      eyebrow: '2',
      title: 'Not because it is long. Because those 24 lines can be wrong',
      lead: (
        <>
          Panel 1 named five places. <b>Here you get three of them wrong yourself</b> — not by
          mistyping, but by <b>copying state the Engine already holds</b>.
        </>
      ),
      captions: [
        <>
          <b>First render.</b> Take out the <code>update()</code> line and the slider empties.
          Scrolling the image brings it back — on a study that has finished loading,{' '}
          <b>no event ever arrives</b> on its own.
        </>,
        <>
          <b>Mount order.</b> The viewer opened first and the image came later. The common
          order — and the hand-rolled one stays <b>empty forever.</b>
        </>,
        <>
          <b>Same code, opposite order.</b> This time the image was there and the study gets
          closed. The hand-rolled one holds <b>a number for an image that is gone.</b>
        </>,
        <>
          <b>More than one copy.</b> Add a second widget and they give <b>different answers</b>{' '}
          about the same engine. Scrolling the image brings them together.
        </>,
      ],
      verdict: (
        <>
          All three are the <b>copy</b>. A copy has to be filled (1), depends on when it was made
          (2), and once there are several there is no way to keep them in step (3). Under
          concurrent rendering this shows up as <b>tearing</b> — two components disagreeing inside
          one frame. The demo never enters that mode, so it is not staged here; the reasoning is
          in <code>docs/adr/0005</code>.
          <br />
          Stop copying and <b>subscribe and read</b> instead, and all three go at once. React 18
          ships the hook for it — <code>useSyncExternalStore</code>. Next panel builds the slider
          with it. ↓
        </>
      ),
      gap: {
        remove: 'remove the update() line',
        restore: 'put update() back',
        hint: <>Then <b>scroll the image</b> — only an event brings it back.</>,
      },
      order: {
        scenes: [
          [
            <>The viewer opened first. Both sliders were made now, with no image to read.</>,
            <>
              The image arrived. <b>The hook filled in immediately</b>; the hand-rolled one is
              still empty — <code>getEnabledElementByViewportId</code> returned{' '}
              <code>undefined</code> back then, and nothing gives it a reason to try again.
            </>,
          ],
          [
            <>The image was already up when the sliders were made. In this order both work.</>,
            <>
              The study was closed. The image is gone, and <b>the hand-rolled one is still
              holding the last number it saw</b> — a slice index of an image that no longer
              exists. The hook empties.
            </>,
          ],
        ],
        settling: 'settling…',
        noImage: 'no image yet',
        notYet: 'not on screen yet',
        byHand: 'by hand',
        hook: 'hook',
      },
      split: {
        first: 'the widget that was here',
        late: (n) => `widget ${n} (just added)`,
        add: 'add another widget',
        hint: <>The new one <b>has an empty copy of its own.</b> Scroll the image and it catches up.</>,
        note: <>A real viewer hangs several widgets off the same value — toolbar, overlay, thumbnails, scrollbar.</>,
      },
    },
    panel3: {
      eyebrow: '3',
      title: 'The copy is gone. Now nothing renders at all',
      lead: (
        <>
          React 18 ships a hook that <b>subscribes and reads</b> instead of copying —{' '}
          <code>useSyncExternalStore</code>. Then you need a second value.
        </>
      ),
      captions: [
        <>
          <b>One value works.</b> Just the slice index. No copy, no <code>useEffect</code>, no
          first-render gap. But a slider also needs <code>max</code> — right now it is the
          browser's default 100, so the thumb is in the wrong place.
        </>,
        <>
          <b>So read the total too.</b> Hand both back as one object: the obvious way to do it.{' '}
          <b>Press it.</b>
        </>,
        <>
          <b>Why it died.</b> This is what React was handed on each render. The values are all
          the same — and <b>every object is a new one.</b>
        </>,
      ],
      notes: [
        <><code>max</code> is unread, so the thumb is wrong — one value is not a slider.</>,
        <>The card on the right is <b>where the slider should be.</b></>,
        <>Same value, different object. React compares objects, not values.</>,
      ],
      fact: (
        <>
          <b>There is no slider.</b> The component threw, and took its surface with it.
        </>
      ),
      decode: 'what this code means',
      identity: {
        naiveTitle: (renders) => `React rendered ${renders} times before giving up`,
        noRun: 'Nothing has run yet — press the button back on step 2.',
        objects: (n) => `${n} distinct objects`,
        empty: 'nothing yet',
        naiveVerdict: (
          <>
            <code>getSnapshot</code> returns <b>a new object every call</b>. React compares with{' '}
            <code>Object.is</code>, so every call reads as "changed"; changed means render again,
            and rendering again produces another new object. React spots the loop and cuts it.
          </>
        ),
      },
      verdict: (
        <>
          The Engine's getters hand back a fresh object every call — not because we wrapped two
          values in one, but because <code>getCamera()</code> twice is already two objects. So
          something in the middle has to <b>build a new object only when the values actually
          change</b>. That is the next panel. ↓
        </>
      ),
    },
    panel4: {
      eyebrow: '4',
      title: 'Build a new object only when the values actually change',
      lead: (
        <>
          <code>useViewportState</code> rebuilds the Snapshot on an Engine event, and{' '}
          <b>if it says the same thing, nobody is told.</b> Here is panel 3's log again.
        </>
      ),
      captions: [
        <>
          <b>Same table, different ending.</b> Recorded while the slice moves. The value
          changes, so the object does — so far this looks like panel 3.
        </>,
        <>
          <b>Now write to the Engine without changing a value.</b> Press the button a few
          times. In panel 3 this is where <code>#1 #2 #3</code> came from.
        </>,
        <>
          <b>And the selector.</b> Read the whole Snapshot and a camera move re-renders you. Read
          one value and only that value re-renders you. <b>Nudge the camera.</b>
        </>,
      ],
      dragNote: <>Scroll or drag the image. The log beside it fills as it happens.</>,
      verdict: (
        <>
          Panel 3's <code>#1 #2 #3</code> and the <code>#1 #1 #1</code> above are the same table.
          The only difference is a <b>Snapshot</b> in the middle — rebuilt on Engine events,
          keeping the references of whatever did not move, and silent when nothing did.
          <br />
          That was <b>how to read</b>. What is left is <b>what to read, and when</b> — and that
          one is much harder. ↓
        </>
      ),
      identity: {
        hookTitle: 'While it moves',
        objects: (n) => `${n} distinct objects`,
        empty: 'nothing yet',
        engineNote: (events) => (
          <>
            Engine events in that time: <b>{events}</b>. The hook turned them into the handful of
            objects above.
          </>
        ),
        hookVerdict: (
          <>
            <b>The Engine is not quiet.</b> One slice change is a burst of events. The object the
            component receives is new <b>only when the values actually differ.</b>
          </>
        ),
      },
      sameWrite: {
        nudge: 'write the same value back',
        hint: (
          <>
            Each press is <code>setCamera(viewport.getCamera())</code> — a write that reads the
            camera and hands it straight back. The Engine fires <code>CAMERA_MODIFIED</code>{' '}
            anyway, and <b>not one value is different.</b>
          </>
        ),
        engine: 'events the Engine fired',
        renders: 'times the hook told React',
        verdict: (
          <>
            Only the left number moves. <b>The re-render never happened</b> — the Binding compared
            its rebuilt Snapshot with the previous one <b>by value</b>, found them the same, and
            told nobody. The Engine's getters hand back a fresh object every call; a fresh object
            is not new state.
            <br />
            Move the slider, or <b>drag the image to change window/level</b> — those do change a
            value, and the right-hand numbers move with them.
          </>
        ),
      },
      cost: {
        withSelector: 'one value, via selector',
        withoutSelector: 'the whole Snapshot',
        renders: (n) => `${n} renders`,
        nudge: 'nudge the camera',
        nudgeHint: (
          "The Snapshot's camera changes, so the whole-Snapshot reader re-renders. The selector's count stays put."
        ),
      },
    },
    panel5: {
      eyebrow: '5',
      title: 'Nobody tells you which event to listen to',
      lead: (
        <>
          So far this was <b>how to read</b>. What is left is{' '}
          <b>what to read, and when</b>.
        </>
      ),
      captions: [
        <>
          <b>The event with the right name.</b> <code>STACK_NEW_IMAGE</code> fires only when the
          Engine <b>successfully loaded the image</b>. Purge the cache and drag fast — the thumb
          trails behind.
        </>,
        <>
          <b>So the library carries this.</b> Which getter hangs off which event, whether a
          rebuild actually says something new, and how often to tell React in one frame.
        </>,
        <>
          <b>It does not hand you everything, though.</b> A value needs a getter to read it and
          an event to say it moved — <b>except one row</b>.
        </>,
      ],
      verdict: (
        <>
          What <code>useViewportState</code> sells is not one line of hook. It is{' '}
          <b>these decisions</b> — which event invalidates which value, what counts as
          unchanged, how often React hears about it. Not a thing to re-decide per widget.
        </>
      ),
      wall: {
        slowNote: "This step's viewport delays each slice by 450ms on purpose, so the lag shows on a fast connection too. The Engine behaves exactly as it always does.",
        purge: 'purge the cache',
        purged: 'purged — now drag',
        seeSource: 'check it in the Engine source',
        scarsTitle: 'Not just us — OHIF’s code',
        scarsEnd: (
          <>
            <b>They know.</b> All four mark the same fight. And after all of it the thumb is
            still bound to a successful load — because the platform keeps its state outside
            React.
          </>
        ),
        cite: {
          ohif: 'OHIF/Viewers @ 41c03bcfd8ac',
          cs3d: 'cornerstone3D/StackViewport.ts @ 264ca707f481',
        },
      },
      diagram: {
        engine: 'Cornerstone3D engine',
        getters: 'viewport getters',
        gettersNote: 'a fresh object on every call',
        events: 'element events',
        bindingKey: 'one per viewportId',
        build: 'rebuild on an event, keeping the references of whatever did not move',
        equal: 'if the rebuild says the same thing, nobody is told',
        snapshot: 'immutable, and the reference holds',
        queue: 'one frame queue',
        queueNote: 'every Binding dirtied in a frame is told once, together',
        hook: 're-renders only when Object.is differs',
        component: 'component',
        componentNote: 'a pure function of Engine state',
        read: 'read',
        fire: 'fire',
        notify: 'notify',
        caption: (
          <>
            Writes are not on this picture. The component calls Cornerstone3D directly and the
            effect reaches React <b>only by coming back as an Engine event</b> — which is why
            there is one read path, and what the dimmed half of panel 1 was.
          </>
        ),
      },
      fields: {
        rows: [
          {
            name: 'slice, count, W/L, camera',
            getter: 'getSliceIndex(), …',
            hasGetter: true,
            event: 'STACK_NEW_IMAGE, …',
            hasEvent: true,
            result: 'useViewportState',
            field: true,
          },
          {
            name: 'is this slice in the cache',
            getter: 'cache.isLoaded()',
            hasGetter: true,
            event: 'IMAGE_CACHE_IMAGE_ADDED',
            hasEvent: true,
            result: 'useImageLoadState',
            field: true,
          },
          {
            name: 'did this slice fail to load',
            getter: 'on failure the cache drops the entry, so it reads like one never requested',
            hasGetter: false,
            event: 'IMAGE_LOAD_FAILED',
            hasEvent: true,
            result: 'useImageLoadState',
            field: true,
          },
          {
            name: 'is this slice loading',
            getter: 'cache.getImageLoadObject()',
            hasGetter: true,
            event: 'nothing fires when the request starts',
            hasEvent: false,
            result: 'you read it yourself',
            field: false,
          },
        ],
        note: (
          <>
            The third row breaks the rule — no getter, and the hook gives it anyway. It comes
            with a condition: if <b>every next thing the Engine can say about that image is an
            event the hook hears</b> (a retry that succeeds, or another failure), then the
            remembered state cannot go quietly stale. So a failure that was heard is a field.
            The fourth row is not — nothing announces the moment a request starts, so anything
            the hook remembered would simply stay wrong.
          </>
        ),
      },
    },
    panel6: {
      eyebrow: '6',
      title: 'So how do you use it?',
      lead: (
        <>
          The object the hook returns is the <b>snapshot</b>; a function that picks values out
          of it is a <b>selector</b>. Most of these you have already seen.
        </>
      ),
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
        {
          title: 'Viewport state is not the only thing you can read',
          label: 'the other hooks',
          mark: 'useImageLoadState',
          code: `// is one slice in the cache
const state = useImageLoadState(imageId);     // 'absent' | 'loaded' | 'failed'

// a whole stack at once
const states = useImageLoadStates(imageIds);  // an array of the same

// bytes the cache is holding right now
const { imageBytes } = useCacheState();`,
          body: (
            <>
              Different sources. <code>useViewportState</code> above is <b>the viewport's
              word</b>; these three are <b>the cache module's</b>. <code>'loaded'</code> means
              the cache has the image, not that it is painted on a canvas. Joining the two is
              the app's job — the library does not do it for you.
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
          title: 'Nothing leaks because you forgot a cleanup',
          body: (
            <>
              StrictMode mounts twice. In a hand-rolled widget, missing the three{' '}
              <code>removeEventListener</code> lines piles listeners up — the lines panel 1
              labelled “leak”. With the hook those three lines are inside the library.
            </>
          ),
        },
        {
          title: 'One update per frame, and you cannot turn it off',
          body: (
            <>
              During a drag, engine events arrive dozens of times a second. Every binding dirtied
              in a frame is handled in one pass, and that is not an option — two hooks reading
              different frames is exactly what tearing is (<code>docs/adr/0006</code>).
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
