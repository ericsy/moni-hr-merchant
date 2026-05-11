import React from "react";
import { Toaster, toast } from "sonner";
import { ConfigProvider, Spin } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LocaleProvider, useLocale } from "./context/LocaleContext";
import { DataProvider } from "./context/DataContext";
import { StoreProvider } from "./context/StoreContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PermissionsProvider, usePermissions } from "./context/PermissionsContext";
import { useData } from "./context/DataContext";
import { useDynamicRoutes } from "./components/DynamicRoutes";
import { getPagePath, getRouteConfigByPageKey } from "./config/routes";
import AppLayout from "./components/Layout";
import { APP_BASE_PATH } from "./config/appBase";
import Home from "./pages/Home";
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
  const location = useLocation();
  const { loading } = usePermissions();
  const { loading: dataLoading, stores, storesLoaded } = useData();
  const dynamicRoutes = useDynamicRoutes();
  const normalizedPathname = normalizeAppPathname(location.pathname);
  const isDefaultPage = normalizedPathname === "/" || normalizedPathname === "/home";
  const isAuthPage = normalizedPathname === "/login" || normalizedPathname === "/activate";
  const shouldWaitForPermissions = loading && !isDefaultPage && !isAuthPage;
  const requiresFirstStore = storesLoaded && !dataLoading && stores.length === 0;
  const storesPath = getPagePath("stores") || "/stores";
  const storeRouteConfig = getRouteConfigByPageKey("stores");
  const StoreComponent = storeRouteConfig?.component;
  const storeRoutePath = storeRouteConfig?.path || "/stores";

  if (shouldWaitForPermissions && !requiresFirstStore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spin size="large" />
      </div>
    );
  }

  if (requiresFirstStore && normalizedPathname !== storesPath) {
    return <Navigate to={storesPath} replace />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout currentPage="home">
            <Home />
          </AppLayout>
        }
      />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/activate" element={<Navigate to="/" replace />} />
      {dynamicRoutes}
      {StoreComponent && (
        <Route
          path={storeRoutePath}
          element={
            <AppLayout currentPage="stores">
              <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载中...</div>}>
                <StoreComponent />
              </React.Suspense>
            </AppLayout>
          }
        />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function normalizeAppPathname(pathname: string) {
  const basePath = String(APP_BASE_PATH);
  if (basePath === "/" || !pathname.startsWith(basePath)) return pathname;
  const nextPathname = pathname.slice(basePath.length) || "/";
  return nextPathname.startsWith("/") ? nextPathname : `/${nextPathname}`;
}

function AuthGate() {
  const { status } = useAuth();
  const location = useLocation();
  const normalizedPathname = normalizeAppPathname(location.pathname);
  console.log("[AuthGate] status:", status);

  if (normalizedPathname === "/activate") {
    return <Activate />;
  }

  if (status === "unauthenticated") {
    return <Login />;
  }

  if (status === "needs_activation") {
    return <Activate />;
  }

  // authenticated
  return <AuthenticatedRoutes />;
}

function AntdLocaleProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();

  React.useEffect(() => {
    dayjs.locale(locale === "zh" ? "zh-cn" : "en");
  }, [locale]);

  return (
    <ConfigProvider locale={locale === "zh" ? zhCN : enUS}>
      {children}
    </ConfigProvider>
  );
}

const App = () => (
  <LocaleProvider>
    <AntdLocaleProvider>
      <AuthProvider>
        <PermissionsProvider>
          <DataProvider>
            <StoreProvider>
              <BrowserRouter basename={APP_BASE_PATH}>
                <ErrorBoundary>
                  <AuthGate />
                </ErrorBoundary>
              </BrowserRouter>
              <Toaster position="top-center" className="app-toast-center" richColors />
            </StoreProvider>
          </DataProvider>
        </PermissionsProvider>
      </AuthProvider>
    </AntdLocaleProvider>
  </LocaleProvider>
);

export default App;
