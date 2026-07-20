# Simple Reader (스마트 이북 리더기) 개발 문서

## 1. 프로젝트 개요 (Project Overview)
**Simple Reader**는 구글 드라이브에 보관된 PDF 파일을 빠르게 로드하여 읽고, 모르는 문장을 드래그하여 즉시 제미나이(Gemini) AI로 번역 및 요약할 수 있는 **PWA 기반 스마트 독서 웹앱**입니다. 사용자는 AI의 답변을 로컬 환경과 클라우드(Supabase)에 동시에 동기화되는 하이브리드 메모장 및 책갈피 기능과 함께 관리할 수 있습니다. 
사내 방화벽 등의 제약 사항을 우회하기 위해 구글의 기본 Picker Iframe을 사용하지 않고 자체적인 Google Drive API 탐색 모달을 구축하여 보안성과 사용성을 동시에 잡았습니다. 또한 사용자가 직접 '서재' 폴더를 지정하거나, 로컬 기기의 저장소 용량(PDF 캐시)을 유연하게 관리할 수 있는 고도화된 기능들을 제공합니다.

---

## 2. 기술 스택 및 프레임워크 (Tech Stack)

### **프론트엔드 (Frontend)**
- **Framework**: Next.js (App Router), React
- **Language**: TypeScript
- **Styling**: Tailwind CSS (CSS Variables 기반 자체 디자인 시스템)
- **State Management**: Zustand (전역 상태 관리)
- **UI Components**: `lucide-react` (아이콘), `react-resizable-panels` (화면 분할 패널), `react-zoom-pan-pinch` (PDF 줌/팬 상호작용)
- **PDF 렌더러**: `react-pdf` (서버사이드 렌더링 충돌 방지를 위해 `next/dynamic`로 동적 로딩 적용. *Next.js 웹팩 컴파일러와의 충돌 방지를 위해 v9.1.0 및 pdfjs-dist v3.11.174 안정화 버전 사용*)
- **PWA**: `@serwist/next` (서비스 워커, 오프라인 캐싱, manifest 생성)

### **백엔드 (Backend & API)**
- **인증 (Authentication)**: NextAuth.js v5 Beta (Google OAuth - `drive.readonly` 스코프 적용)
- **AI 연동**: `@google/genai` (Gemini 2.0 Flash 모델 활용, 실시간 Streaming Text 전송)
- **DB 및 스토리지 (Hybrid Sync Engine)**:
  - **Local**: `Dexie.js` 및 `dexie-react-hooks` (`useLiveQuery`를 활용하여 수십 MB의 PDF ArrayBuffer를 0.1초 만에 캐싱하고, 메타데이터 변경을 UI에 실시간 반영)
  - **Cloud**: `Supabase JS Client` (PostgreSQL 기반으로 로컬에서 작성한 메모와 책갈피를 클라우드에 백그라운드 동기화)

---

## 3. 폴더 구조 및 주요 소스 파일 (Directory Structure)

