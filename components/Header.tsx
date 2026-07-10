"use client";

import { UserCircle, LogOut } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";
import DrivePickerModal from "./DrivePickerModal";
import { useStore } from "@/store/useStore";

export default function Header() {
  const { data: session, status } = useSession();
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  
  const { selectedFileName, setSelectedFile } = useStore();

  const handleSelectFile = (fileId: string, fileName: string) => {
    setSelectedFile(fileId, fileName);
    setIsDrivePickerOpen(false);
  };

  return (
    <>
      <header className="flex justify-between items-center w-full px-4 md:px-8 h-16 bg-surface border-b border-outline-variant flex-shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-2xl font-bold">📖</span>
            <span className="text-headline-sm font-bold text-primary tracking-tight hidden md:block">
              Simple Reader
            </span>
          </div>
          <div className="h-6 w-px bg-outline-variant mx-1 md:mx-2 hidden md:block"></div>
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <span className="text-ui-label-bold text-on-surface truncate max-w-[120px] sm:max-w-[200px] md:max-w-[400px]">
              {selectedFileName || "선택된 파일이 없습니다."}
            </span>
            <div className="flex items-center gap-1 bg-secondary-container/20 border border-secondary/30 px-2 py-0.5 rounded-full flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
              <span className="text-ui-label-sm text-secondary uppercase tracking-wider hidden sm:inline-block">
                동기화
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 ml-2">
          {status === "authenticated" ? (
            <>
              <button 
                onClick={() => setIsDrivePickerOpen(true)}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-surface-variant text-on-surface hover:bg-surface-bright border border-outline-variant rounded-md text-ui-label-bold transition-colors text-xs md:text-sm whitespace-nowrap"
              >
                <span className="hidden sm:inline">드라이브 </span>파일 열기
              </button>
              <button 
                onClick={() => signOut()}
                className="p-1 rounded-full border-2 border-outline-variant hover:border-primary transition-colors text-on-surface group relative flex-shrink-0"
              >
                {session.user?.image ? (
                  <img src={session.user.image} alt="Profile" className="w-7 h-7 md:w-8 md:h-8 rounded-full" />
                ) : (
                  <UserCircle className="w-7 h-7 md:w-8 md:h-8" />
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
