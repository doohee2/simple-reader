"use client";

import { UserCircle, LogOut, Library, X } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";
import DrivePickerModal from "./DrivePickerModal";
import StorageManagerModal from "./StorageManagerModal";
import BookInfoModal from "./BookInfoModal";
import { useStore } from "@/store/useStore";
import { APP_INFO } from "@/lib/constants";

export default function Header() {
  const { data: session, status } = useSession();
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isBookInfoModalOpen, setIsBookInfoModalOpen] = useState(false);
  
  const { 
    selectedFileId,
    selectedFileName, 
    selectedFileSize,
    setSelectedFile, 
    theme, 
    toggleTheme, 
    isDrivePickerOpen, 
    setIsDrivePickerOpen,
    isStorageManagerOpen,
    setIsStorageManagerOpen
  } = useStore();

  const handleSelectFile = (fileId: string, fileName: string, fileSize: number | null) => {
    setSelectedFile(fileId, fileName, fileSize);
    setIsDrivePickerOpen(false);
  };

  const iconButtonClass = "w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors duration-200 rounded-full hover:bg-surface-variant flex-shrink-0";
  const iconClass = "material-symbols-outlined text-[22px] md:text-[24px]";

  return (
    <>
      <header className="flex justify-between items-center w-full px-2 md:px-8 h-14 md:h-16 bg-surface border-b border-outline-variant flex-shrink-0 z-10 gap-2">
        {/* 좌측: 로고 및 파일명 */}
        <div className="flex items-center gap-1 md:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <span className={`material-symbols-outlined text-primary text-xl md:text-2xl font-bold ${selectedFileName ? 'hidden sm:block' : 'block'}`}>menu_book</span>
            <div className="flex items-center">
              <svg viewBox="0 0 340 60" className={`h-[28px] sm:h-[34px] w-auto drop-shadow-sm ${selectedFileName ? 'hidden sm:block' : 'block'}`} fill="none" xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: 'var(--font-plus-jakarta-sans), sans-serif' }}>
                <text x="0" y="45" fontWeight="800" fontSize="42" letterSpacing="-0.02em" className="fill-[#0066ff] dark:fill-[#d0ebff] transition-colors duration-300">Simple</text>
                <circle cx="18" cy="10" r="4" className="fill-[#0066ff] dark:fill-[#d0ebff] transition-colors duration-300"/>
                <text x="150" y="45" fontWeight="700" fontSize="42" letterSpacing="-0.02em" className="fill-current text-on-surface transition-colors duration-300">Reader</text>
              </svg>
              <button 
                onClick={() => setIsInfoModalOpen(true)} 
                className="text-on-surface-variant hover:text-primary rounded-full transition-colors mt-[6px] -ml-2"
                title="앱 정보"
              >
                <span className="material-symbols-outlined text-[16px]">info</span>
              </button>
            </div>
          </div>
          {selectedFileName && (
            <>
              <div className="h-4 md:h-6 w-px bg-outline-variant mx-1 md:mx-2 hidden sm:block"></div>
              <div className="flex flex-col min-w-0 flex-1">
                <button 
                  onClick={() => setIsBookInfoModalOpen(true)}
                  className="text-sm md:text-title-sm font-bold text-on-surface hover:text-primary transition-colors text-left flex items-center gap-1 md:gap-2 min-w-0"
                  title={selectedFileName}
                >
                  <span className="truncate">{selectedFileName}</span>
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-secondary flex-shrink-0" title="동기화 완료"></span>
                </button>
              </div>
            </>
          )}
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
                  onClick={() => setSelectedFile(null, null, null)}
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

      <BookInfoModal 
        isOpen={isBookInfoModalOpen}
        onClose={() => setIsBookInfoModalOpen(false)}
        fileId={selectedFileId}
        fileName={selectedFileName}
        fileSize={selectedFileSize}
      />

      {isInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-sm w-full p-6 relative border border-outline-variant">
            <button onClick={() => setIsInfoModalOpen(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
              <X size={20} />
            </button>
            <div className="flex items-center justify-center mb-6 mt-2 gap-2 text-primary">
              <span className="material-symbols-outlined text-[28px]">info</span>
              <svg viewBox="0 0 340 60" className="h-[36px] w-auto drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: 'var(--font-plus-jakarta-sans), sans-serif' }}>
                <text x="0" y="45" fontWeight="800" fontSize="42" letterSpacing="-0.02em" className="fill-[#0066ff] dark:fill-[#d0ebff] transition-colors duration-300">Simple</text>
                <circle cx="18" cy="10" r="4" className="fill-[#0066ff] dark:fill-[#d0ebff] transition-colors duration-300"/>
                <text x="150" y="45" fontWeight="700" fontSize="42" letterSpacing="-0.02em" className="fill-current text-on-surface transition-colors duration-300">Reader</text>
              </svg>
            </div>
            <p className="text-ui-body text-on-surface mb-6 leading-relaxed">
              {APP_INFO.DESCRIPTION}
            </p>
            <div className="text-right border-t border-outline-variant pt-4 mt-2">
              <p className="text-ui-label-sm text-on-surface-variant font-medium">
                {APP_INFO.VERSION}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
