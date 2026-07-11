"use client";

import { UserCircle, LogOut, Library } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";
import DrivePickerModal from "./DrivePickerModal";
import StorageManagerModal from "./StorageManagerModal";
import { useStore } from "@/store/useStore";

export default function Header() {
  const { data: session, status } = useSession();
  
  const { 
    selectedFileName, 
    setSelectedFile, 
    theme, 
    toggleTheme, 
    isDrivePickerOpen, 
    setIsDrivePickerOpen,
    isStorageManagerOpen,
    setIsStorageManagerOpen
  } = useStore();

  const handleSelectFile = (fileId: string, fileName: string) => {
    setSelectedFile(fileId, fileName);
    setIsDrivePickerOpen(false);
  };

  const iconButtonClass = "w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors duration-200 rounded-full hover:bg-surface-variant flex-shrink-0";
  const iconClass = "material-symbols-outlined text-[22px] md:text-[24px]";

  return (
    <>
      <header className="flex justify-between items-center w-full px-2 md:px-8 h-14 md:h-16 bg-surface border-b border-outline-variant flex-shrink-0 z-10 gap-2">
        {/* 좌측: 로고 및 파일명 */}
        <div className="flex items-center gap-1 md:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-xl md:text-2xl font-bold">menu_book</span>
            <span className="text-ui-label-bold md:text-headline-sm font-bold text-primary tracking-tight hidden sm:block">
              Simple Reader
            </span>
          </div>
          <div className="h-4 md:h-6 w-px bg-outline-variant mx-1 md:mx-2 hidden sm:block"></div>
          <div className="flex flex-col min-w-0">
            {selectedFileName ? (
              <span className="text-xs md:text-ui-label-bold text-on-surface truncate pr-1 md:pr-2 flex items-center gap-1 md:gap-2">
                {selectedFileName}
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-secondary" title="동기화 완료"></span>
              </span>
            ) : (
              <span className="text-xs md:text-ui-label-bold text-on-surface-variant italic truncate">
                파일을 열어주세요
              </span>
            )}
          </div>
        </div>

        {/* 우측: 공통 기능 영역 */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {/* 테마 토글 */}
          <button 
            onClick={toggleTheme}
            className={iconButtonClass}
            title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            <span className={iconClass}>{theme === "dark" ? "light_mode" : "dark_mode"}</span>
          </button>

          {/* 인증 상태에 따른 버튼들 */}
          {status === "authenticated" ? (
            <>
              {/* 내 서재 버튼 */}
              <button
                onClick={() => setIsStorageManagerOpen(true)}
                className={iconButtonClass}
                title="내 서재"
              >
                <Library className="w-[22px] h-[22px] md:w-[24px] md:h-[24px]" strokeWidth={2} />
              </button>

              {/* 파일 닫기 / 열기 */}
              {selectedFileName ? (
                <button 
                  onClick={() => setSelectedFile(null, null)}
                  className={iconButtonClass}
                  title="파일 닫기"
                >
                  <span className={iconClass}>close</span>
                </button>
              ) : (
                <button 
                  onClick={() => setIsDrivePickerOpen(true)}
                  className={iconButtonClass}
                  title="드라이브 파일 열기"
                >
                  <span className={iconClass}>folder_open</span>
                </button>
              )}
              
              {/* 로그아웃 / 프로필 */}
              <button 
                onClick={() => signOut()}
                className={`${iconButtonClass} p-0 border-2 border-transparent hover:border-primary group relative`}
                title="로그아웃"
              >
                {session.user?.image ? (
                  <img src={session.user.image} alt="Profile" className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover" />
                ) : (
                  <span className={iconClass}>account_circle</span>
                )}
                {/* 툴팁 (마우스 호버시 로그아웃) */}
                <div className="absolute hidden md:group-hover:block top-10 right-0 bg-surface-bright p-2 rounded shadow-lg text-xs whitespace-nowrap z-50">
                  로그아웃
                </div>
              </button>
            </>
          ) : (
            /* 비로그인 상태 */
            <button 
              onClick={() => signIn("google")}
              className={iconButtonClass}
              title="Google 로그인"
            >
              <span className={iconClass}>login</span>
            </button>
          )}
        </div>
      </header>

      <DrivePickerModal 
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelectFile={handleSelectFile}
      />

      <StorageManagerModal
        isOpen={isStorageManagerOpen}
        onClose={() => setIsStorageManagerOpen(false)}
      />
    </>
  );
}