```text
simple-reader/
├── app/
│   ├── layout.tsx         # 전역 레이아웃. PWA Manifest, 폰트(Inter, Merriweather), NextAuth Provider 세팅
│   ├── page.tsx           # 메인 페이지 진입점. Header와 Workspace를 렌더링
│   ├── globals.css        # Tailwind CSS 지시어 및 테마 색상(디자인 시스템) 토큰 정의
│   └── api/               # 백엔드 API 라우트
│       ├── auth/[...nextauth]/route.ts # NextAuth(Google 로그인) 엔드포인트
│       ├── drive/list/route.ts         # 구글 드라이브 내 PDF 파일 목록을 조회 (자체 Picker 용도)
│       ├── drive/download/route.ts     # 선택한 PDF 파일의 바이너리 데이터(ArrayBuffer)를 Fetch
│       └── translate/route.ts          # 제미나이 AI 번역/요약 요청 및 Streaming ReadableStream 반환
├── components/
│   ├── Providers.tsx      # NextAuth의 SessionProvider를 App Router 환경에 래핑
│   ├── Header.tsx         # 상단 헤더. 파일명 표시, 구글 로그인/로그아웃 버튼, 파일 열기 액션 연결
│   ├── DrivePickerModal.tsx # 구글 드라이브 탐색 모달창 (특정 폴더를 '내 서재'로 지정 및 중첩 폴더 탐색 기능 포함)
│   ├── StorageManagerModal.tsx # 로컬 저장소 관리자 UI (메타데이터는 보존하며 대용량 PDF 바이너리 캐시만 선택 삭제)
│   ├── Workspace.tsx      # 메인 작업 영역. 데스크탑은 좌우 분할, 모바일은 상하 분할(BottomSheet) 레이아웃 적용
│   ├── PdfViewer.tsx      # react-pdf 뷰어. 드래그 텍스트에 대한 플로팅 툴팁 버튼(번역/요약/메모) 제공 및 책갈피 연동
│   ├── AiAssistantPanel.tsx # AI 패널. 번역/요약 스트리밍 출력, 메모 관리
│   ├── MobileBottomSheet.tsx # 모바일 UI 전용 하단 드래그블 시트 (AI 패널 렌더링용)
│   └── BottomNavBar.tsx   # 모바일 환경 전용 하단 네비게이션 도구 모음
├── hooks/
│   ├── usePdfFile.ts      # Dexie.js 로컬 캐시를 1순위로 확인하고, 없으면 Google API로 다운로드하는 최적화 훅
│   └── useMetadataSync.ts # Dexie.js(로컬)와 Supabase(클라우드) 간의 메모/책갈피 하이브리드 동기화 로직 훅
├── store/
│   └── useStore.ts        # Zustand 전역 상태. 현재 열린 파일 ID, 선택된 텍스트, 페이지 번호 등을 컴포넌트 간 공유
├── lib/
│   ├── db.ts              # Dexie.js 스키마 정의 (pdfCache 테이블, pdfMetadata 테이블)
│   └── supabase.ts        # Supabase 클라이언트 초기화 설정
├── auth.ts                # NextAuth v5 환경설정. GoogleProvider 클라이언트 키 및 토큰-세션 맵핑 로직 정의
└── next.config.ts         # Next.js 설정 및 Serwist PWA 플러그인 연동
```

---

## 4. 기능 테스트 제안 및 제한 조건 (Testing Guide)

성공적인 앱 작동과 오류 없는 기능 테스트를 위해 아래 사항들을 참고해 주세요.

### **1. 필수 환경 변수 검증 (.env.local)**
앱을 구동하기 전 아래 값들이 정상적으로 입력되어 있어야 합니다.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: 구글 클라우드 콘솔에서 발급한 OAuth 자격 증명
- `NEXTAUTH_URL`: 로컬 테스트 시 `http://localhost:3000`
- `NEXTAUTH_SECRET`: 임의의 난수 문자열 (세션 암호화 용도)
- `GEMINI_API_KEY`: 구글 AI 스튜디오에서 발급받은 API 키 (결제/무료 한도 초과 여부 사전 점검 필요)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 프로젝트 키

### **2. 기능 테스트 흐름 및 체크포인트**
1. **Google OAuth 로그인**:
   - 우측 상단의 `Google 로그인` 버튼을 누르고 진행합니다. 
   - **(제한 조건)**: 구글 클라우드 콘솔의 OAuth 동의 화면 설정에서 본인의 구글 계정이 테스트 사용자로 등록되어 있어야 로그인이 차단되지 않습니다.
   - **(권한 확인)**: 로그인 시 체크박스로 표시되는 `Google Drive 파일 보기 및 다운로드(drive.readonly)` 권한을 반드시 **체크(허용)**해야 합니다.
2. **Drive Picker 및 PDF 캐싱 테스트**:
   - `드라이브 파일 열기` 버튼을 눌러 모달을 띄우고 PDF를 클릭합니다.
   - 처음 로드 시에는 다운로드 딜레이가 발생하지만, 새로고침 후 같은 파일을 다시 열어 **0.1초 만에 로컬(Dexie)에서 렌더링**되는지 확인합니다.
