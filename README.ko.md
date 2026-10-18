# react-cornerstone3d

[English](./README.md) · [![CI](https://github.com/entrolEC/react-cornerstone3d/actions/workflows/ci.yml/badge.svg)](https://github.com/entrolEC/react-cornerstone3d/actions/workflows/ci.yml) · **[라이브 데모 →](https://entrolec.github.io/react-cornerstone3d/)**

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

[**데모 보기 →**](https://entrolec.github.io/react-cornerstone3d/) — 진짜 CT 스택 위에서 같은 슬라이스 슬라이더를 두 방식으로 배선해 나란히 돌립니다. 직접 배선한 쪽에 남아 있는 마운트 순서 버그도 그대로 보입니다 — 위젯이 먼저 생기고 검사가 나중에 열리면 손잡이가 왼쪽 끝에서 움직이지 않습니다.

이 훅 한 줄이, 오늘날 모든 Cornerstone3D + React 앱이 위젯마다 작성하는 24줄의 `useEffect` + `addEventListener` + `setState` 배선을 대체합니다. 데모는 양쪽 줄 수를 실제로 돌고 있는 파일에서 세므로, 숫자가 코드와 어긋날 수 없습니다.

실제 의료영상 뷰어 제품에서 사용 중입니다. 런타임 의존성 0개, 패키지 34 kB, CI에서 `@cornerstonejs/core` 5.0.0과 최신 5.x에 대해 실제 엔진을 띄우는 브라우저 테스트로 검증합니다.

<details>
<summary>훅이 없다면 어떤 코드를 쓰게 되는지 펼쳐보기</summary>

```tsx
function SliceIndicator() {
  const [state, setState] = useState<{ slice: number; total: number }>();

  useEffect(() => {
    const enabled = getEnabledElementByViewportId('ct-axial');
    if (!enabled) return; // 뷰포트가 아직 없으면? 나중에 생겨도 영영 구독하지 않는다
    const viewport = enabled.viewport as Types.IStackViewport;
    const { element } = viewport;

    const update = () =>
      setState({
        slice: viewport.getSliceIndex(),
        total: viewport.getNumberOfSlices(),
      });
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
  return <span>slice {state.slice + 1} / {state.total}</span>;
}
```

29줄이고 그중 24줄이 배선입니다 — 데모가 `demo/slider-by-hand.tsx`에서 세는 바로 그 24줄입니다. 그러고도 남는 문제들: 마운트 순서 경합(뷰포트가 나중에 enable되면 영영 `undefined`), 검사를 닫아도 사본이 붙잡고 있는 유령 값, concurrent 렌더링에서의 tearing, 드래그 중 엔진 이벤트마다 리렌더. 그리고 이 전부를 위젯마다 반복. 라이브러리는 이것들을 중앙에서 해결합니다.

</details>

## 왜 만들었나

Cornerstone3D가 잘못 만들어진 게 아닙니다 — **엔진**이지 스토어가 아닐 뿐입니다. 자체 가변 상태를 관리하고 변경 시 이벤트를 발생시키는데, React는 `Object.is`로 비교할 불변 스냅샷이 필요합니다. `useViewportState`는 그 둘을 잇는 어댑터입니다: 엔진 이벤트를 구독하고, 불변 스냅샷을 캐싱하고, 데이터가 실제로 바뀌었을 때만 새로 만듭니다.

그 어댑터 없이는, 모든 React 뷰어가 같은 이벤트 배관을 손수 재발명하고 같은 버그 계층을 떠안습니다:

- **업데이트 유실** — 첫 렌더와 `useEffect` 구독 시작 사이의 갭
- **Tearing** — React 18+ concurrent 렌더링에서 한 화면의 두 컴포넌트가 서로 다른 슬라이스 번호를 표시
- **구독 누수** — StrictMode 이중 마운트에서
- **마운트 순서 경합** — 뷰포트가 enable되기 전에 UI가 먼저 마운트될 때
- **무한 루프 또는 깊은 비교 땜질** — Cornerstone3D getter는 매 호출 새 객체를 반환하므로 naive한 `getSnapshot`은 절대 안정되지 않음. 이건 누구에게나 어려운 문제입니다: OHIF의 뷰포트 훅들도 React Compiler를 끄면서 그 이유를 "메모이제이션이 참조 순수성을 가정하므로 컴파일하면 업데이트가 조용히 사라진다"고 적어 두었습니다 ([hooks.ts @ 9753879](https://github.com/OHIF/Viewers/blob/9753879/extensions/cornerstone/src/Viewport/Overlays/ViewportSliceProgressScrollbar/hooks.ts#L1-L5)). 데모 패널 5가 세 군데를 더 인용합니다.

이 라이브러리는 그 버그 계층을 중앙에서 한 번에 해결합니다. UI 컴포넌트는 엔진 상태의 순수 함수가 됩니다.

## 핵심 설계

이 문서가 이름처럼 쓰는 단어 셋. **Engine**은 지금 돌고 있는 여러분의 Cornerstone3D — 렌더링 엔진, 뷰포트, 캐시, 그리고 tools 패키지의 ToolGroup과 어노테이션 상태입니다. **Snapshot**은 그 상태 한 조각을 훅이 건네주는 frozen 사본으로, 그 상태가 바뀔 때만 교체됩니다. **Binding**은 키(viewportId, imageId) 하나당 하나뿐인 구독으로, 그 키를 읽는 모든 컴포넌트를 위해 Snapshot을 최신으로 유지합니다. 아래 규칙은 전부 이 문서 안에 그대로 적혀 있고, ADR 링크에는 그 근거와 탈락한 대안이 있습니다.

모든 것을 결정하는 세 가지 선택 (전체 근거는 [`docs/adr/`](./docs/adr/)):

1. **Engine이 유일한 진실 공급원.** 읽기는 Engine → 이벤트 → 불변 Snapshot → `useSyncExternalStore`로 흐릅니다. 쓰기는 평범한 Cornerstone3D API 호출 그대로이며 — 그 효과는 엔진 이벤트로 되돌아와 React에 반영됩니다. 병렬 쓰기 API 없음, 에코 억제 없음, 상태를 누가 바꿨든(코드든 마우스 드래그든) 읽기 경로는 하나입니다.

2. **라이브러리는 엔진을 소유하지 않습니다.** 훅은 `viewportId`만 받아 Cornerstone3D 자체의 전역 레지스트리로 뷰포트를 찾습니다. Provider 없음, 싱글톤 없음, engine prop 없음 — 앱의 기존 엔진 관리는 그대로 유지됩니다.

3. **부재는 정상 상태입니다.** 아직 enable되지 않은 뷰포트는 `undefined`를 반환하고, 뷰포트가 생기면 값이 자동으로 채워지며, destroy되면 다시 비워집니다. 그동안 무엇을 렌더링할지는 전적으로 앱의 결정입니다.

그 위에서 Snapshot 계층이 **참조 안정성**(상태 무변경 ⇒ 동일 참조, 낭비 리렌더 없음, 루프 없음)과 **불변성**(deep-frozen — 받은 객체가 나중에 변하지 않음)을 보장합니다. 그리고 필드는 Engine에 그것을 읽는 getter와 그것이 바뀌었다고 알리는 이벤트가 **둘 다** 있을 때만 들어옵니다 ([ADR 0007](./docs/adr/0007-a-field-needs-a-getter-and-an-event.md)) — `loaded`는 있고 `loading`은 없는 이유입니다.

## API

### `useViewportState(viewportId, selector?)`

```ts
function useViewportState(viewportId: string, selector?: undefined): ViewportState | undefined;
function useViewportState<T>(viewportId: string, selector: (state: ViewportState) => T): T | undefined;
```

- **`viewportId`** — Cornerstone3D 전역 레지스트리로 뷰포트를 찾습니다. 해당 id의 뷰포트가 enable되어 있지 않으면 `undefined`를 반환합니다.
- **`selector`** — 선택한 값이 `Object.is` 기준으로 바뀔 때만 컴포넌트가 리렌더됩니다. 뷰포트 부재 중에는 호출되지 않습니다. 원시값이나 이미 존재하는 필드를 고르세요(`s => s.voiRange`는 무관한 변경에도 참조가 유지됩니다). 값을 *만들어* 돌려주는 셀렉터 — `s => ({ index: s.sliceIndex })` — 는 직전 결과와 `Object.is`로 같을 수 없으므로 Engine 이벤트마다 리렌더됩니다 ([ADR 0004](./docs/adr/0004-selector-memo-stays-hand-rolled.md)).

Engine 이벤트는 애니메이션 프레임당 최대 한 번의 업데이트로 합쳐집니다. 드래그 중 이벤트마다가 아니라 프레임마다 한 번 렌더됩니다. 끄는 옵션은 없습니다: Snapshot은 이벤트 스트림이 아니라 *상태*이고, 이벤트 하나하나가 필요한 컴포넌트는 Cornerstone3D 리스너를 직접 쓰는 것이 맞습니다 ([ADR 0006](./docs/adr/0006-the-frame-is-the-unit-of-consistency.md)).

`ViewportState`는 판별 유니온입니다. `sliceIndex` / `numberOfSlices`(Slice Position)는 모든 kind 공통이라 하나의 슬라이더가 Stack과 MPR 화면을 모두 담당합니다. 나머지 kind별 필드는 `kind`로 좁혀 읽으세요:

```ts
interface ViewportStateCommon { camera: Types.ICamera; voiRange: Types.VOIRange | undefined; sliceIndex: number | undefined; numberOfSlices: number | undefined; currentImageId: string | undefined }
interface StackViewportState  extends ViewportStateCommon { kind: 'stack';  sliceIndex: number; numberOfSlices: number; imageIds: readonly string[] }
interface VolumeViewportState extends ViewportStateCommon { kind: 'volume' }
type ViewportState = StackViewportState | VolumeViewportState;
```

모든 상태 객체는 deep-frozen Snapshot이며, 상태가 실제로 바뀌기 전까지 참조가 유지됩니다. 재구축은 직전 Snapshot과 구조를 공유하므로 움직이지 않은 필드는 참조가 그대로 유지됩니다 — 줌을 해도 `s => s.voiRange`에 새 객체가 가지 않고, 스크롤을 해도 `s => s.imageIds`에 새 배열이 가지 않습니다. Stack에서 `sliceIndex`는 *요청된* 슬라이스입니다 — 이미지 로드가 끝날 때가 아니라 스크롤이 일어난 순간 갱신됩니다 ([ADR 0003](./docs/adr/0003-image-id-index-is-the-requested-slice.md)). Volume에서는 카메라에서 파생되므로 화면보다 앞서가지 않습니다. 슬라이스가 없는 뷰포트(3D, `setVolumes` 전의 Volume)는 두 필드 모두 `undefined`입니다.

`currentImageId`는 뷰포트가 가리키는 이미지입니다: Stack에서는 요청된 슬라이스의 id, Volume에서는 카메라에 가장 가까운 이미지, 가리키는 것이 없으면(`setStack` 전의 Stack, 데이터 전의 Volume, 3D) `undefined`. `imageIds`는 Stack의 이미지 목록으로, `setStack`이 내용을 바꿀 때만 교체됩니다. 이 둘이 아래 이미지 훅의 키가 됩니다.

위젯 둘을 더 보면 이런 모양입니다:

```tsx
import { getEnabledElementByViewportId, utilities } from '@cornerstonejs/core';

// W/L 표시. 카메라만 움직일 때 `voiRange`는 참조가 유지되므로
// window/level 드래그에만 리렌더되고 그 외에는 가만히 있습니다.
function WindowLevel({ viewportId }: { viewportId: string }) {
  const voi = useViewportState(viewportId, (s) => s.voiRange);
  if (!voi) return null;
  return <span>W {Math.round(voi.upper - voi.lower)} L {Math.round((voi.upper + voi.lower) / 2)}</span>;
}

// Stack이든 Volume(MPR)이든 같은 슬라이더: Slice Position은 두 kind 공통입니다.
// 쓰기는 평범한 Cornerstone3D 호출이고, 그 효과는 Engine 이벤트로 되돌아옵니다.
function SliceSlider({ viewportId }: { viewportId: string }) {
  const slice = useViewportState(viewportId, (s) => s.sliceIndex);
  const total = useViewportState(viewportId, (s) => s.numberOfSlices);
  if (slice === undefined || !total) return null;
  const jump = (imageIndex: number) => {
    const element = getEnabledElementByViewportId(viewportId)?.viewport.element;
    if (element) void utilities.jumpToSlice(element, { imageIndex });
  };
  return <input type="range" min={0} max={total - 1} value={slice} onChange={(e) => jump(Number(e.target.value))} />;
}
```

### `useImageLoadState(imageId)` · `useImageLoadStates(imageIds)`

```ts
type ImageLoadState = 'absent' | 'loaded' | 'failed';
function useImageLoadState(imageId: string | undefined): ImageLoadState | undefined;
function useImageLoadStates(imageIds: readonly string[] | undefined): readonly ImageLoadState[] | undefined;
```

이미지가 캐시에 있는지를, 캐시 모듈이 말하는 대로(`cache.isLoaded`) 돌려줍니다. 뷰포트가 아니라 캐시의 말입니다: 로드는 됐지만 아직 어느 캔버스에도 그려지지 않은 이미지가 있을 수 있습니다.

- `'loaded'` — 캐시에 있습니다. 캐시 getter가 늘 우선합니다.
- `'failed'` — 지켜보는 동안 로드가 실패했고(`IMAGE_LOAD_FAILED`), 그 뒤로 캐시에 들어온 적이 없습니다. 재시도에는 시작 이벤트가 없으므로 이미지가 들어오거나(`'loaded'`) 다시 실패할 때까지 `'failed'`로 남습니다.
- `'absent'` — 그 밖의 전부: 요청한 적 없음, 퇴거됨, 아무도 지켜보지 않을 때 실패함. 캐시는 실패한 항목을 지우고 기록을 남기지 않으므로, 아무도 듣지 못한 실패는 보고할 수 없습니다 ([ADR 0009](./docs/adr/0009-a-heard-failure-is-a-field.md)).
- `undefined` — 물어볼 이미지가 없었습니다(`imageId`가 `undefined`).

모든 상태가 빈 문자열이 아니므로 `if (state)`가 아니라 `=== 'loaded'`로 비교하세요.

배열 훅은 목록 전체에 대한 `useImageLoadState`입니다: 항목마다 같은 답, frozen 배열 하나, 어떤 항목이든 바뀌었을 때만 교체. `undefined`를 주면 `undefined`, 빈 목록은 늘 같은 빈 배열입니다. 자기 상태는 없습니다 — `useImageLoadState(imageIds[i])`를 읽는 눈금 컴포넌트와 `useImageLoadStates(imageIds)`를 읽는 트랙은 이미지당 하나의 Binding을 공유합니다.

라이브러리는 뷰포트 상태와 이미지 상태를 조인하지 않습니다. 조인은 앱의 몫이고, 두 줄입니다:

```tsx
function LoadTrack({ viewportId }: { viewportId: string }) {
  const imageIds = useViewportState(viewportId, (s) => (s.kind === 'stack' ? s.imageIds : undefined));
  const current  = useViewportState(viewportId, (s) => s.currentImageId);
  const states   = useImageLoadStates(imageIds); // readonly ImageLoadState[] | undefined
  if (!imageIds || !states) return null;
  return <div className="track">{imageIds.map((id, i) => <span key={id} data-state={states[i]} data-current={id === current} />)}</div>;
}
```

없는 것: *로딩 중*. 로드를 요청하면 캐시 항목이 이벤트 없이 조용히 생기므로 Snapshot이 따라갈 수 없습니다 ([ADR 0007](./docs/adr/0007-a-field-needs-a-getter-and-an-event.md)). 눈금 N개를 그리는 것도 앱의 몫입니다: N이 크면 행을 memo하거나 canvas에 그리세요.

내부적으로 Cornerstone3D의 `eventTarget`은 리스너를 평범한 배열로 들고 있어서, 라이브러리는 관찰 중인 모든 이미지에 대해 리스너 한 벌(추가, 제거, 로드 실패)만 붙이고 id로 라우팅합니다 — 슬라이스 천 장을 관찰해도 리스너는 삼천 개가 아니라 셋입니다.

### `useCacheState()`

```ts
interface CacheState { readonly imageBytes: number }
function useCacheState(): CacheState;
```

캐시 모듈이 보고하는 보유량입니다. `imageBytes`는 `cache.getCacheSize()` — 캐시가 세는 이미지 바이트입니다(볼륨은 그 수에 들어가지 않아서 이름이 "image"입니다). `IMAGE_CACHE_IMAGE_ADDED` / `_REMOVED`를 따라가며, 한 프레임에 천 장이 들어와도 렌더는 한 번이고, 객체는 frozen이고 숫자가 바뀔 때만 교체됩니다. `undefined`는 없습니다 — 캐시는 항상 있습니다. 최대치는 여기 없습니다: `setMaxCacheSize`는 이벤트를 내지 않고, 그 값은 앱이 정했으니 앱이 압니다.

```tsx
function MemoryGauge({ maxBytes }: { maxBytes: number }) {
  const { imageBytes } = useCacheState();
  return <meter min={0} max={maxBytes} value={imageBytes}>{Math.round(imageBytes / 2 ** 20)} MB</meter>;
}
```

침묵 경로 하나: progressive 로딩 중 Cornerstone3D의 `setPartialImage`는 이벤트 없이 크기를 줄이므로, 다음 캐시 이벤트까지 `imageBytes`가 약간 크게 읽힐 수 있습니다.

### `<CornerstoneViewport />`

선택 사항. `<div>`를 렌더링하고 마운트 시 뷰포트로 enable하며, div 크기가 바뀌면 `ResizeObserver`로 `engine.resize()`를 호출해 캔버스를 맞추고, 언마운트 시 disable합니다. Engine은 앱이 만들고, 컴포넌트는 레지스트리로 찾기만 합니다. 부모가 자기 cleanup에서 Engine을 먼저 destroy했다면(React는 cleanup을 부모부터 실행합니다) 컴포넌트의 cleanup은 그걸 알아채고 아무것도 하지 않습니다.

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

### `react-cornerstone3d/tools`

`@cornerstonejs/tools`에 있는 상태입니다. core만 쓰는 앱이 tools 패키지를 로드하지 않도록 별도 엔트리로 제공합니다 ([ADR 0010](./docs/adr/0010-tools-state-is-a-separate-entry.md)). `@cornerstonejs/tools`는 선택적 peer dependency이며, tools 패키지 자체가 요구하듯 core와 같은 버전으로 설치하세요.

```ts
import { useActiveTool, useAnnotations, type AnnotationState } from 'react-cornerstone3d/tools';

function useActiveTool(viewportId: string): string | undefined;
function useAnnotations(viewportId: string, toolName?: string): readonly AnnotationState[] | undefined;

interface AnnotationState {
  readonly annotationUID: string;
  readonly toolName: string;
  readonly referencedImageId: string | undefined;
  readonly isLocked: boolean;
  readonly isVisible: boolean;
  readonly isSelected: boolean;
  readonly data: Readonly<Record<string, unknown>>; // 평범한 frozen 사본: handles, cachedStats, label, …
}
```

**`useActiveTool(viewportId)`** — 그 뷰포트의 ToolGroup에서 주 마우스 버튼에 활성화된 도구입니다. `setToolActive`에 넘긴 이름 그대로, `getActivePrimaryMouseButtonTool`이 보고하는 값입니다. 어떤 ToolGroup도 뷰포트를 갖고 있지 않거나 주 버튼에 활성 도구가 없으면 `undefined`. `TOOL_MODE_CHANGED`, `TOOL_ACTIVATED`, 뷰포트의 그룹 가입·탈퇴를 따라갑니다. 쓰기는 `toolGroup.setToolActive(...)` 그대로입니다. 다만 `setToolActive`는 주 버튼을 쥐고 있던 도구에게서 그 버튼을 빼앗지 않으므로, 그 도구를 먼저 passive로 돌리세요.

```tsx
import { Enums as ToolsEnums, ToolGroupManager } from '@cornerstonejs/tools';

function ToolButton({ viewportId, tool }: { viewportId: string; tool: string }) {
  const active = useActiveTool(viewportId);
  const activate = () => {
    const group = ToolGroupManager.getToolGroupForViewport(viewportId);
    // setToolActive는 이전 도구에게서 Primary를 빼앗지 않습니다: 그 도구를 먼저 passive로.
    const current = group?.getActivePrimaryMouseButtonTool();
    if (current && current !== tool) group!.setToolPassive(current);
    group?.setToolActive(tool, { bindings: [{ mouseButton: ToolsEnums.MouseBindings.Primary }] });
  };
  return <button aria-pressed={active === tool} onClick={activate}>{tool}</button>;
}
```

**`useAnnotations(viewportId, toolName?)`** — 뷰포트의 frame of reference에 있는 어노테이션 목록을, tools 패키지의 어노테이션 상태가 보고하는 대로 돌려줍니다. 모든 도구의 것, 또는 도구 하나의 것. 뷰포트가 없으면 `undefined`, 아직 가리키는 것이 없거나 그린 것이 없으면 늘 같은 빈 배열. 항목은 tools 패키지가 그 어노테이션이 바뀌었다고 말했을 때(`ANNOTATION_ADDED` / `MODIFIED` / `COMPLETED` / `REMOVED`)나 잠금·표시·선택이 바뀌었을 때만 교체되고, 배열은 어떤 항목이든 바뀌었을 때만 교체됩니다 — `annotationUID`를 key로 하고 `memo`로 감싼 행은 다른 어노테이션을 드래그하는 동안 리렌더되지 않습니다. `MODIFIED`는 드래그 속도로 오지만 프레임이 한 번의 렌더로 합칩니다. `data`는 평범한 사본입니다: 안에 든 클래스 인스턴스(contour의 `pointsManager`)는 빠지고, `highlighted` / `invalidated`는 이벤트 없이 바뀌므로 필드가 아닙니다.

```tsx
import { LengthTool, annotation } from '@cornerstonejs/tools';

function Measurements({ viewportId }: { viewportId: string }) {
  const lengths = useAnnotations(viewportId, LengthTool.toolName);
  if (!lengths) return null;
  return (
    <ul>
      {lengths.map((a) => (
        <li key={a.annotationUID} aria-selected={a.isSelected} onClick={() => annotation.selection.setAnnotationSelected(a.annotationUID, true)}>
          {(a.data.cachedStats as Record<string, { length?: number }> | undefined)?.[`imageId:${a.referencedImageId}`]?.length?.toFixed(1)} mm
        </li>
      ))}
    </ul>
  );
}
```

## 현재 상태

v0.6 — 동기화만. 이 라이브러리의 유일한 책임은 상태 동기화입니다.

| 기능 | 상태 |
|---|---|
| Stack 뷰포트 상태 (카메라, VOI, 슬라이스 인덱스) | ✅ |
| Volume 뷰포트 상태 + kind별 타입 | ✅ |
| Slice Position(`sliceIndex`, `numberOfSlices`) 두 kind 공통 | ✅ |
| 뷰포트가 가리키는 것 (`currentImageId`; Stack `imageIds`) | ✅ |
| Image Load State (`useImageLoadState`, `useImageLoadStates`) | ✅ |
| 뷰포트 부재 계약 (`undefined`) | ✅ |
| viewportId당 공유 Binding, StrictMode 안전 | ✅ |
| 뷰포트 enable/destroy 시 자동 채움/비움 | ✅ |
| 셀렉터 (내가 쓰는 값이 바뀔 때만 리렌더) | ✅ |
| 고빈도 이벤트 rAF 배칭 | ✅ |
| 선택적 `<CornerstoneViewport />` 컴포넌트 | ✅ |
| Generic Viewport (PLANAR_NEXT, CS3D 5.x `useGenericViewport`) | ✅ — Stack·Volume 모두; VOI는 `setDisplaySetPresentation`으로 쓰세요, 레거시 `setProperties`는 거기서 이벤트를 내지 않습니다 ([cornerstone3D #2977](https://github.com/cornerstonejs/cornerstone3D/issues/2977)) |
| Image Load State의 실패 보고 (`'absent' \| 'loaded' \| 'failed'`) | ✅ |
| Cache State (`useCacheState`: 캐시가 쥔 이미지 바이트) | ✅ |
| 활성 도구 (`useActiveTool`, `react-cornerstone3d/tools`) | ✅ |
| Annotation State (`useAnnotations`: frame of reference별 목록, 잠금·표시·선택, 평범한 `data`) | ✅ |
| `<CornerstoneViewport />`가 div 크기에 캔버스를 맞춤 | ✅ |
| Volume `volumeIds` | 로드맵 |
| 세그멘테이션 상태 (같은 엔트리, 같은 규칙) | 로드맵 |

**1.0 기준** (0.x 동안 바뀔 수 있음):

- `react-cornerstone3d/tools`에 세그멘테이션 상태, 같은 getter·이벤트 규칙으로
- breaking change 없는 minor 릴리스 한 번 — API가 자리 잡았다는 뜻
- 저자의 것 말고 두 번째 제품 뷰어

**요구사항:** React 18+, `@cornerstonejs/core` 5.x; `/tools` 엔트리에만 `@cornerstonejs/tools` 5.x (선택적 peer, core와 같은 버전). ESM만 제공합니다. `exports`에 `default` 조건이 있어 Jest 리졸버가 엔트리를 찾지만, 패키지에 대한 ESM 지원은 Jest 쪽에서 켜야 합니다. CI는 `@cornerstonejs/core` 5.0.0과 최신 5.x에서 돕니다.

**안정성:** 메이저 버전이 0인 동안 breaking change는 minor 릴리스(0.x → 0.y)에서만 일어나고 [CHANGELOG.md](./CHANGELOG.md)에 기록됩니다. patch 릴리스는 그대로 받아도 안전합니다. 정확한 버전 또는 tilde 범위(`~0.6.0`)로 고정하기를 권장합니다.

## 한계

Cornerstone3D가 말해주지 않아서 훅이 볼 수 없는 것들:

- **같은 `viewportId`를 가진 Engine 두 개.** 훅은 `getEnabledElementByViewportId`로 찾는데, 이 함수는 그 id를 가진 첫 Engine을 돌려줍니다. 두 번째 Engine의 같은 id 뷰포트는 보이지 않고, 그쪽의 disable 이벤트가 첫 번째의 Snapshot을 비웁니다. 뷰포트 id는 Engine을 넘어 고유하게 지으세요.
- **`defaultOptions.suppressEvents: true`**는 그 뷰포트의 `CAMERA_MODIFIED`를 막으므로 카메라와 Volume의 Slice Position이 갱신되지 않습니다. VOI와 stack 이벤트는 여전히 옵니다.
- **`removeVolumeActors`**는 `ACTORS_CHANGED`만 발사하는데 훅은 그걸 듣지 않습니다. 다음 카메라·VOI 이벤트까지 Snapshot은 이전 슬라이스와 VOI를 유지합니다.
- **백그라운드 탭.** 재구축은 `requestAnimationFrame`으로 도는데, 탭이 숨겨지면 브라우저가 이를 멈춥니다. 모든 Snapshot은 마지막으로 보인 값을 유지하다가 돌아오면 한 프레임에 따라잡습니다. 그동안에도 읽기는 서로 모순되지 않습니다.
- **frame of reference로 추가한 어노테이션**(`addAnnotation(annotation, FrameOfReferenceUID)`, element가 아닌)은 어떤 ToolGroup이 그 도구를 어떤 모드로든 갖고 있을 때만 `ANNOTATION_ADDED`를 발사합니다 — tools 패키지의 early return입니다. 그런 어노테이션은 다음 이벤트에서야 목록에 들어옵니다.
- **ToolGroup 여러 개가 한 뷰포트를 가지면** `getToolGroupForViewport`가 throw합니다. Cornerstone3D가 금지하는 구성이므로 훅은 그대로 통과시킵니다.

## 범위 밖

앱 상태 관리(Zustand 등 원하는 것을 쓰세요), 쓰기 헬퍼, 선택적 컴포넌트를 넘어서는 엔진/뷰포트 생명주기 관리, 렌더링 성능(그건 Engine의 일입니다).

## 개발

```bash
npx playwright install chromium   # 최초 1회 — 브라우저 테스트는 실제 Cornerstone3D로 돕니다
npm test                          # unit(jsdom + 가짜 CS3D 레지스트리)과 browser(headless Chromium) 프로젝트
npm run build                     # tsc → dist/
```

유닛 테스트는 공개 훅 API만 관찰합니다 — 반환값, 참조 안정성, 리렌더 횟수. 브라우저 테스트는 실제 Engine과 실제 캐시를 구동해 가짜가 세운 가정을 검증합니다. 도메인 용어(Engine, Viewport State, Snapshot, Command, Image Load State, Cache State, Tool State, Annotation State, Binding)는 [`CONTEXT.md`](./CONTEXT.md)에 있습니다.
