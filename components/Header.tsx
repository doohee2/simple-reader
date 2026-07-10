"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import DrivePickerModal from "./DrivePickerModal";
import { useStore } from "@/store/useStore";

export default function Header() {
  const { data: session, status } = useSession();
  
  const { selectedFileName, setSelectedFile, theme, toggleTheme, isDrivePickerOpen, setIsDrivePickerOpen } = useStore();

  const handleSelectFile = (fileId: string, fileName: string) => {
    setSelectedFile(fileId, fileName);
    setIsDrivePickerOpen(false);
  };

  return (
    <>
      <header className="flex justify-between items-center w-full px-4 md:px-8 h-14 md:h-16 bg-surface border-b border-outline-variant flex-shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 모바일 햄버거 메뉴 (PC 숨김) */}
            <button className="md:hidden p-1 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <span className="material-symbols-outlined text-primary text-2xl font-bold hidden md:block">menu_book</span>
            <span className="text-headline-sm font-bold text-primary tracking-tight hidden md:block">
              Simple Reader
            </span>
          </div>
          <div className="h-6 w-px bg-outline-variant mx-1 md:mx-2 hidden md:block"></div>
          <div className="flex flex-col min-w-0">
            {selectedFileName ? (
              <span className="text-ui-label-bold text-on-surface truncate pr-2 flex items-center gap-2">
                {selectedFileName}
                {/* 모바일에서는 동기화 배지 숨기거나 축소 */}
                <span className="hidden md:inline-block w-2 h-2 rounded-full bg-secondary" title="동기화 완료"></span>
              </span>
            ) : (
              <span className="text-ui-label-bold text-on-surface-variant italic">
                {/* 모바일에서는 안내 문구 축소 */}
                <span className="md:hidden">파일을 열어주세요</span>
                <span className="hidden md:inline">파일이 선택되지 않았습니다</span>
              </span>
            )}
          </div>
        </div>
        
        {/* 모바일 우측 (더보기 메뉴 등) */}
        <div className="md:hidden flex items-center">
          <button className="p-1 text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-2xl">more_vert</span>
          </button>
        </div>

        {/* 데스크탑 우측 영역 */}
        <div className="hidden md:flex items-center gap-4 flex-shrink-0 ml-2">
          <button 
            onClick={toggleTheme}
            className="p-1 md:p-2 text-on-surface-variant hover:text-primary transition-colors duration-200 rounded-full hover:bg-surface-variant flex-shrink-0"
            title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            <span className="material-symbols-outlined">{theme === "dark" ? "light_mode" : "dark_mode"}</span>
          </button>
          {status === "authenticated" ? (
            <>
              {selectedFileName ? (
                <button 
                  onClick={() => setSelectedFile(null, null)}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-surface-variant text-on-surface hover:bg-surface-bright border border-outline-variant rounded-md text-ui-label-bold transition-colors text-xs md:text-sm whitespace-nowrap"
                >
                  파일 닫기
                </button>
              ) : (
                <button 
                  onClick={() => setIsDrivePickerOpen(true)}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-surface-variant text-on-surface hover:bg-surface-bright border border-outline-variant rounded-md text-ui-label-bold transition-colors text-xs md:text-sm whitespace-nowrap"
                >
                  <span className="hidden sm:inline">드라이브 </span>파일 열기
                </button>
              )}
              <button 
                onClick={() => signOut()}
                className="p-1 rounded-full border-2 border-outline-variant hover:border-primary transition-colors text-on-surface group relative flex-shrink-0"
              >
                {session.user?.image ? (
                  <img src={session.user.image} alt="Profile" className="w-7 h-7 md:w-8 md:h-8 rounded-full" />
                ) : (
                  <span className="material-symbols-outlined w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-3xl">account_circle</span>
                )}
                {/* 툴팁 (마우스 호버시 로그아웃) */}
                <div className="absolute hidden group-hover:block top-10 right-0 bg-surface-bright p-2 rounded shadow-lg text-xs whitespace-nowrap z-50">
                  로그아웃
                </div>
              </button>
            </>
          ) : (
            <button 
              onClick={() => signIn("google")}
              className="px-3 md:px-4 py-1.5 md:py-2 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-md text-ui-label-bold transition-colors text-xs md:text-sm whitespace-nowrap"
            >
              Google 로그인
            </button>
          )}
        </div>
      </header>

      <DrivePickerModal 
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelectFile={handleSelectFile}
      />
    </>
  );
}