3. **텍스트 캡처 및 제미나이 스트리밍 테스트**:
   - PDF 내부의 영어 텍스트를 마우스로 드래그합니다. 
   - 우측 패널에 선택한 문장과 페이지가 잘 뜨는지 확인한 후 `한국어로 번역` 버튼을 클릭합니다.
   - **(제한 조건)**: 앞서 `429 Quota Exceeded` 에러가 발생했던 경우처럼, 구글 AI 스튜디오 계정의 무료 제공량(Free Tier)이 초과되었거나 결제 카드가 누락되었을 경우 번역이 즉각 실패할 수 있습니다.
4. **메타데이터 하이브리드 동기화 테스트**:
   - 번역된 내용을 `메모로 저장`하고, PDF 상단 툴바의 `책갈피 아이콘`을 눌러 저장합니다.
   - 브라우저의 개발자 도구(F12) -> `Application` 탭 -> `IndexedDB`에서 `SimpleReaderDB`에 데이터가 들어왔는지 확인합니다.
   - Supabase 대시보드의 `pdf_metadata` 테이블에도 동일한 데이터가 백그라운드로 업로드(Upsert) 되었는지 검증합니다. (새로고침을 해도 메모가 유지되어야 합니다)
5. **구글 드라이브 전용 서재 지정 및 중첩 탐색 테스트**:
   - 드라이브 모달을 열고 특정 폴더로 진입한 후 상단 경로(브레드크럼) 옆의 `[📌]` 핀 버튼을 클릭하여 서재로 지정합니다.
   - 모달을 다시 열었을 때 해당 폴더 안의 PDF 항목들만 보여주는 '내 서재' 모드로 바로 진입하는지 확인합니다.
6. **로컬 저장소 캐시 최적화 관리 테스트**:
   - 헤더 우측의 `하드 드라이브` 아이콘을 클릭해 저장소 관리자 창을 엽니다.
   - 캐시된 파일의 용량을 비우는 `[캐시 삭제]` 버튼을 클릭합니다.
   - 캐시가 정상 삭제되더라도 파일에 연결된 메타데이터(메모 갯수 등)는 보존되어 오프라인에서도 조회 가능한지 확인합니다.

---

## 5. 핵심 컴포넌트 동작 원리 및 트러블슈팅 (Core Mechanisms & Troubleshooting)

### **PDF 뷰어 (`react-zoom-pan-pinch` & `react-pdf`) 설정 및 상호작용 최적화**
`PdfViewer.tsx`는 핀치 줌, 더블클릭 줌, 모바일 텍스트 드래그 등 다양한 사용자 상호작용이 충돌 없이 부드럽게 작동하도록 고도로 커스텀 설정되어 있습니다.

1. **앵커(Anchor) 기반 좌표 추적 및 `flushSync` 동기화 (스크롤 튐 방지)**
   - `react-zoom-pan-pinch`의 비동기 업데이트로 인한 시각적 깜빡임과 엉뚱한 스크롤 이동 현상을 방지하기 위해 `applyZoomWithAnchor` 로직이 적용되었습니다.
   - 줌 이벤트 발생 시, 뷰포트 내의 클릭 포인트나 핀치 중심점을 기억하여 해당 지점이 위치한 특정 `.react-pdf__Page` 돔 요소와 그 내부의 상대적 X, Y 퍼센트 비율을 저장합니다.
   - 라이브러리의 `transform`을 자바스크립트로 강제 초기화한 뒤, `flushSync`를 이용해 새 배율(scale)을 React에 동기적으로 리플로우(Reflow) 강제합니다. 그 후 다시 계산된 화면 좌표에 맞게 `scrollLeft/scrollTop`을 보정하여 어떤 배율이나 보기 모드에서도 보고 있던 텍스트 위치가 고정됩니다.

