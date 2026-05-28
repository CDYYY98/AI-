import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAPIKeySettings, getLLMSelectionSetting, saveLLMSelectionSetting } from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { resolvePreferredLLMSelection } from "@/lib/llmSelection";
import { useLLMStore } from "@/store/llmStore";
import { useAuth } from "./AuthContext";

export default function LLMSelectionBootstrap() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const store = useLLMStore();
  const queryClient = useQueryClient();
  const selectionQuery = useQuery({
    queryKey: queryKeys.settings.llmSelection,
    queryFn: getLLMSelectionSetting,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });
  const apiKeySettingsQuery = useQuery({
    queryKey: queryKeys.settings.apiKeys,
    queryFn: getAPIKeySettings,
    staleTime: 5 * 60 * 1000,
    enabled: isAdmin,
  });

  const saveSelectionMutation = useMutation({
    mutationFn: saveLLMSelectionSetting,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.settings.llmSelection, response);
    },
  });

  const resolvedSelection = useMemo(() => {
    const savedSelection = selectionQuery.data?.data ?? null;
    if (savedSelection) return savedSelection;
    if (!apiKeySettingsQuery.isSuccess && !apiKeySettingsQuery.isError) return null;
    return resolvePreferredLLMSelection(
      null,
      apiKeySettingsQuery.data?.data ?? [],
      { temperature: store.temperature, maxTokens: store.maxTokens },
    );
  }, [
    apiKeySettingsQuery.data?.data,
    apiKeySettingsQuery.isError,
    apiKeySettingsQuery.isSuccess,
    selectionQuery.data?.data,
    selectionQuery.isError,
    selectionQuery.isSuccess,
    store.maxTokens,
    store.temperature,
  ]);

  const didSet = useRef(false);
  useEffect(() => {
    if (!resolvedSelection || didSet.current) return;
    store.setSelection(resolvedSelection);
    didSet.current = true;
  }, [resolvedSelection]);

  return null;
}
