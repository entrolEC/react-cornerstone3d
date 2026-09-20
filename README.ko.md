# react-cornerstone3d

[English](./README.md) · **[라이브 데모 →](https://entrolec.github.io/react-cornerstone3d/)**

[Cornerstone3D](https://www.cornerstonejs.org/)의 살아있는 엔진 상태를 React 컴포넌트에 노출하는 React 바인딩 — `useSyncExternalStore` 기반, tearing 없음.

```bash
npm install react-cornerstone3d
```

```tsx
import { useViewportState } from 'react-cornerstone3d';

function SliceIndicator() {
  const index = useViewportState('ct-axial', (s) => s.sliceIndex); // Stack·Volume 공통
  if (index === undefined) return null; // 뷰포트가 아직 enable 전이거나 슬라이스가 없음 — 정상 상태이며, 뭘 보여줄지는 앱의 몫
  return <span>slice {index + 1}</span>;
}
```

이 훅 한 줄이, 오늘날 모든 Cornerstone3D + React 앱이 위젯마다 작성하는 ~25줄의 `useEffect` + `addEventListener` + `setState` 배관을 대체합니다.

<details>
<summary>훅이 없다면 어떤 코드를 쓰게 되는지 펼쳐보기</summary>

```tsx
function SliceIndicator() {
  const [state, setState] = useState<{ imageIdIndex: number }>();

  useEffect(() => {
    const enabled = getEnabledElementByViewportId('ct-axial');
    if (!enabled) return; // 뷰포트가 아직 enable 전이면? 나중에 생기면? — 처리 안 됨
    const { element } = enabled.viewport;

    const update = () => {
      const viewport = enabled.viewport as Types.IStackViewport;
      setState({ imageIdIndex: viewport.getCurrentImageIdIndex() });
    };
    update(); // 첫 렌더 ~ 구독 시작 사이의 갭 보정 — 잊기 쉬운 줄

    element.addEventListener(Enums.Events.CAMERA_MODIFIED, update);
    element.addEventListener(Enums.Events.VOI_MODIFIED, update);
    element.addEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    return () => {
      element.removeEventListener(Enums.Events.CAMERA_MODIFIED, update);
      element.removeEventListener(Enums.Events.VOI_MODIFIED, update);
      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    };
  }, []);

  if (!state) return null;
  return <span>slice {state.imageIdIndex + 1}</span>;
}
```

이 27줄을 쓰고도 남는 문제들: 마운트 순서 경합(뷰포트가 나중에 enable되면 영영 `undefined`), concurrent 렌더링에서의 tearing, 드래그 중 이벤트마다 리렌더(배칭 없음), 그리고 이 전부를 위젯마다 반복. 라이브러리는 이것들을 중앙에서 해결합니다.

</details>

## 왜 만들었나

Cornerstone3D는 의도적으로 프레임워크 비종속이며 React 바인딩을 제공하지 않습니다. 그래서 모든 React 뷰어가 같은 이벤트 배관을 손수 재발명하고, 그와 함께 같은 버그 계층을 떠안습니다:

- **업데이트 유실** — 첫 렌더와 `useEffect` 구독 시작 사이의 갭
- **Tearing** — React 18+ concurrent 렌더링에서 한 화면의 두 컴포넌트가 서로 다른 슬라이스 번호를 표시
- **구독 누수** — StrictMode 이중 마운트에서
- **마운트 순서 경합** — 뷰포트가 enable되기 전에 UI가 먼저 마운트될 때
- **무한 루프 또는 깊은 비교 땜질** — Cornerstone3D getter는 매 호출 새 객체를 반환하므로 naive한 `getSnapshot`은 절대 안정되지 않음 (OHIF는 훅마다 `JSON.stringify` 비교로 덮어둠)

이 라이브러리는 그 버그 계층을 중앙에서 한 번에 해결합니다. UI 컴포넌트는 엔진 상태의 순수 함수가 됩니다.

## 핵심 설계

모든 것을 결정하는 세 가지 선택 (전체 근거는 [`docs/adr/`](./docs/adr/)):

1. **Engine이 유일한 진실 공급원.** 읽기는 Engine → 이벤트 → 불변 Snapshot → `useSyncExternalStore`로 흐릅니다. 쓰기는 평범한 Cornerstone3D API 호출 그대로이며 — 그 효과는 엔진 이벤트로 되돌아와 React에 반영됩니다. 병렬 쓰기 API 없음, 에코 억제 없음, 상태를 누가 바꿨든(코드든 마우스 드래그든) 읽기 경로는 하나입니다.

2. **라이브러리는 엔진을 소유하지 않습니다.** 훅은 `viewportId`만 받아 Cornerstone3D 자체의 전역 레지스트리로 뷰포트를 찾습니다. Provider 없음, 싱글톤 없음, engine prop 없음 — 앱의 기존 엔진 관리는 그대로 유지됩니다.

3. **부재는 정상 상태입니다.** 아직 enable되지 않은 뷰포트는 `undefined`를 반환하고, 뷰포트가 생기면 값이 자동으로 채워지며, destroy되면 다시 비워집니다. 그동안 무엇을 렌더링할지는 전적으로 앱의 결정입니다.

그 위에서 Snapshot 계층이 **참조 안정성**(상태 무변경 ⇒ 동일 참조, 낭비 리렌더 없음, 루프 없음)과 **불변성**(deep-frozen — 받은 객체가 나중에 변하지 않음)을 보장합니다.

## API

### `useViewportState(viewportId, selector?, options?)`

```ts
function useViewportState(viewportId: string, selector?: undefined, options?: UseViewportStateOptions): ViewportState | undefined;
function useViewportState<T>(viewportId: string, selector: (state: ViewportState) => T, options?: UseViewportStateOptions): T | undefined;
```

- **`viewportId`** — Cornerstone3D 전역 레지스트리로 뷰포트를 찾습니다. 해당 id의 뷰포트가 enable되어 있지 않으면 `undefined`를 반환합니다.
- **`selector`** — 선택한 값이 `Object.is` 기준으로 바뀔 때만 컴포넌트가 리렌더됩니다. 뷰포트 부재 중에는 호출되지 않습니다. 원시값이나 이미 존재하는 필드를 고르세요(`s => s.voiRange`는 무관한 변경에도 참조가 유지됩니다). 값을 *만들어* 돌려주는 셀렉터 — `s => ({ index: s.sliceIndex })` — 는 직전 결과와 `Object.is`로 같을 수 없으므로 Engine 이벤트마다 리렌더됩니다 ([ADR 0004](./docs/adr/0004-selector-memo-stays-hand-rolled.md)).
- **`options.batch`** (기본 `true`) — Engine 이벤트를 애니메이션 프레임당 최대 한 번의 업데이트로 합칩니다. 드래그 중 이벤트마다가 아니라 프레임마다 한 번 렌더됩니다. 이벤트 단위 정확도가 필요하면 `false`.

`ViewportState`는 판별 유니온입니다. `sliceIndex` / `numberOfSlices`(Slice Position)는 모든 kind 공통이라 하나의 슬라이더가 Stack과 MPR 화면을 모두 담당합니다. 나머지 kind별 필드는 `kind`로 좁혀 읽으세요:

```ts
interface ViewportStateCommon { camera: Types.ICamera; voiRange: Types.VOIRange | undefined; sliceIndex: number | undefined; numberOfSlices: number | undefined }
interface StackViewportState  extends ViewportStateCommon { kind: 'stack';  sliceIndex: number; numberOfSlices: number }
interface VolumeViewportState extends ViewportStateCommon { kind: 'volume' }
type ViewportState = StackViewportState | VolumeViewportState;
```

모든 상태 객체는 deep-frozen Snapshot이며, 상태가 실제로 바뀌기 전까지 참조가 유지됩니다. 재구축은 직전 Snapshot과 구조를 공유하므로 움직이지 않은 필드는 참조가 그대로 유지됩니다 — 줌을 해도 `s => s.voiRange`에 새 객체가 가지 않습니다. Stack에서 `sliceIndex`는 *요청된* 슬라이스입니다 — 이미지 로드가 끝날 때가 아니라 스크롤이 일어난 순간 갱신됩니다 ([ADR 0003](./docs/adr/0003-image-id-index-is-the-requested-slice.md)). Volume에서는 카메라에서 파생되므로 화면보다 앞서가지 않습니다. 슬라이스가 없는 뷰포트(3D, `setVolumes` 전의 Volume)는 두 필드 모두 `undefined`입니다.

### `<CornerstoneViewport />`

선택 사항. `<div>`를 렌더링하고 마운트 시 뷰포트로 enable, 언마운트 시 disable합니다. Engine은 앱이 만들고, 컴포넌트는 레지스트리로 찾기만 합니다.

```tsx
import { Enums } from '@cornerstonejs/core';
import { CornerstoneViewport } from 'react-cornerstone3d';

<CornerstoneViewport viewportId="ct-axial" type={Enums.ViewportType.STACK} style={{ width: 512, height: 512 }} />
```

| Prop | 설명 |
|---|---|
| `viewportId` | enable할 id — `useViewportState`가 관찰하는 id와 같습니다. |
| `type` | `Enums.ViewportType`, `enableElement`에 그대로 전달. |
| `defaultOptions?` | `Types.ViewportInputOptions`, enable 시점에 한 번만 적용. 이후 변경해도 재-enable하지 않습니다. |
| `renderingEngineId?` | enable할 Engine. 기본값은 앱에 등록된 유일한 Engine이며, 0개 또는 여러 개인데 id가 없으면 throw합니다. |
| `...divProps` | 나머지는 모두 `<div>`로 전달. |

마운트 시 Engine이 없는 것은 마운트 순서 버그이므로 컴포넌트는 조용히 넘어가지 않고 throw합니다 — 뷰포트 부재를 정상 상태로 보는 훅과 다른 점입니다.

## 현재 상태

v0.2 — 동기화만. 이 라이브러리의 유일한 책임은 상태 동기화입니다.

| 기능 | 상태 |
|---|---|
| Stack 뷰포트 상태 (카메라, VOI, 슬라이스 인덱스) | ✅ |
| Volume 뷰포트 상태 + kind별 타입 | ✅ |
| Slice Position(`sliceIndex`, `numberOfSlices`) 두 kind 공통 | ✅ |
| 뷰포트 부재 계약 (`undefined`) | ✅ |
| viewportId당 공유 Binding, StrictMode 안전 | ✅ |
| 뷰포트 enable/destroy 시 자동 채움/비움 | ✅ |
| 셀렉터 (내가 쓰는 값이 바뀔 때만 리렌더) | ✅ |
| 고빈도 이벤트 rAF 배칭 | ✅ |
| 선택적 `<CornerstoneViewport />` 컴포넌트 | ✅ |
| 어노테이션 / 툴 / 세그멘테이션 상태 | 로드맵 |

**요구사항:** React 18+, `@cornerstonejs/core` 5.x. ESM만 제공합니다.

## 범위 밖

앱 상태 관리(Zustand 등 원하는 것을 쓰세요), 쓰기 헬퍼, 선택적 컴포넌트를 넘어서는 엔진/뷰포트 생명주기 관리, 렌더링 성능(그건 Engine의 일입니다).

## 개발

```bash
npx playwright install chromium   # 최초 1회 — 브라우저 테스트는 실제 Cornerstone3D로 돕니다
npm test                          # unit(jsdom + 가짜 CS3D 레지스트리)과 browser(headless Chromium) 프로젝트
npm run build                     # tsc → dist/
```

유닛 테스트는 공개 훅 API만 관찰합니다 — 반환값, 참조 안정성, 리렌더 횟수. 브라우저 테스트는 실제 Engine을 구동해 가짜가 세운 가정을 검증합니다. 도메인 용어(Engine, Viewport State, Snapshot, Command, Binding)는 [`CONTEXT.md`](./CONTEXT.md)에 있습니다.