2. **모바일 핀치 줌(Pinch Zoom) 정확도 향상**
   - **줌 중심점 추적:** `onTouchMove` 이벤트를 통해 두 손가락의 정확한 중심점(`pinchCenterRef`)을 초당 수십 회 기록하여, 줌 종료 시 단순히 화면 중앙이 아닌 '사용자가 꼬집은 위치'를 정확히 확대/축소의 기준으로 삼습니다.
   - **배율 왜곡 방지:** 라이브러리가 던져주는 `ref.state.scale` 값은 항상 1부터 시작하는 상대적 배율이므로, 기존 스케일에서 나누지 않고 직접 곱하여 연속적인 핀치 줌에도 배율이 엉뚱하게 축소되지 않도록 보정합니다.
   - **연속 모드 페이지 판별:** 세로로 길게 늘어선 연속보기 모드에서 중심점 최단거리(`Math.sqrt`)로 앵커 페이지를 찾을 경우 오작동이 잦습니다. 이를 해결하기 위해 Y좌표가 실제 페이지의 `top`과 `bottom` 영역 안에 존재하는지 수직 포함(Intersection) 여부를 1순위로 판별하는 견고한 탐색 로직을 도입했습니다.

3. **CSS Safe-Centering 기법 (좌측 스크롤 잘림 제한 해제)**
   - Flexbox의 `align-items: center` 적용 시, 문서가 뷰포트보다 커지면 화면 좌측 영역으로 오버플로우된 부분이 잘려 스크롤로 접근할 수 없는 고질적 문제가 발생합니다.
   - 이를 해결하기 위해 모든 상위 래퍼 컨테이너는 항상 `items-start`(왼쪽 정렬)로 통일하고, 단일 및 연속 페이지 내부 래퍼(`LazyPage`)에 **`mx-auto w-max`** 클래스를 적용했습니다. 문서가 뷰포트보다 작을 때는 `margin: auto`를 통해 완벽히 중앙에 배치되고, 화면을 넘어갈 경우 자동으로 왼쪽 벽을 기준으로 자연스럽게 팽창하여 양방향 스크롤을 100% 지원합니다.

4. **1손가락 터치 완벽 분리 및 핀치 줌 종료 폭주 방어 (Last Good State 방식)**
   - **1손가락 스크롤 보호:** 줌 라이브러리가 1손가락 터치 이벤트를 가로채어 세로 스크롤을 막는 것을 방지하기 위해 `pdfWrapperRef`에 `onTouchStart`/`onTouchMove` 이벤트 리스너를 달아, 손가락 1개(`e.touches.length === 1`)의 이벤트는 `e.stopPropagation()`으로 차단합니다.
   - **핀치 줌 드롭 문제의 근본 원인:** 라이브러리 소스 분석 결과(`index.esm.js:1879-1898`), 핀치 줌(2손가락) 중 한 손가락이 먼저 떨어지는 찰나에 `touchmove`가 `touches.length === 1`로 발생하면, 라이브러리가 이를 **1손가락 패닝으로 오인**하여 남은 손가락 위치로 `handlePanning()`을 실행합니다. 이 순간 라이브러리 내부의 transform 좌표(positionX, positionY)가 급변(Focal Point Snapping)하며, 직후의 `onTouchPanningStop`(`index.esm.js:1900-1903`)에서 `onPinchStop`이 호출될 때 `ref.state`는 이미 오염된 상태입니다.
   - **해결 방식 (Last Good State):** 라이브러리의 공식 콜백 `onPinch`는 반드시 `event.touches.length > 1`(정상적인 2손가락 핀치) 일 때만 호출됩니다(`index.esm.js:1896`). 따라서 `onPinch` 콜백에서 매 프레임 `ref.state`(scale, positionX, positionY)를 `lastGoodPinchStateRef`에 저장해 둡니다. `onPinchStop` 시점에서는 오염 가능성이 있는 `ref.state`를 무시하고, 저장해둔 마지막 정상 상태의 scale 값을 사용하여 `applyZoomWithAnchor`를 호출합니다.
   - **이벤트 핸들러 다이어트:** 효과가 없었던 Pointer Event Trap 코드(`onPointerDownCapture`, `onPointerUpCapture`, `onPointerCancelCapture`, `activePointersRef`)는 전량 제거되었습니다. 라이브러리가 Pointer 이벤트를 전혀 사용하지 않고 Touch 이벤트만 사용하기 때문입니다.

