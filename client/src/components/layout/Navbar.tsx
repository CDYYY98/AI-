import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/components/layout/AuthContext";
import DesktopBrandMark from "@/components/layout/DesktopBrandMark";
import { Button } from "@/components/ui/button";
import {
  AUTO_DIRECTOR_MOBILE_CLASSES,
  shouldUseAutoDirectorMobileFullWidthContent,
} from "@/mobile/autoDirector";

interface NavbarProps {
  workspaceNavMode?: "workspace" | "project";
  onWorkspaceNavModeChange?: (mode: "workspace" | "project") => void;
}

function AuthButtons() {
  const { user, logout } = useAuth();

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.role === "admin" && (
          <>
            <Link to="/admin/users" className="hidden text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors sm:inline">
              用户管理
            </Link>
            <Link to="/admin/models" className="hidden text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors sm:inline">
              模型管理
            </Link>
            <Link to="/admin/logs" className="hidden text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors sm:inline">
              调用日志
            </Link>
          </>
        )}
        <Link to="/profile" className="hidden text-xs text-muted-foreground hover:text-foreground transition-colors sm:inline">
          个人中心
        </Link>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {user.username}
        </span>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={logout}
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" asChild>
        <Link to="/login">登录</Link>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link to="/register">注册</Link>
      </Button>
    </div>
  );
}

export default function Navbar(props: NavbarProps) {
  const { workspaceNavMode, onWorkspaceNavModeChange } = props;
  const location = useLocation();
  const isHome = location.pathname === "/";
  const showWorkspaceToggle = Boolean(workspaceNavMode && onWorkspaceNavModeChange);
  const useMobileAutoDirectorShell = shouldUseAutoDirectorMobileFullWidthContent(location.pathname);

  return (
    <header className="flex h-16 min-w-0 items-center justify-between gap-3 border-b bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <DesktopBrandMark className="h-8 w-8 shrink-0 drop-shadow-none" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">图灵网文工作台</span>
          <span className="hidden truncate text-[11px] text-muted-foreground sm:block">Turing Web Novel Workbench</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {!isHome && showWorkspaceToggle ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={useMobileAutoDirectorShell ? AUTO_DIRECTOR_MOBILE_CLASSES.navbarWorkspaceToggle : undefined}
            onClick={() => onWorkspaceNavModeChange?.(workspaceNavMode === "workspace" ? "project" : "workspace")}
          >
            {workspaceNavMode === "workspace" ? "项目导航" : "创作导航"}
          </Button>
        ) : null}
        <AuthButtons />
      </div>
    </header>
  );
}
