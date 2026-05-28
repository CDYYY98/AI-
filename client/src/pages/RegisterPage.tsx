import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import { useAuth } from "@/components/layout/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RegisterResponse {
  message: string;
  debugCode?: string;
}

export default function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setDebugCode("");

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }
    if (password.length < 6) {
      setError("密码长度不能少于 6 位。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post<{ success: boolean; data?: RegisterResponse; error?: string }>(
        "/auth/register",
        { username, email, password },
      );
      if (!response.data.success) {
        setError(response.data.error || "发送验证码失败。");
        return;
      }
      setDebugCode(response.data.data?.debugCode ?? "");
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "发送验证码失败。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await apiClient.post("/auth/verify-email", { email, code });
      if (data.success) {
        localStorage.setItem("ai_novel_token", data.data.token);
        navigate("/", { replace: true });
      } else {
        setError(data.error || "验证失败。");
      }
    } catch (err: any) {
      setError(err.message || "验证失败。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">创建账号</CardTitle>
          <CardDescription>
            {step === "form" ? "填写信息后发送验证码" : "请输入邮箱收到的验证码"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "form" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="username">用户名</label>
                <input
                  id="username"
                  type="text"
                  required
                  minLength={2}
                  maxLength={30}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="请输入用户名"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="email">邮箱</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="请输入邮箱"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="password">密码</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="至少 6 位"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="confirmPassword">确认密码</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="请再次输入密码"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "发送中..." : "发送验证码"}
              </Button>
              <p className="text-center text-sm text-gray-500">
                已有账号？<Link to="/login" className="text-blue-600 hover:underline">立即登录</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}
              <p className="text-sm text-muted-foreground">
                验证码已发送至 <strong>{email}</strong>
              </p>
              {debugCode && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  当前环境未配置邮箱服务，请使用验证码 <strong className="tracking-[0.25em]">{debugCode}</strong> 完成测试。
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="code">验证码</label>
                <input
                  id="code"
                  type="text"
                  required
                  maxLength={6}
                  minLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-md border px-3 py-2 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="000000"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || code.length < 6}>
                {submitting ? "验证中..." : "验证并注册"}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-blue-600 hover:underline"
                onClick={() => {
                  setStep("form");
                  setError("");
                  setCode("");
                  setDebugCode("");
                }}
              >
                返回修改信息
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
