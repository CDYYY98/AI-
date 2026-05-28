import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import {
  formatInspiration,
  formatYuan,
  INSPIRATION_PER_USD,
  paymentAmountToInspiration,
  quotaToInspiration,
  RECHARGE_PACKAGES,
} from "@/lib/inspiration";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  apiToken: string | null;
  apiTokenName: string | null;
  apiQuota: number;
  accountTier?: string;
  remainQuota: number;
  usedQuota: number;
  totalQuota?: number;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

async function getAdminUsers() {
  const { data } = await apiClient.get<ApiResponse<AdminUser[]>>("/admin/users");
  return data;
}

async function addPaymentAmount(userId: string, paymentAmount: number) {
  const inspirationAmount = paymentAmountToInspiration(paymentAmount);
  const { data } = await apiClient.post<ApiResponse<AdminUser | null>>(`/admin/users/${userId}/quota`, {
    paymentAmount,
    inspirationAmount,
    amount: inspirationAmount / INSPIRATION_PER_USD,
  });
  return data;
}

async function updateAccountTier(userId: string, accountTier: "trial" | "paid") {
  const { data } = await apiClient.patch<ApiResponse<AdminUser>>(`/admin/users/${userId}`, { accountTier });
  return data;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [contactWechat, setContactWechat] = useState("");
  const [contactQQ, setContactQQ] = useState("");
  const [contactTips, setContactTips] = useState("");
  const [contactSaved, setContactSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: getAdminUsers,
    refetchInterval: 10000,
  });

  const updateCachedUser = (updatedUser: AdminUser | null | undefined) => {
    if (!updatedUser) return;
    queryClient.setQueryData<ApiResponse<AdminUser[]> | undefined>(["admin", "users"], (current) => {
      if (!current?.data) return current;
      return {
        ...current,
        data: current.data.map((user) => (user.id === updatedUser.id ? { ...user, ...updatedUser } : user)),
      };
    });
  };

  const addInspirationMutation = useMutation({
    mutationFn: ({ userId, paymentAmount }: { userId: string; paymentAmount: number }) =>
      addPaymentAmount(userId, paymentAmount),
    onSuccess: (res) => {
      toast.success(res.message ?? "灵感值已更新");
      updateCachedUser(res.data);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "quota"] });
      queryClient.refetchQueries({ queryKey: ["auth", "quota"], type: "active" });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "灵感值更新失败");
    },
  });

  const updateAccountTierMutation = useMutation({
    mutationFn: ({ userId, accountTier }: { userId: string; accountTier: "trial" | "paid" }) =>
      updateAccountTier(userId, accountTier),
    onSuccess: (res) => {
      toast.success(res.message ?? "账户状态已更新");
      updateCachedUser(res.data);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "quota"] });
      queryClient.refetchQueries({ queryKey: ["auth", "quota"], type: "active" });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "账户状态更新失败");
    },
  });

  const users = data?.data ?? [];

  useEffect(() => {
    apiClient.get("/admin/contact").then(({ data: d }) => {
      if (d.success && d.data) {
        setContactWechat(d.data.wechat || "");
        setContactQQ(d.data.qq || "");
        setContactTips(d.data.tips || "");
      }
    }).catch(() => {});
  }, []);

  const saveContact = async () => {
    try {
      await apiClient.put("/admin/contact", { wechat: contactWechat, qq: contactQQ, tips: contactTips });
      setContactSaved(true);
      toast.success("联系方式已更新");
      setTimeout(() => setContactSaved(false), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const handleAddPayment = (userId: string, paymentAmount: number) => {
    if (!Number.isFinite(paymentAmount) || paymentAmount === 0) return;
    addInspirationMutation.mutate({ userId, paymentAmount });
  };

  const handleCustomPayment = (userId: string) => {
    const paymentAmount = Number(paymentInputs[userId] || "0");
    if (!Number.isFinite(paymentAmount) || paymentAmount === 0) return;
    handleAddPayment(userId, paymentAmount);
    setPaymentInputs((prev) => ({ ...prev, [userId]: "" }));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-950">收款联系方式</CardTitle>
          <CardDescription className="text-blue-800">用户在个人中心看到的联系方式</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-0.5 block text-xs text-muted-foreground">微信号</label>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="例如：wxid_xxx"
                value={contactWechat}
                onChange={(event) => setContactWechat(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-muted-foreground">QQ号</label>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="例如：123456789"
                value={contactQQ}
                onChange={(event) => setContactQQ(event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-0.5 block text-xs text-muted-foreground">充值提示</label>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="付款后截图发送给管理员，秒到账"
                value={contactTips}
                onChange={(event) => setContactTips(event.target.value)}
              />
            </div>
          </div>
          <Button className="mt-3" onClick={saveContact} disabled={!contactWechat && !contactQQ}>
            {contactSaved ? "已保存" : "保存联系方式"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用户管理</CardTitle>
          <CardDescription>已注册 {users.length} 人，按收款金额自动发放灵感值。</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无用户</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">用户名</th>
                    <th className="py-2 pr-3">邮箱</th>
                    <th className="py-2 pr-3">角色</th>
                    <th className="py-2 pr-3">账户状态</th>
                    <th className="py-2 pr-3">剩余灵感值</th>
                    <th className="py-2 pr-3">已用灵感值</th>
                    <th className="py-2 pr-3">已发放</th>
                    <th className="py-2 pr-3">注册时间</th>
                    <th className="py-2">收款并发放</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const remainInspiration = quotaToInspiration(user.remainQuota);
                    const usedInspiration = quotaToInspiration(user.usedQuota);
                    const totalInspiration = quotaToInspiration(user.totalQuota ?? (user.remainQuota + user.usedQuota));

                    return (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{user.username}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{user.email}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={user.role === "admin" ? "default" : "outline"}>
                            {user.role === "admin" ? "管理员" : "用户"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            className="rounded border bg-background px-2 py-1 text-xs"
                            value={user.accountTier === "paid" ? "paid" : "trial"}
                            disabled={updateAccountTierMutation.isPending}
                            onChange={(event) =>
                              updateAccountTierMutation.mutate({
                                userId: user.id,
                                accountTier: event.target.value === "paid" ? "paid" : "trial",
                              })
                            }
                          >
                            <option value="trial">体验账户</option>
                            <option value="paid">创作账户</option>
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <span className={remainInspiration > 0 ? "font-semibold text-emerald-600" : "text-red-500"}>
                            {formatInspiration(remainInspiration)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatInspiration(usedInspiration)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatInspiration(totalInspiration)}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            {RECHARGE_PACKAGES.map((item) => (
                              <Button
                                key={item.yuan}
                                size="sm"
                                variant="outline"
                                disabled={addInspirationMutation.isPending}
                                title={`发放 ${formatInspiration(item.inspiration)} 灵感值`}
                                onClick={() => handleAddPayment(user.id, item.yuan)}
                              >
                                {formatYuan(item.yuan)}
                              </Button>
                            ))}
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="金额 ¥"
                              className="w-20 rounded border px-1 py-1 text-xs"
                              value={paymentInputs[user.id] || ""}
                              onChange={(event) =>
                                setPaymentInputs((prev) => ({ ...prev, [user.id]: event.target.value }))
                              }
                            />
                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                              {paymentInputs[user.id]
                                ? `${formatInspiration(paymentAmountToInspiration(Number(paymentInputs[user.id])))} 灵感值`
                                : "自定义按 1 元 = 5,000"}
                            </span>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={addInspirationMutation.isPending || !paymentInputs[user.id]}
                              onClick={() => handleCustomPayment(user.id)}
                            >
                              确定
                            </Button>
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
    </div>
  );
}
