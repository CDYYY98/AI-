import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LogEntry {
  time: string;
  user: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

export default function AdminLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "logs"],
    queryFn: async () => {
      const { data: d } = await apiClient.get<{ success: boolean; data: LogEntry[] }>("/admin/logs");
      return d;
    },
    refetchInterval: 10000,
  });

  const logs = data?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>API 调用日志</CardTitle>
          <CardDescription>最近 {logs.length} 条记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">时间</th>
                  <th className="py-2 pr-3">用户</th>
                  <th className="py-2 pr-3">模型</th>
                  <th className="py-2 pr-3">输入Token</th>
                  <th className="py-2 pr-3">输出Token</th>
                  <th className="py-2 pr-3">总Token</th>
                  <th className="py-2">花费</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-xs">{l.time}</td>
                    <td className="py-2 pr-3">{l.user}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs font-mono bg-muted px-1 rounded">{l.model}</span>
                    </td>
                    <td className="py-2 pr-3">{l.inputTokens.toLocaleString()}</td>
                    <td className="py-2 pr-3">{l.outputTokens.toLocaleString()}</td>
                    <td className="py-2 pr-3 font-medium">{l.totalTokens.toLocaleString()}</td>
                    <td className="py-2 text-red-500">-${l.cost.toFixed(4)}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">暂无调用记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
