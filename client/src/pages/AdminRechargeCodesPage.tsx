import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Gift, RefreshCw, Ticket, XCircle } from "lucide-react";
import {
  disableRechargeCode,
  generateRechargeCodes,
  listRechargeCodes,
  type GeneratedRechargeCode,
  type RechargeCodeInfo,
} from "@/api/rechargeCodes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { formatInspiration, RECHARGE_PACKAGES } from "@/lib/inspiration";

type StatusFilter = "" | "unused" | "redeemed" | "disabled" | "redeeming";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "", label: "全部卡密" },
  { value: "unused", label: "未使用" },
  { value: "redeemed", label: "已兑换" },
  { value: "disabled", label: "已停用" },
  { value: "redeeming", label: "处理中" },
];

function statusLabel(status: string): string {
  if (status === "unused") return "未使用";
  if (status === "redeemed") return "已兑换";
  if (status === "disabled") return "已停用";
  if (status === "redeeming") return "处理中";
  return status;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "unused") return "default";
  if (status === "redeemed") return "secondary";
  if (status === "disabled") return "destructive";
  return "outline";
}

function createDownload(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("zh-CN") : "-";
}

function buildCodeText(codes: GeneratedRechargeCode[]): string {
  return codes.map((item) => `${item.code},${item.inspirationAmount},${item.batchName ?? ""}`).join("\n");
}

export default function AdminRechargeCodesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("unused");
  const [amount, setAmount] = useState(String(RECHARGE_PACKAGES[0]?.inspiration ?? 5000));
  const [count, setCount] = useState("10");
  const [batchName, setBatchName] = useState("");
  const [note, setNote] = useState("");
  const [lastGenerated, setLastGenerated] = useState<GeneratedRechargeCode[]>([]);

  const codesQuery = useQuery({
    queryKey: ["admin", "recharge-codes", status],
    queryFn: () => listRechargeCodes(status || undefined),
    refetchInterval: 15000,
  });

  const codes = codesQuery.data?.data ?? [];
  const generatedText = useMemo(() => buildCodeText(lastGenerated), [lastGenerated]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generateRechargeCodes({
        inspirationAmount: Number(amount),
        count: Number(count),
        batchName: batchName.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: (res) => {
      setLastGenerated(res.data ?? []);
      toast.success(res.message ?? "卡密已生成");
      queryClient.invalidateQueries({ queryKey: ["admin", "recharge-codes"] });
    },
    onError: (error: Error) => toast.error(error.message || "卡密生成失败"),
  });

  const disableMutation = useMutation({
    mutationFn: disableRechargeCode,
    onSuccess: (res) => {
      toast.success(res.message ?? "卡密已停用");
      queryClient.invalidateQueries({ queryKey: ["admin", "recharge-codes"] });
    },
    onError: (error: Error) => toast.error(error.message || "卡密停用失败"),
  });

  const copyGenerated = async () => {
    if (!generatedText) return;
    await navigator.clipboard.writeText(generatedText);
    toast.success("本批卡密已复制");
  };

  const downloadGenerated = () => {
    if (!generatedText) return;
    createDownload(generatedText, `recharge-codes-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">卡密管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">生成可售卖或赠送的兑换码，用户在个人中心输入后自动到账。</p>
        </div>
        <Button type="button" variant="outline" onClick={() => codesQuery.refetch()} disabled={codesQuery.isFetching}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            生成卡密
          </CardTitle>
          <CardDescription>完整卡密只在生成后显示一次，请复制或导出后再离开页面。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">灵感值面额</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              >
                {RECHARGE_PACKAGES.map((item) => (
                  <option key={item.inspiration} value={item.inspiration}>
                    {formatInspiration(item.inspiration)} 灵感值
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">生成数量</span>
              <Input type="number" min="1" max="500" value={count} onChange={(event) => setCount(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">批次名</span>
              <Input value={batchName} onChange={(event) => setBatchName(event.target.value)} placeholder="例如：5月内测" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">备注</span>
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="售卖渠道或用途" />
            </label>
          </div>
          <Button type="button" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            <Ticket className="mr-2 h-4 w-4" />
            {generateMutation.isPending ? "生成中..." : "生成卡密"}
          </Button>
        </CardContent>
      </Card>

      {lastGenerated.length > 0 ? (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="text-emerald-950">本次生成结果</CardTitle>
            <CardDescription className="text-emerald-800">完整卡密不会在列表中再次展示。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="h-40 w-full rounded-md border bg-white px-3 py-2 font-mono text-xs"
              readOnly
              value={generatedText}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={copyGenerated}>
                <Copy className="mr-2 h-4 w-4" />
                复制本批卡密
              </Button>
              <Button type="button" variant="outline" onClick={downloadGenerated}>
                <Download className="mr-2 h-4 w-4" />
                导出 CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>卡密列表</CardTitle>
          <CardDescription>列表只显示前缀和尾号，避免完整卡密泄露。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex max-w-xs items-center gap-2">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          {codesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无卡密</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">卡密</th>
                    <th className="py-2 pr-3">面额</th>
                    <th className="py-2 pr-3">状态</th>
                    <th className="py-2 pr-3">批次</th>
                    <th className="py-2 pr-3">兑换账号</th>
                    <th className="py-2 pr-3">兑换时间</th>
                    <th className="py-2 pr-3">创建时间</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code: RechargeCodeInfo) => (
                    <tr key={code.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {code.codePrefix}...{code.codeSuffix}
                      </td>
                      <td className="py-2 pr-3">{formatInspiration(code.inspirationAmount)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={statusVariant(code.status)}>{statusLabel(code.status)}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{code.batchName || "-"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{code.redeemedByEmail || "-"}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{formatDate(code.redeemedAt)}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{formatDate(code.createdAt)}</td>
                      <td className="py-2">
                        {code.status === "unused" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={disableMutation.isPending}
                            onClick={() => disableMutation.mutate(code.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            停用
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
