"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider } from "@/context/SidebarContext";
import { ProjectProvider } from "@/context/ProjectContext";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-ink-900 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none">
            <path d="M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z" fill="currentColor" opacity="0.4"/>
            <path d="M4 4h7v7H4z M13 13h7v7h-7z" fill="currentColor"/>
          </svg>
        </div>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-ink-900 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-ink-900 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-ink-900 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <ProjectProvider>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden bg-surface-bg">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto">
              <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-[1440px] mx-auto w-full">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProjectProvider>
  );
}
