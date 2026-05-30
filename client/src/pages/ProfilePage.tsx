import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { getQuota } from "@/api/auth";
import { redeemRechargeCode } from "@/api/rechargeCodes";
import { useAuth } from "@/components/layout/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  formatInspiration,
  formatYuan,
  quotaToInspiration,
  RECHARGE_PACKAGES,
  resolveAccountPlanByTier,
} from "@/lib/inspiration";

const RECHARGE_PURCHASE_URL = "https://pay.ldxp.cn/shop/V3TX7692";

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rechargeCode, setRechargeCode] = useState("");
  const quotaQuery = useQuery({
    queryKey: ["auth", "quota"],
    queryFn: getQuota,
    refetchInterval: 15000,
  });

  const redeemMutation = useMutation({
    mutationFn: () => redeemRechargeCode(rechargeCode),
    onSuccess: (res) => {
      toast.success(res.message ?? "卡密兑换成功");
      setRechargeCode("");
      queryClient.invalidateQueries({ queryKey: ["auth", "quota"] });
      queryClient.refetchQueries({ queryKey: ["auth", "quota"], type: "active" });
    },
    onError: (error: Error) => {
      toast.error(error.message || "卡密兑换失败");
    },
  });

  const info = quotaQuery.data?.data;
  const remainQuota = info?.remainQuota ?? 0;
  const usedQuota = info?.usedQuota ?? 0;
  const issuedQuota = info?.totalQuota ?? (remainQuota + usedQuota);
  const issuedInspiration = quotaToInspiration(issuedQuota);
  const remainInspiration = quotaToInspiration(remainQuota);
  const usedInspiration = quotaToInspiration(usedQuota);
  const accountPlan = resolveAccountPlanByTier(info?.accountTier ?? user?.accountTier ?? "trial");
  const trimmedRechargeCode = rechargeCode.trim();
  const openPurchasePage = () => {
    window.open(RECHARGE_PURCHASE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>个人中心</CardTitle>
          <CardDescription>账号信息与创作额度</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex justify-between rounded-md border p-3">
              <span className="text-muted-foreground">用户名</span>
              <span className="font-medium">{user?.username}</span>
            </div>
            <div className="flex justify-between rounded-md border p-3">
              <span className="text-muted-foreground">邮箱</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between rounded-md border bg-sky-50 p-3">
              <span className="text-muted-foreground">账户状态</span>
              <span className="font-semibold text-sky-700">{accountPlan.label}</span>
            </div>
            <div className="flex justify-between rounded-md border bg-emerald-50 p-3">
              <span className="text-muted-foreground">剩余灵感值</span>
              <span className={`font-semibold ${remainInspiration > 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatInspiration(remainInspiration)}
              </span>
            </div>
            <div className="flex justify-between rounded-md border p-3">
              <span className="text-muted-foreground">已发放灵感值</span>
              <span className="font-medium text-muted-foreground">{formatInspiration(issuedInspiration)}</span>
            </div>
            <div className="flex justify-between rounded-md border p-3">
              <span className="text-muted-foreground">已使用灵感值</span>
              <span className="font-medium text-muted-foreground">{formatInspiration(usedInspiration)}</span>
            </div>
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              当前使用：{accountPlan.modelLabel}。{accountPlan.description}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-300 bg-emerald-50">
        <CardHeader>
          <CardTitle className="text-emerald-950">兑换卡密</CardTitle>
          <CardDescription className="text-emerald-800">
            输入购买或领取到的卡密，验证成功后灵感值会自动到账。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-emerald-900">打开购买页面，付款后复制卡密并回到这里兑换。</span>
            <Button
              type="button"
              variant="outline"
              className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
              onClick={openPurchasePage}
            >
              <ExternalLink className="h-4 w-4" />
              购买卡密
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="font-mono"
              placeholder="输入卡密"
              value={rechargeCode}
              onChange={(event) => setRechargeCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && trimmedRechargeCode && !redeemMutation.isPending) {
                  redeemMutation.mutate();
                }
              }}
            />
            <Button
              type="button"
              className="sm:w-28"
              disabled={!trimmedRechargeCode || redeemMutation.isPending}
              onClick={() => redeemMutation.mutate()}
            >
              {redeemMutation.isPending ? "兑换中" : "兑换"}
            </Button>
          </div>
          <div className="border-t border-emerald-200 pt-3 text-sm">
            <p className="font-medium">常用面额</p>
            <ul className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {RECHARGE_PACKAGES.map((item) => (
                <li key={item.yuan}>
                  {formatYuan(item.yuan)}：{formatInspiration(item.inspiration)} 灵感值
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
