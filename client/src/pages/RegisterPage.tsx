import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/layout/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
      await register(username, email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">创建账号</CardTitle>
          <CardDescription>注册后即可使用 AI 小说创作工作台</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="username">
                用户名
              </label>
              <input
                id="username"
                type="text"
                required
                minLength={2}
                maxLength={30}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="请输入用户名"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="email">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="请输入邮箱"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="password">
                密码
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="请输入密码（至少6位）"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="confirmPassword">
                确认密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="请再次输入密码"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "注册中..." : "注册"}
            </Button>
            <p className="text-center text-sm text-gray-500">
              已有账号？{" "}
              <Link to="/login" className="text-blue-600 hover:underline">
                立即登录
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
