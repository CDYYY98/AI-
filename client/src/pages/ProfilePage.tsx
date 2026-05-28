import { useQuery } from "@tanstack/react-query";
import { getQuota } from "@/api/auth";
import { apiClient } from "@/api/client";
import { useAuth } from "@/components/layout/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatInspiration,
  formatYuan,
  quotaToInspiration,
  RECHARGE_PACKAGES,
  resolveAccountPlanByTier,
} from "@/lib/inspiration";

interface AdminContact {
  wechat?: string;
  qq?: string;
  tips?: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const quotaQuery = useQuery({
    queryKey: ["auth", "quota"],
    queryFn: getQuota,
    refetchInterval: 15000,
  });

  const contactQuery = useQuery({
    queryKey: ["admin", "contact"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: AdminContact }>("/admin/contact");
      return data;
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
  const contact = contactQuery.data?.data ?? {};

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

      <Card className="border-amber-300 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-950">需要补充灵感值？</CardTitle>
          <CardDescription className="text-amber-800">
            联系管理员，付款后会为账户补充灵感值。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            {contact.wechat || contact.qq ? (
              <>
                {contact.wechat ? (
                  <div className="flex items-center gap-2 rounded bg-white/60 p-2">
                    <span className="w-16 text-muted-foreground">微信</span>
                    <span className="select-all font-mono font-medium">{contact.wechat}</span>
                  </div>
                ) : null}
                {contact.qq ? (
                  <div className="flex items-center gap-2 rounded bg-white/60 p-2">
                    <span className="w-16 text-muted-foreground">QQ</span>
                    <span className="select-all font-mono font-medium">{contact.qq}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">管理员暂未设置联系方式。</p>
            )}
            {contact.tips ? (
              <p className="mt-2 text-xs text-muted-foreground">{contact.tips}</p>
            ) : null}
          </div>
          <div className="border-t border-amber-200 pt-3 text-sm">
            <p className="font-medium">参考套餐</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
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
