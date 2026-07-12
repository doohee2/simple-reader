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

### **PDF 뷰어 (`react-zoom-pan-pinch` & `react-pdf`) 설정 및 터치 충돌 해결**
`PdfViewer.tsx`는 PC 및 모바일 환경에서 텍스트 선택, 네이티브 스크롤, 핀치 줌이 모두 충돌 없이 작동하도록 고도로 커스텀 설정되어 있습니다. 기본 라이브러리의 터치 간섭(스크롤 막힘, 드래그 방해)을 회피하기 위해 다음의 해결책이 적용되었습니다.

1. **1손가락 터치 완벽 분리 (모바일 세로 스크롤 보호)**
   - 줌 라이브러리가 터치 이벤트를 가로채어 브라우저 고유의 세로 스크롤을 막는 고질적 문제가 있습니다.
   - 이를 해결하기 위해 최상단 래퍼 영역에 `onTouchStart`/`onTouchMove` 이벤트 리스너를 달아, **손가락 1개(`e.touches.length === 1`)**의 이벤트는 `e.stopPropagation()`으로 줌 라이브러리에 도달하기 전에 차단합니다. 
   - 이로 인해 모바일 스와이프(세로 스크롤)와 텍스트 선택(길게 누르기)은 브라우저가 원활하게 네이티브로 처리하며, 2손가락 터치만 줌 라이브러리가 인식하여 핀치 줌을 쾌적하게 수행합니다.
   
2. **패닝 완전 비활성화 (`panning={{ disabled: true }}`)**
   - 불필요한 자바스크립트 기반 패닝을 완전히 끄고 브라우저 네이티브 스크롤(`overflow-auto`)에만 전적으로 의존하게 하여, 스크롤 시 화면이 부자연스럽게 튕기는 현상을 원천 방어했습니다.

3. **PC 마우스 드래그 텍스트 선택 보장 (`onMouseDown` 차단 및 `userSelect: text`)**
   - 패닝을 끄더라도 라이브러리가 잔여 마우스 이벤트를 막아 텍스트 드래그를 차단하는 현상이 있습니다.
   - PDF 컨테이너 자체에 `onMouseDown={(e) => e.stopPropagation()}` 방어막을 씌우고, 강제로 `userSelect: "text"` CSS 속성을 래퍼에 주입하여 PC 환경에서 마우스 드래그를 통한 텍스트 선택을 완벽히 복구했습니다.

4. **화면 맞춤(Fit) 시 모바일 가로 흔들림 원천 차단 (`touch-action: pan-y`)**
   - CSS의 `overflow-x-hidden`만으로는 모바일 브라우저의 억지 가로 흔들림(고무줄 효과)을 막을 수 없는 한계가 있습니다.
   - 화면 맞춤 상태일 때는 래퍼 컨테이너에 강제로 `touch-action: pan-y !important`를 주입하여, OS 및 브라우저 레벨에서 좌우 스와이프를 물리적으로 무시하고 오직 세로 스크롤만 허용하도록 강력하게 통제했습니다.