5. **모바일 텍스트 드래그 선택 안정화 (selectionchange)**
   - 모바일 환경(롱 프레스 후 핸들 드래그)에서는 `onMouseUp`이나 `onTouchEnd` 이벤트로 텍스트 선택 완료 시점을 정확히 잡을 수 없습니다. 
   - `document` 레벨에서 **`selectionchange`** 이벤트를 감지하되, 빈번한 이벤트 호출로 인한 성능 저하를 막기 위해 300ms 디바운스(Debounce)를 적용하여 사용자가 드래그를 끝마치는 순간 빠르고 정확하게 선택 영역을 AI 입력 패널로 전송합니다.

6. **핀치 줌 중복 확대(Double-Scaling) 버그 해결 (RAF 비동기 애니메이션 제어)**
   - **현상:** 110%로 핀치 줌을 시도했을 때, `react-pdf` 캔버스와 라이브러리의 CSS `transform` 배율이 이중으로 적용되어 화면이 121%로 증폭되는 문제 발생.
   - **발생 원인 (Race Condition):** 
     1) 라이브러리 내부 `handlePinchStop`이 실행되면서 `handleAlignToScaleBounds` 로직이 비동기 RAF(requestAnimationFrame) 애니메이션을 시작할 수 있음.
     2) 이 직후 개발자 콜백 `onPinchStop`에서 `setTransform(0,0,1,0)`을 호출하여 라이브러리 스케일을 1.0으로 강제 리셋하고 `flushSync`를 통해 `react-pdf` 렌더링에 새 배율을 적용.
     3) 하지만, 이전에 라이브러리가 시작해둔 **비동기 RAF 애니메이션이 다음 프레임에 실행되면서** 이전 스케일(1.1)을 라이브러리의 `state.scale`에 다시 덮어씀. 결과적으로 CSS Transform 스케일이 1.1로 롤백되어 이중 확대(Double-scaling) 현상 초래.
   - **해결 로직:** `applyZoomWithAnchor` 내부에서 `setTransform`을 호출하기 직전에 `cancelAnimationFrame(instance.animation)`을 호출하여 라이브러리의 **진행 중인 모든 비동기 애니메이션을 강제 취소**하고, `instance.state`를 직접 `1.0`으로 덮어씀으로써 애니메이션에 의한 롤백 부수 효과를 완벽히 차단함.

7. **ArrayBuffer Detachment 에러 (Web Worker 통신 크래시) 방지**
   - **현상:** 로컬 캐시(IndexedDB)에서 읽어온 PDF 파일을 열람 중 메모 작성이나 확대 등으로 리렌더링이 발생하면 `Cannot read properties of null (reading 'sendWithPromise')` 에러가 발생하며 앱이 중단됨.
   - **발생 원인:** `react-pdf`가 메인 스레드의 메모리 부하를 줄이기 위해 `ArrayBuffer`의 소유권을 `pdf.js` 웹 워커로 넘김(Transfer). 이 과정에서 원본 버퍼 길이는 0바이트(Detached)가 되며, 이후 상태 변경으로 `<Document>`가 리렌더링될 때 비워진 버퍼를 워커에 다시 전달하려다 크래시 발생.
   - **해결 로직:** `fileData` 렌더링 직전에 `useMemo`와 `.slice(0)`를 사용해 `ArrayBuffer`의 복사본(Clone)을 생성하여 전달하도록 수정. 워커가 복사본의 소유권을 가져가더라도 메인 스레드의 원본 데이터는 보존되므로, 빈번한 리렌더링에도 안정성을 확보함.

