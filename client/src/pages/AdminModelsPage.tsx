import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAPIKeySettings,
  saveAPIKeySetting,
  refreshProviderModelList,
  createCustomProvider,
  deleteCustomProvider,
  getLLMSelectionSetting,
  getAccountTierModelSettings,
  saveAccountTierModelSettings,
  type AccountTierModelConfig,
  type APIKeyStatus,
} from "@/api/settings";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

function FallbackChainEditor() {
  const [fallbacks, setFallbacks] = useState<Array<{ provider: string; model: string }>>([]);
  const [saved, setSaved] = useState(false);

  const { data: providersData } = useQuery({
    queryKey: queryKeys.settings.apiKeys,
    queryFn: getAPIKeySettings,
  });

  useEffect(() => {
    apiClient.get("/admin/model-fallbacks").then(({ data: d }) => {
      if (d.success && Array.isArray(d.data)) setFallbacks(d.data);
    }).catch(() => {});
  }, []);

  const providers = useMemo(() => providersData?.data ?? [], [providersData]);

  const save = async () => {
    try {
      await apiClient.put("/admin/model-fallbacks", fallbacks);
      setSaved(true);
      toast.success("故障切换链已更新");
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const add = () => {
    const first = providers[0];
    setFallbacks([...fallbacks, { provider: first?.provider ?? "deepseek", model: first?.currentModel ?? "" }]);
  };

  const remove = (idx: number) => {
    setFallbacks(fallbacks.filter((_, i) => i !== idx));
  };

  const updateProvider = (idx: number, provider: string) => {
    const p = providers.find((pp: APIKeyStatus) => pp.provider === provider);
    const updated = [...fallbacks];
    updated[idx] = { provider, model: p?.currentModel || fallbacks[idx].model };
    setFallbacks(updated);
  };

  return (
    <div className="space-y-3">
      {fallbacks.length === 0 && (
        <p className="text-xs text-muted-foreground">未配置故障切换。当前模型失败时用户会看到错误。</p>
      )}
      {fallbacks.map((fb, idx) => {
        const currentProvider = providers.find((p: APIKeyStatus) => p.provider === fb.provider);
        return (
          <div key={idx} className="flex items-center gap-2 rounded border p-2">
            <span className="text-xs text-muted-foreground w-6">{idx + 1}</span>
            <select className="rounded border px-2 py-1 text-xs flex-1" value={fb.provider}
              onChange={(e) => updateProvider(idx, e.target.value)}>
              {providers.map((p: APIKeyStatus) => (
                <option key={p.provider} value={p.provider}>{p.name}</option>
              ))}
            </select>
            <input className="rounded border px-2 py-1 text-xs w-40" placeholder="模型名"
              value={fb.model} onChange={(e) => {
                const u = [...fallbacks];
                u[idx] = { ...u[idx], model: e.target.value };
                setFallbacks(u);
              }} />
            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(idx)}>移除</Button>
          </div>
        );
      })}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={add}>+ 添加备用</Button>
        <Button size="sm" onClick={save} disabled={fallbacks.length === 0}>{saved ? "已保存" : "保存"}</Button>
      </div>
    </div>
  );
}

function getProviderDefaultModel(provider: APIKeyStatus | undefined): string {
  return provider?.currentModel || provider?.defaultModel || "";
}

function createConfigFromProvider(provider: APIKeyStatus | undefined): AccountTierModelConfig | null {
  const model = getProviderDefaultModel(provider);
  return provider && model ? { provider: provider.provider, model } : null;
}

function AccountTierModelPolicyEditor({ providers }: { providers: APIKeyStatus[] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{
    trial: AccountTierModelConfig | null;
    paid: AccountTierModelConfig | null;
  }>({ trial: null, paid: null });

  const settingsQuery = useQuery({
    queryKey: ["admin", "account-tier-models"],
    queryFn: getAccountTierModelSettings,
  });

  useEffect(() => {
    const data = settingsQuery.data?.data;
    if (!data) return;
    const defaultConfig = createConfigFromProvider(providers[0]);
    setDraft({
      trial: data.trial ?? defaultConfig,
      paid: data.paid ?? defaultConfig,
    });
  }, [providers, settingsQuery.data?.data]);

  const saveMutation = useMutation({
    mutationFn: () => saveAccountTierModelSettings(draft),
    onSuccess: (res) => {
      toast.success(res.message ?? "账户模型策略已更新");
      queryClient.invalidateQueries({ queryKey: ["admin", "account-tier-models"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateTierProvider = (tier: "trial" | "paid", provider: string) => {
    const selectedProvider = providers.find((item) => item.provider === provider);
    setDraft((current) => ({
      ...current,
      [tier]: {
        provider: selectedProvider?.provider ?? provider,
        model: getProviderDefaultModel(selectedProvider),
      },
    }));
  };

  const updateTierModel = (tier: "trial" | "paid", model: string) => {
    setDraft((current) => {
      const currentProvider = current[tier]?.provider ?? providers[0]?.provider ?? "deepseek";
      return {
        ...current,
        [tier]: {
          provider: currentProvider,
          model,
        },
      };
    });
  };

  const renderTierRow = (
    tier: "trial" | "paid",
    label: string,
    description: string,
  ) => {
    const config = draft[tier];
    const selectedProvider = providers.find((item) => item.provider === config?.provider) ?? providers[0];
    const models = selectedProvider?.models?.length ? selectedProvider.models : [getProviderDefaultModel(selectedProvider)].filter(Boolean);

    return (
      <div className="grid gap-3 rounded border p-3 md:grid-cols-[160px_1fr_1fr]">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">模型厂商</label>
          <select
            className="w-full rounded border bg-background px-2 py-1 text-sm"
            value={selectedProvider?.provider ?? config?.provider ?? ""}
            onChange={(event) => updateTierProvider(tier, event.target.value)}
          >
            {providers.map((provider) => (
              <option key={provider.provider} value={provider.provider}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">模型名称</label>
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            list={`account-tier-models-${tier}`}
            value={config?.model ?? getProviderDefaultModel(selectedProvider)}
            onChange={(event) => updateTierModel(tier, event.target.value)}
            placeholder="例如 deepseek-v4-pro"
          />
          <datalist id={`account-tier-models-${tier}`}>
            {models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">请先配置至少一个模型厂商。</p>
      ) : (
        <>
          {renderTierRow("trial", "体验账户", "新用户和试用用户会自动使用这组模型。")}
          {renderTierRow("paid", "创作账户", "付费创作用户会自动使用这组模型。")}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "保存中..." : "保存账户模型策略"}
          </Button>
        </>
      )}
    </div>
  );
}

export default function AdminModelsPage() {
  const queryClient = useQueryClient();
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editModel, setEditModel] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

  const {
    data,
    isLoading,
    isFetching: isProvidersFetching,
    refetch: refetchProviders,
  } = useQuery({
    queryKey: queryKeys.settings.apiKeys,
    queryFn: getAPIKeySettings,
  });

  const saveMutation = useMutation({
    mutationFn: ({ provider, model, apiKey }: { provider: string; model?: string; apiKey?: string }) =>
      saveAPIKeySetting(provider as any, { model, key: apiKey || undefined }),
    onSuccess: () => {
      toast.success("已保存");
      setEditingProvider(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const refreshMutation = useMutation({
    mutationFn: (provider: string) => refreshProviderModelList(provider as any),
    onSuccess: (res, provider) => {
      toast.success(`${provider} 模型列表已刷新（${res.data?.models?.length ?? 0} 个）`);
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addMutation = useMutation({
    mutationFn: () => createCustomProvider({
      name: newName.trim(),
      key: newApiKey.trim() || undefined,
      model: newModel.trim() || undefined,
      baseURL: newBaseUrl.trim(),
    }),
    onSuccess: (res) => {
      toast.success(`自定义厂商 ${res.data?.displayName} 已创建`);
      setShowAddForm(false);
      setNewName("");
      setNewBaseUrl("");
      setNewModel("");
      setNewApiKey("");
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (provider: string) => deleteCustomProvider(provider as any),
    onSuccess: () => {
      toast.success("已删除");
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const {
    data: defaultSelection,
    isFetching: isDefaultSelectionFetching,
    refetch: refetchDefaultSelection,
  } = useQuery({
    queryKey: queryKeys.settings.llmSelection,
    queryFn: getLLMSelectionSetting,
  });

  const setDefaultMutation = useMutation({
    mutationFn: ({ provider, model }: { provider: string; model: string }) =>
      apiClient.post("/admin/set-default-model", { provider, model }),
    onSuccess: (_response, variables) => {
      queryClient.setQueryData(queryKeys.settings.llmSelection, (current: any) => ({
        success: true,
        data: {
          ...(current?.data ?? {}),
          provider: variables.provider,
          model: variables.model,
          temperature: current?.data?.temperature ?? 0.7,
        },
        message: current?.message ?? "",
      }));
      toast.success("已设为默认，所有任务已切换");
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.llmSelection });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRoutes });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRouteConnectivity });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const currentDefaultProvider = defaultSelection?.data?.provider ?? "";
  const currentDefaultModel = defaultSelection?.data?.model ?? "";
  const isRefreshingServerConfig = isProvidersFetching || isDefaultSelectionFetching;

  const providers = useMemo(() => data?.data ?? [], [data]);

  const refreshServerConfig = async () => {
    await Promise.all([
      refetchProviders(),
      refetchDefaultSelection(),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRoutes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.modelRouteConnectivity }),
    ]);
    toast.success("已从服务器刷新当前模型配置");
  };

  const handleEdit = (provider: string, currentModel: string) => {
    setEditingProvider(provider);
    setEditModel(currentModel);
    setEditApiKey("");
  };

  const handleSave = () => {
    if (!editingProvider) return;
    saveMutation.mutate({
      provider: editingProvider,
      model: editModel.trim() || undefined,
      apiKey: editApiKey.trim() || undefined,
    });
  };

  const handleRefresh = (provider: string) => {
    refreshMutation.mutate(provider);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* 新增自定义厂商 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>模型管理</CardTitle>
            <CardDescription>
              配置 API Key 和默认模型。服务器当前默认：
              <span className="ml-1 font-medium text-foreground">
                {currentDefaultProvider && currentDefaultModel
                  ? `${currentDefaultProvider} / ${currentDefaultModel}`
                  : "未设置"}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void refreshServerConfig()}
              disabled={isRefreshingServerConfig}
            >
              {isRefreshingServerConfig ? "刷新中..." : "刷新当前配置"}
            </Button>
            <Button variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? "取消" : "新增自定义厂商"}
            </Button>
          </div>
        </CardHeader>
        {showAddForm && (
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">厂商名称 *</label>
                <input className="rounded border px-2 py-1 text-xs w-full" placeholder="例如：我的API代理"
                  value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">API 地址 *</label>
                <input className="rounded border px-2 py-1 text-xs w-full" placeholder="https://api.example.com/v1"
                  value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">API Key</label>
                <input className="rounded border px-2 py-1 text-xs w-full" placeholder="sk-xxx"
                  value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">默认模型</label>
                <input className="rounded border px-2 py-1 text-xs w-full" placeholder="例如 gpt-4"
                  value={newModel} onChange={(e) => setNewModel(e.target.value)} />
              </div>
            </div>
            <Button className="mt-3" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newName.trim() || !newBaseUrl.trim()}>
              {addMutation.isPending ? "创建中..." : "创建"}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* 已有提供商列表 */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">提供商</th>
                    <th className="py-2 pr-3">当前模型</th>
                    <th className="py-2 pr-3">状态</th>
                    <th className="py-2 pr-3">API 地址</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p: APIKeyStatus) => {
                    const defaultCandidateModel = p.currentModel || p.defaultModel;
                    const isCurrentDefault = currentDefaultProvider === p.provider
                      && currentDefaultModel === defaultCandidateModel;
                    return (
                    <tr key={p.provider} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{p.name} {p.kind === "custom" && <Badge variant="outline">自定义</Badge>}</td>
                      <td className="py-2 pr-3">
                        {editingProvider === p.provider ? (
                          <div className="flex flex-col gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-0.5 block">模型名称</label>
                              <select className="rounded border px-2 py-1 text-xs w-full bg-background" value={editModel} onChange={(e) => setEditModel(e.target.value)}>
                                <option value="">-- 选择模型 --</option>
                                {p.models.map((m) => (<option key={m} value={m}>{m}</option>))}
                              </select>
                              <input className="rounded border px-2 py-1 text-xs w-full mt-1" placeholder="或手动输入" value={editModel} onChange={(e) => setEditModel(e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-0.5 block">API Key</label>
                              <input className="rounded border px-2 py-1 text-xs w-full" placeholder="留空不修改" value={editApiKey} onChange={(e) => setEditApiKey(e.target.value)} />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>保存</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingProvider(null)}>取消</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{p.currentModel || "-"}</span>
                            <span className="text-xs text-muted-foreground">{p.isConfigured ? "(已配置)" : "(未配置)"}</span>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(p.provider, p.currentModel)}>编辑</Button>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={p.isConfigured ? "default" : "outline"}>{p.isConfigured ? "已配置" : "未配置"}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs max-w-[150px] truncate">{p.currentBaseURL || "-"}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => handleRefresh(p.provider)} disabled={refreshMutation.isPending}>刷新模型</Button>
                          <Button
                            size="sm"
                            variant={isCurrentDefault ? "default" : "outline"}
                            onClick={() => setDefaultMutation.mutate({ provider: p.provider, model: defaultCandidateModel })}
                            disabled={setDefaultMutation.isPending || !p.isConfigured}
                          >
                            {isCurrentDefault ? "当前默认" : "设为默认"}
                          </Button>
                          {p.kind === "custom" && (
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (window.confirm(`删除 ${p.name}？`)) deleteMutation.mutate(p.provider); }}>删除</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>账户模型策略</CardTitle>
          <CardDescription>
            普通用户调用 AI 时会按账户类型自动使用对应模型；管理员仍可在后台手动管理模型配置。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountTierModelPolicyEditor providers={providers} />
        </CardContent>
      </Card>

      {/* 故障切换配置 */}
      <Card>
        <CardHeader>
          <CardTitle>模型故障切换</CardTitle>
          <CardDescription>
            当前模型的 API Key 余额不足或认证失败时，自动切换到备用模型。按优先级从上到下切换。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FallbackChainEditor />
        </CardContent>
      </Card>
    </div>
  );
}
