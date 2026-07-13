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

4. **1손가락 터치 완벽 분리 및 핀치 줌 종료 폭주 방어 (Drop Defense V2)**
   - 줌 라이브러리가 1손가락 터치 이벤트를 가로채어 세로 스크롤을 막는 것을 방지하기 위해 최상단에 `onTouchStart`/`onTouchMove` 이벤트 리스너를 달아, 손가락 1개(`e.touches.length === 1`)의 이벤트는 `e.stopPropagation()`으로 차단합니다. 이로 인해 브라우저 네이티브 스크롤이 보호됩니다.
   - 추가적으로, 핀치 줌(2손가락) 중 **한 손가락이 먼저 떨어지는 순간** 라이브러리가 남은 1개의 손가락 좌표만으로 거리를 재계산하여 줌 수치와 화면 위치가 폭주하는 고질적 버그가 있었습니다.
   - 이벤트를 강제로 막으면 라이브러리 내부 상태가 꼬일 수 있으므로, **안전 스냅샷(Safe Snapshot)** 방식을 도입했습니다. `onTouchEnd`에서 첫 손가락이 떨어지는 찰나의 순간(`e.touches.length === 1`)을 감지하여 폭주 직전의 완벽한 2손가락 배율과 X, Y 좌표를 `safeTransformRef`에 저장해 둡니다.
   - 이후 라이브러리가 폭주하며 `onPinchStop`을 호출하면, 가짜 배율을 무시하고 스냅샷 배율을 적용합니다. 또한 화면 좌표를 재측정(`elementFromPoint`)하기 직전에 DOM의 `transform` 스타일을 스냅샷 좌표로 강제 원상복구시켜, 앵커 로직이 완전히 엉뚱한 위치를 측정하지 못하도록 완벽히 방어했습니다.

5. **모바일 텍스트 드래그 선택 안정화 (selectionchange)**
   - 모바일 환경(롱 프레스 후 핸들 드래그)에서는 `onMouseUp`이나 `onTouchEnd` 이벤트로 텍스트 선택 완료 시점을 정확히 잡을 수 없습니다. 
   - `document` 레벨에서 **`selectionchange`** 이벤트를 감지하되, 빈번한 이벤트 호출로 인한 성능 저하를 막기 위해 300ms 디바운스(Debounce)를 적용하여 사용자가 드래그를 끝마치는 순간 빠르고 정확하게 선택 영역을 AI 입력 패널로 전송합니다.

6. **마우스 휠/트랙패드 줌 속도 최적화**
   - 데스크탑 브라우저 환경에서 `Ctrl + 휠` 또는 트랙패드 핀치를 사용한 줌 인/아웃이 너무 빠르게 일어나는 문제를 해결하기 위해, 라이브러리의 `step` 값을 `0.02`로 지정하여 감도를 기존 대비 10% 수준으로 크게 낮췄습니다.
   - `activationKeys: ["Control"]`을 설정하여 마우스의 일반적인 세로 휠 스크롤은 네이티브로 부드럽게 작동하도록 보호하고, 사용자가 의도한 줌 조작만 정밀하게 반응하도록 분리했습니다.

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
   - 대신 앱 초기 실행 시 1회, 이후 **10분 주기 정기 폴링(setInterval)**으로 조용히 백그라운드 동기화를 수행합니다.
   - 즉각적인 동기화가 필요한 경우를 위해, UI 하단에 **"서버와 즉시 동기화" (Manual Sync)** 버튼을 배치하였으며 `useRef` 잠금 장치로 무한 루프나 중복 실행을 방지하는 안전한 수동 동기화를 제공합니다.
