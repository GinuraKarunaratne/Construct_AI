"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface ProjectCtx {
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number) => void;
}

const ProjectCtx = createContext<ProjectCtx | null>(null);

const STORAGE_KEY = "constructai_active_project_id";

function readStored(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(
    readStored
  );

  const setSelectedProjectId = useCallback((id: number) => {
    setSelectedProjectIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  return (
    <ProjectCtx.Provider value={{ selectedProjectId, setSelectedProjectId }}>
      {children}
    </ProjectCtx.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectCtx);
  if (!ctx) throw new Error("useProjectContext must be used within ProjectProvider");
  return ctx;
}
