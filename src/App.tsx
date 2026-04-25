import React from "react";
import { Toaster, toast } from "sonner";
import { Button, Spin } from "antd";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LocaleProvider } from "./context/LocaleContext";
import { DataProvider } from "./context/DataContext";
import { StoreProvider } from "./context/StoreContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PermissionsProvider, usePermissions } from "./context/PermissionsContext";
import { useAuthorizedRouteConfigs, useDynamicRoutes } from "./components/DynamicRoutes";
import Login from "./pages/Login";
import Activate from "./pages/Activate";
import NotFound from "./pages/NotFound";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.log("[ErrorBoundary] caught:", error);
    toast.error("Something went wrong, please refresh the page");
  }
  render() {
    return this.state.hasError ? (
      <div className="p-8 text-center text-muted-foreground">
        Something went wrong. Please refresh the page.
      </div>
    ) : (
      this.props.children
    );
  }
}

function AuthenticatedRoutes() {
  const { loading, error, refetch } = usePermissions();
  const authorizedRoutes = useAuthorizedRouteConfigs();
  const dynamicRoutes = useDynamicRoutes();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spin size="large" />
      </div>
    );
  }

  if (authorizedRoutes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-center">
        <div className="text-lg font-semibold text-foreground">
          {error ? "权限菜单加载失败" : "当前账号暂无可访问菜单"}
        </div>
        <div className="text-sm text-muted-foreground">
          {error?.message || "请联系管理员开通对应功能权限"}
        </div>
        {error && (
          <Button type="primary" onClick={refetch}>
            重试
          </Button>
        )}
      </div>
    );
  }

  return (
    <Routes>
      {dynamicRoutes}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AuthGate() {
  const { status } = useAuth();
  console.log("[AuthGate] status:", status);

  if (status === "unauthenticated") {
    return <Login />;
  }

  if (status === "needs_activation") {
    return <Activate />;
  }

  // authenticated
  return <AuthenticatedRoutes />;
}

const App = () => (
  <LocaleProvider>
    <AuthProvider>
      <PermissionsProvider>
        <DataProvider>
          <StoreProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <AuthGate />
              </ErrorBoundary>
            </BrowserRouter>
            <Toaster position="top-right" richColors />
          </StoreProvider>
        </DataProvider>
      </PermissionsProvider>
    </AuthProvider>
  </LocaleProvider>
);

export default App;
