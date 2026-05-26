"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi, ProjectOut } from "@/services/projects";
import { useProjectContext } from "@/context/ProjectContext";

export function useActiveProject(): {
  project: ProjectOut | undefined;
  projectId: number | undefined;
  isLoading: boolean;
  allProjects: ProjectOut[];
} {
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  // Auto-select the first project when none is stored yet
  useEffect(() => {
    if (!isLoading && projects.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(projects[0].id);
    }
  }, [isLoading, projects, selectedProjectId, setSelectedProjectId]);

  // Resolve the active project — fall back to first if stored ID is stale
  const project: ProjectOut | undefined =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  return {
    project,
    projectId: project?.id,
    isLoading,
    allProjects: projects,
  };
}
