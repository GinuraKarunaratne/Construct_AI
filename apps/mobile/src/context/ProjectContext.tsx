import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api";

export interface ProjectSummary {
  id: number;
  name: string;
  location_name?: string | null;
  status: string;
}

interface ProjectCtx {
  projects: ProjectSummary[];
  projectsLoading: boolean;
  selectedProjectId: number | null;
  selectedProject: ProjectSummary | null;
  setSelectedProjectId: (id: number) => void;
}

const Ctx = createContext<ProjectCtx | null>(null);

const STORAGE_KEY = "selected_project_id";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(null);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["mobile-projects"],
    queryFn: () =>
      apiClient
        .get<ProjectSummary[]>("/projects")
        .then((r) => r.data),
    staleTime: 60_000,
  });

  // On mount — restore from AsyncStorage; fall back to first project
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setSelectedProjectIdState(Number(stored));
      }
    });
  }, []);

  // If nothing stored and projects loaded, default to first
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      const first = projects[0].id;
      setSelectedProjectIdState(first);
      AsyncStorage.setItem(STORAGE_KEY, String(first)).catch(() => null);
    }
  }, [projects, selectedProjectId]);

  const setSelectedProjectId = useCallback(
    (id: number) => {
      setSelectedProjectIdState(id);
      AsyncStorage.setItem(STORAGE_KEY, String(id)).catch(() => null);
    },
    []
  );

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <Ctx.Provider
      value={{
        projects,
        projectsLoading,
        selectedProjectId,
        selectedProject,
        setSelectedProjectId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useProject() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
