import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  APP_RUNTIME,
  APP_RUNTIME_IS_PACKAGED,
  APP_RUNTIME_IS_PORTABLE,
  APP_UPDATE_CHANNEL,
  APP_VERSION,
} from "@/lib/constants";
import { checkForDesktopUpdates, quitAndInstallDesktopUpdate, useDesktopUpdater } from "@/lib/desktop";

function formatUpdaterStatus(status: string): string {
  switch (status) {
    case "disabled":
      return "不可用";
    case "idle":
      return "待检查";
    case "checking":
      return "检查中";
    case "update-available":
      return "发现新版本";
    case "downloading":
      return "下载中";
    case "downloaded":
      return "可重启安装";
    case "not-available":
      return "已是最新版";
    case "error":
      return "检查失败";
    default:
      return status;
  }
}

export default function DesktopUpdateCard() {
  const updater = useDesktopUpdater();
  const [isBusy, setIsBusy] = useState(false);

  if (APP_RUNTIME !== "desktop") {
    return null;
  }

  const installModeLabel = APP_RUNTIME_IS_PORTABLE ? "便携版" : "安装版";
  const showDownloadButton = updater.status === "update-available";
  const showInstallButton = updater.status === "downloaded";
  const showCheckButton = updater.status !== "downloading" && !showInstallButton;

  return (
    <Card className="border-slate-300/80 bg-slate-50/80">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>桌面版本更新</CardTitle>
          <Badge variant="outline">{installModeLabel}</Badge>
          <Badge variant="outline">更新通道 {APP_UPDATE_CHANNEL}</Badge>
        </div>
        <CardDescription>
          安装版可以检查并下载新版本，下载完成后重启应用即可安装。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border bg-background p-3">
            <div className="text-xs text-muted-foreground">当前版本</div>
            <div className="mt-1 font-medium">{APP_VERSION}</div>
          </div>
          <div className="rounded-md border bg-background p-3">
            <div className="text-xs text-muted-foreground">更新状态</div>
            <div className="mt-1 font-medium">{formatUpdaterStatus(updater.status)}</div>
          </div>
          <div className="rounded-md border bg-background p-3">
            <div className="text-xs text-muted-foreground">可用版本</div>
            <div className="mt-1 font-medium">{updater.availableVersion ?? "-"}</div>
          </div>
        </div>

        <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
          {APP_RUNTIME_IS_PORTABLE
            ? "便携版需要下载新版安装包后手动替换。"
            : !APP_RUNTIME_IS_PACKAGED
              ? "开发运行用于检查界面，打包安装版会连接更新通道。"
              : updater.message}
          {typeof updater.progressPercent === "number" ? ` 下载进度 ${Math.round(updater.progressPercent)}%。` : ""}
        </div>

        <div className="flex flex-wrap gap-3">
          {showCheckButton ? (
            <Button
              onClick={async () => {
                setIsBusy(true);
                try {
                  await checkForDesktopUpdates();
                } finally {
                  setIsBusy(false);
                }
              }}
              disabled={isBusy || updater.status === "checking" || !updater.isSupported}
            >
              {showDownloadButton
                ? "下载更新"
                : updater.status === "checking"
                  ? "检查中..."
                  : "检查更新"}
            </Button>
          ) : null}
          {showInstallButton ? (
            <Button
              onClick={async () => {
                setIsBusy(true);
                try {
                  await quitAndInstallDesktopUpdate();
                } finally {
                  setIsBusy(false);
                }
              }}
              disabled={isBusy || !updater.canInstall}
            >
              重启安装
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
