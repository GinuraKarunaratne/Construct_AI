"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider } from "@/context/SidebarContext";
import { Building2 } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-brand-600 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-brand-600 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-brand-600 animate-bounce" />
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
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-stone-50">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
