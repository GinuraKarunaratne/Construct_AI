"use client";

import { useQuery } from "@tanstack/react-query";
import { projectsApi, ProjectOut } from "@/services/projects";

export function useActiveProject(): {
  project: ProjectOut | undefined;
  projectId: number | undefined;
  isLoading: boolean;
} {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });
  const project = projects?.[0];
  return { project, projectId: project?.id, isLoading };
}
