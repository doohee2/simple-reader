"use client";

import { Library, X } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import DrivePickerModal from "./DrivePickerModal";
import StorageManagerModal from "./StorageManagerModal";
import BookInfoModal from "./BookInfoModal";
import { useStore } from "@/store/useStore";
import { APP_INFO } from "@/lib/constants";
import db from "@/lib/db";

export default function Header() {
  const { data: session, status } = useSession();
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isBookInfoModalOpen, setIsBookInfoModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isOnline } = useNetworkStatus();
  const [isUpdating, setIsUpdating] = useState(false);
  
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

  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const newFileId = `local-${crypto.randomUUID()}`;
    
    // 로컬 캐시에 즉시 저장
    await db.pdfCache.put({
      fileId: newFileId,
      fileName: file.name,
      fileSize: file.size,
      data: arrayBuffer,
      updatedAt: new Date().toISOString(),
    });

    // 전역 상태 업데이트 (뷰어 열기)
    setSelectedFile(newFileId, file.name, file.size);
    
    // 파일 입력 초기화
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const iconButtonClass = "w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors duration-200 rounded-full hover:bg-surface-variant flex-shrink-0";
  const iconClass = "material-symbols-outlined text-[22px] md:text-[24px]";

  return (
    <>
      <header className="flex justify-between items-center w-full px-2 md:px-8 h-14 md:h-16 bg-surface border-b border-outline-variant flex-shrink-0 z-10 gap-2">
        {/* 좌측: 로고 및 파일명 */}
        <div className="flex items-center gap-1 md:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <button 
              onClick={() => setIsInfoModalOpen(true)}
              className={`material-symbols-outlined text-primary text-xl md:text-2xl font-bold hover:opacity-80 transition-opacity ${selectedFileName ? 'hidden sm:block' : 'block'}`}
              title="앱 정보"
            >
              menu_book
            </button>
            <div className="flex items-center">
              <svg viewBox="0 0 340 60" className={`h-[28px] sm:h-[34px] w-auto drop-shadow-sm ${selectedFileName ? 'hidden sm:block' : 'block'}`} fill="none" xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: 'var(--font-plus-jakarta-sans), sans-serif' }}>
                <text x="0" y="45" fontWeight="800" fontSize="42" letterSpacing="-0.02em" className="fill-[#0044cc] dark:fill-[#d0ebff] transition-colors duration-300">Simple</text>
                <circle cx="18" cy="10" r="4" className="fill-[#0044cc] dark:fill-[#d0ebff] transition-colors duration-300"/>
                <text x="150" y="45" fontWeight="700" fontSize="42" letterSpacing="-0.02em" className="fill-current text-on-surface transition-colors duration-300">Reader</text>
              </svg>
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
          {/* 오프라인 뱃지 */}
          {!isOnline && (
            <div className="flex items-center gap-1 bg-error/15 text-error border border-error/30 px-2 py-1 rounded-full text-[11px] font-bold flex-shrink-0 animate-pulse">
              <span className="material-symbols-outlined text-[14px]">cloud_off</span>
              <span className="hidden sm:inline">오프라인</span>
            </div>
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

          {/* 공통 기능: 내 서재 */}
          <button
            onClick={() => setIsStorageManagerOpen(true)}
            className={iconButtonClass}
            title="내 서재"
          >
            <Library className="w-[22px] h-[22px] md:w-[24px] md:h-[24px]" strokeWidth={2} />
          </button>

          {/* 공통 기능: 파일 닫기 / 열기 */}
          {selectedFileName ? (
            <button 
              onClick={() => setSelectedFile(null, null, null)}
              className={iconButtonClass}
              title="파일 닫기"
            >
              <span className={iconClass}>close</span>
            </button>
          ) : (
            <>
              <input 
                type="file" 
                accept="application/pdf" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleLocalFileSelect} 
              />
              <button 
                onClick={() => status === "authenticated" ? setIsDrivePickerOpen(true) : fileInputRef.current?.click()}
                className={iconButtonClass}
                title={status === "authenticated" ? "드라이브 파일 열기" : "로컬 파일 열기"}
              >
                <span className={iconClass}>{status === "authenticated" ? "folder_open" : "upload_file"}</span>
              </button>
            </>
          )}

          {/* 인증 상태에 따른 버튼들 */}
          {status === "authenticated" ? (
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
                <text x="0" y="45" fontWeight="800" fontSize="42" letterSpacing="-0.02em" className="fill-[#0044cc] dark:fill-[#d0ebff] transition-colors duration-300">Simple</text>
                <circle cx="18" cy="10" r="4" className="fill-[#0044cc] dark:fill-[#d0ebff] transition-colors duration-300"/>
                <text x="150" y="45" fontWeight="700" fontSize="42" letterSpacing="-0.02em" className="fill-current text-on-surface transition-colors duration-300">Reader</text>
              </svg>
            </div>
            <p className="text-ui-body text-on-surface mb-6 leading-relaxed">
              {APP_INFO.DESCRIPTION}
            </p>
            <div className="border-t border-outline-variant pt-4 mt-2 space-y-3">
              <button
                onClick={async () => {
                  if (!confirm("앱 캐시를 초기화하고 최신 버전으로 업데이트합니다. PDF 데이터와 메모는 유지됩니다.")) return;
                  setIsUpdating(true);
                  try {
                    // 1. 모든 서비스 워커 등록 해제
                    if ("serviceWorker" in navigator) {
                      const registrations = await navigator.serviceWorker.getRegistrations();
                      await Promise.all(registrations.map(r => r.unregister()));
                    }
                    // 2. 모든 캐시 스토리지 삭제
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                    // 3. 강제 새로고침
                    window.location.reload();
                  } catch (err) {
                    console.error("캐시 초기화 실패:", err);
                    setIsUpdating(false);
                    alert("업데이트에 실패했습니다. 페이지를 새로고침해 주세요.");
                  }
                }}
                disabled={isUpdating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-colors text-ui-label-bold disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${isUpdating ? 'animate-spin' : ''}`}>
                  {isUpdating ? 'progress_activity' : 'system_update_alt'}
                </span>
                {isUpdating ? '업데이트 중...' : '최신 버전으로 업데이트'}
              </button>
              <p className="text-ui-label-sm text-on-surface-variant font-medium text-right">
                {APP_INFO.VERSION}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