8. **핀치 줌 깜빡임(Flickering) 개선 (로딩 언마운트 방어)**
   - **현상:** 핀치 줌이 끝나고 고해상도 캔버스가 다시 그려지는 찰나의 순간 화면이 하얗게 번쩍이는 현상.
   - **발생 원인:** `<Page>` 컴포넌트의 `loading` 속성에 스피너(`Loader2`)를 할당할 경우, `react-pdf`가 새 캔버스를 그리는 동안 기존 캔버스를 언마운트(제거)하고 스피너를 보여주게 되어 렌더링 공백이 발생함.
   - **해결 로직:** `loading` 속성을 제거하여 `react-pdf`의 기본 동작인 **'새 캔버스가 렌더링될 때까지 기존 캔버스 유지(Crossfade)'**를 유도함으로써 깜빡임을 원천 제거함.

9. **배율 목표치 미달(Undershoot) 보정 (Peak Scale Smoothing)**
   - **현상:** 두 손가락으로 화면을 크게 확대한 뒤 손을 떼는 순간, 배율이 의도보다 살짝 줄어든 상태로 고정되는 현상.
   - **발생 원인:** 손가락을 뗄 때 미세하게 손가락 간격이 좁아지는 무의식적인 롤링(Rolling) 동작 때문에 줌 아웃으로 판정됨.
   - **해결 로직:** 핀치 줌 도중 최근 300ms 동안의 배율 스케일 기록(`pinchHistoryRef`)을 추적하여, 줌 종료 시 해당 기록 중 가장 높았던(또는 가장 낮았던) **피크 배율(Peak Scale)을 찾아 최종 배율로 고정(Snap)**하는 스무딩 보정 알고리즘 적용.

10. **잦은 핀치 줌 시 OOM 크래시 방지 및 동적 배율 제한**
   - **현상:** 모바일에서 빠르게 핀치 줌을 여러 번 반복할 때 브라우저 탭이 강제 종료되거나 `sendWithPromise` Null 에러가 발생하는 현상.
   - **발생 원인:** 배율 한계(8.0)가 너무 높아 거대한 캔버스 렌더링 요청이 Worker에 과도하게 쌓이며 OOM(메모리 초과)이 발생함. 또한 줌 속도가 `SPIKE_DROPPED` 임계치(10%)를 넘으면 배율 업데이트가 잠겨버리는 버그 발생.
   - **해결 로직:** 최대 배율 한계를 5.0으로 낮추고, `TransformWrapper`의 `minScale`/`maxScale`을 현재 배율(`currentScale`)에 기반하여 동적 계산함으로써 절대 한계치(0.5 ~ 5.0)를 하드 블록(Hard Block)함. 추가로 `pinchSpikeThreshold` 기본값을 50%로 대폭 상향하여 빠른 줌 동작에서의 배율 잠김 현상을 해결함.

11. **마우스 휠(Ctrl+Wheel) 줌 무한 루프 및 깜빡임(Flickering) 해결**
    - **현상:** `Ctrl + 마우스 휠` 줌 시 브라우저 네이티브 줌이 발동해 화면 뷰포트가 변경되면서 `ResizeObserver`와 충돌하여 무한 확장이 발생하거나, 줌 도중 화면이 과도하게 깜빡이는 현상.
    - **발생 원인:** `react-zoom-pan-pinch` 라이브러리의 휠 감지 로직이 포커스를 잃었을 때 제대로 동작하지 않아 브라우저 네이티브 줌 제어권을 빼앗김. 또한 휠을 돌릴 때마다 무거운 `react-pdf` 고해상도 렌더링이 동기적(`flushSync`)으로 발생해 깜빡임 유발.
    - **해결 로직:** 
      - 라이브러리의 휠 로직을 완전히 끄고, 최상위 `window` 레벨에서 `wheel` 이벤트를 `capture: true`로 가로채어 `e.preventDefault()` 및 `e.stopPropagation()`을 호출해 네이티브 줌과 라이브러리 간섭을 원천 차단함.
      - 휠을 굴리는 도중에는 가벼운 CSS `transform`(`instance.setTransform`)만 60fps로 적용하여 깜빡임을 없애고, 휠 조작이 완전히 끝난 후 150ms가 지났을 때 단 한 번만 고해상도 렌더링(`applyZoomWithAnchor`)을 커밋하는 '지연 렌더링 스무딩(Deferred Rendering Smoothing)' 아키텍처를 구현함.
      - 리더 영역 내부와 외부의 휠 이벤트를 명확히 분리하여, 리더 영역 외부에서의 휠 조작은 혼란 방지를 위해 안전하게 무시(차단)하도록 안정성을 강화함.

