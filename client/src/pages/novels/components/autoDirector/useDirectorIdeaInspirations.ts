import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type {
  DirectorIdeaInspiration,
  DirectorRunMode,
} from "@ai-novel/shared/types/novelDirector";
import { generateDirectorIdeaInspirations } from "@/api/novelDirector";
import { toast } from "@/components/ui/toast";
import type { NovelBasicFormState } from "../../novelBasicInfo.shared";
import {
  buildAutoDirectorRequestPayload,
  type AutoDirectorRequestLlmOptions,
} from "../NovelAutoDirectorDialog.shared";

interface UseDirectorIdeaInspirationsInput {
  basicForm: NovelBasicFormState;
  genreOptions: Array<{ id: string; path: string; label: string }>;
  worldOptions: Array<{ id: string; name: string }>;
  idea: string;
  llm: AutoDirectorRequestLlmOptions;
  runMode: DirectorRunMode;
  selectedStyleProfileId?: string;
  onIdeaChange: (value: string) => void;
}

function findGenreLabel(
  genreOptions: Array<{ id: string; path: string; label: string }>,
  genreId: string,
): string | undefined {
  return genreOptions.find((option) => option.id === genreId)?.label;
}

function findWorldName(
  worldOptions: Array<{ id: string; name: string }>,
  worldId: string,
): string | undefined {
  return worldOptions.find((option) => option.id === worldId)?.name;
}

export function useDirectorIdeaInspirations({
  basicForm,
  genreOptions,
  worldOptions,
  idea,
  llm,
  runMode,
  selectedStyleProfileId,
  onIdeaChange,
}: UseDirectorIdeaInspirationsInput) {
  const [ideas, setIdeas] = useState<DirectorIdeaInspiration[]>([]);

  const mutation = useMutation({
    mutationFn: () => generateDirectorIdeaInspirations({
      ...buildAutoDirectorRequestPayload(basicForm, idea, llm, runMode, undefined, {
        styleProfileId: selectedStyleProfileId,
      }),
      currentIdea: idea.trim() || undefined,
      genreLabel: findGenreLabel(genreOptions, basicForm.genreId),
      worldName: findWorldName(worldOptions, basicForm.worldId),
    }),
    onSuccess: (response) => {
      const nextIdeas = response.data?.ideas ?? [];
      setIdeas(nextIdeas);
      if (nextIdeas.length === 0) {
        toast.error("暂时没有生成可用灵感，请补充一点题材或主角方向后再试。");
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "生成起始灵感失败，请稍后再试。");
    },
  });

  const useIdea = useCallback((text: string) => {
    if (idea.trim()) {
      const confirmed = window.confirm("上方起始想法已有内容。确认使用这条灵感并覆盖原内容吗？");
      if (!confirmed) {
        return;
      }
    }
    onIdeaChange(text);
  }, [idea, onIdeaChange]);

  return {
    ideas,
    isGenerating: mutation.isPending,
    generate: () => mutation.mutate(),
    useIdea,
  };
}