12. **연속 보기 모드(Continuous Mode) 페이지 간격 동적 연동 및 최적화**
    - **현상:** 연속 보기 모드에서 핀치 줌이나 마우스 휠로 확대/축소 시, 페이지 사이의 여백이 줌 배율을 따라가지 못해 지나치게 벌어지거나 좁아져 화면이 겹치는 어색함 발생.
    - **해결 로직:** `PdfViewer`의 최상위 컨테이너에 CSS 변수 `--pdf-scale`을 주입하고, `LazyPage`의 `marginBottom`과 `minHeight` 속성에 `calc(value * var(--pdf-scale))`을 적용하여 배율 변동에 비례하여 여백도 자연스럽게 증감하도록 설계. 또한 사용성을 위해 기본 여백을 1/4(4px) 수준으로 대폭 축소함.

13. **줌 커밋 시 CSS Transition 충돌에 의한 깜빡임 방지 및 성능 최적화**
    - **현상:** 핀치 줌, 더블클릭 줌, 마우스 휠 줌, Fit 버튼 클릭 등 배율이 변경되는 모든 동작에서 캔버스가 새로 그려지는 찰나에 화면이 미세하게 깜빡이거나 축소되었다가 팽창하는 현상.
    - **발생 원인:** `react-zoom-pan-pinch` 라이브러리의 `setTransform()` API가 내부적으로 CSS `transition` 속성을 재설정할 수 있으며, `applyZoomWithAnchor`나 `handleFit`에서 CSS transform을 `""`으로 초기화할 때 브라우저가 이전 배율에서 1.0으로 줄어드는 전환 애니메이션을 발동시켜 시각적 깜빡임을 유발함.
    - **해결 로직:**
      - **`applyZoomWithAnchor` 함수:** CSS transform 초기화 직전, `setTransform(0,0,1,0)` 호출 직후, 그리고 `flushSync` 이후의 **3개 지점** 모두에서 `style.setProperty("transition", "none", "important")`를 강제 주입하여 어떤 경로에서든 전환 애니메이션이 끼어들 수 없도록 완벽 차단함.
      - **`handleFit` 함수:** 동일하게 transform 초기화 전에 transition을 차단하여 Fit 버튼 클릭 시의 깜빡임도 제거함.
      - **`onTransform` 콜백 최적화:** 핀치 줌 중 초당 수십 회 호출되는 `onTransform`에서 `scaleDisplayRef.current.innerText` 할당 전에 이전 값과 동일한지 비교하는 가드를 추가하여 불필요한 DOM 텍스트 노드 교체와 미세 리플로우를 방지함.
      - **페이지 래퍼 크기 사전 고정:** 단일 보기 및 연속 보기 모드의 페이지 래퍼 `div`에 `pageBaseWidth`와 `pageBaseHeight` 비율 기반의 명시적 `width`/`height`를 사전 부여하여, `react-pdf` 캔버스가 비동기로 그려지기 전에도 레이아웃이 확정되어 스크롤 좌표 재계산이 정확해지고 레이아웃 시프트(Layout Shift)에 의한 시각적 튕김을 방지함.

### **메타데이터 하이브리드 동기화 (Hybrid Sync Engine) 구조 개선**
다중 기기(PC/모바일) 환경에서 메모와 책갈피를 오차 없이 동기화하기 위해 다음과 같은 고도화된 아키텍처가 적용되었습니다.

1. **식별자 통일 (Email-based User ID)**
   - NextAuth(Auth.js)의 세션(JWT) 특성상 기기나 브라우저 캐시에 따라 `user.id (sub)`가 난수로 다르게 발급되는 불확실성을 방지하기 위해, 절대 변하지 않는 구글 계정의 `email`을 최우선 식별자(`userId`)로 사용합니다. 이로써 어느 기기에서 접속하든 완벽하게 동일 사용자로 매칭됩니다.

2. **Soft Delete (논리적 삭제) 및 30일 자동 영구 삭제**
   - 데이터 보존 및 기기 간 삭제 상태 동기화를 위해 즉시 삭제(Hard Delete) 대신 `deleted_at` 필드에 시간을 기록하는 논리적 삭제 방식을 채택했습니다.
   - 서버에서 `deleted_at`을 내려받은 다른 로컬 기기는 스스로 Dexie DB에서도 해당 데이터를 숨김/삭제 처리하여 동기화합니다.
   - 앱 내 백그라운드 동기화(`syncWithServer`) 실행 시, 클라이언트 자체에서 30일이 초과된 삭제 데이터들을 추적하여 로컬과 서버(Supabase) 양쪽에서 깔끔하게 영구(물리) 삭제 처리하므로 별도의 DB 스케줄러 세팅이 필요 없습니다.

3. **네트워크 최적화 동기화 트리거 (Polling & Manual Sync)**
   - 탭 전환 시마다 통신을 유발하던 `window.focus` 리스너와 리소스를 낭비하던 Supabase Realtime WebSocket을 걷어냈습니다.
   - 앱 초기 실행 시 1회, 이후 **10분 주기 정기 폴링(setInterval)**으로 조용히 백그라운드 동기화를 수행합니다.
   - 즉각적인 동기화가 필요한 경우를 위해, UI 하단에 **"서버와 즉시 동기화" (Manual Sync)** 버튼을 배치하였으며 `useRef` 잠금 장치로 무한 루프나 중복 실행을 방지하는 안전한 수동 동기화를 제공합니다.

4. **비로그인 로컬 모드 및 지연 동기화(Lazy Sync) 지원**
   - **오프라인 퍼스트 경험:** 사용자가 로그아웃 상태이더라도 헤더의 `내 서재`를 통해 캐시된 PDF를 열람하고, 메모와 책갈피를 제한 없이 작성할 수 있도록 개편했습니다. 
   - **`isUnsynced` 플래그 시스템:** 비로그인 상태에서 작성 및 수정된 데이터는 로컬 DB(`Dexie`)에만 보관되며 내부적으로 `isUnsynced: true` 플래그가 부여됩니다. 앱 내 메모 패널과 툴바에서 '구름 아이콘(동기화 대기중)'이 표시되어 시각적 피드백을 제공합니다.
   - **로그인 시 자동 업로드 연동:** 사용자가 이후 구글 계정으로 로그인하게 되면, 앱 내의 동기화 훅이 이를 감지하고 로컬의 비동기 데이터들을 모아 `Supabase` 서버로 일괄 병합(upsert)하며, 업로드 성공 시 플래그를 해제하여 매끄러운 오프라인-온라인 하이브리드 연동을 달성했습니다.

5. **오프라인 다이렉트 로컬 파일 지원 (비동기화 격리 모드)**
   - **브라우저 네이티브 탐색기 연동:** 로그아웃 상태일 경우 구글 드라이브 모달 대신 브라우저 기본 파일 선택기(`<input type="file">`)를 호출하여, 로컬 기기의 PDF를 즉시 `Dexie` 캐시로 복사 및 렌더링합니다.
   - **클라우드 동기화 원천 차단:** 로컬에서 직접 불러온 파일은 `local-` 접두사가 붙은 고유 ID를 부여받습니다. 이 파일에서 작성된 메모나 책갈피는 사용자가 이후 로그인을 하더라도 백그라운드 봇(`manualSync`)이 의도적으로 동기화를 건너뛰어(Bypass) 기기 밖으로 데이터가 유출되는 것을 방지합니다.
   - **시각적 UI 분리:** '내 서재' 모달 내에서 로컬 전용 파일은 별도의 기기(Monitor) 아이콘 및 전용 배지로 표시되어, 구글 드라이브 연동 파일과 직관적으로 구분할 수 있습니다.
