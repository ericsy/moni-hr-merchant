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
import { useDynamicRoutes } from "./components/DynamicRoutes";
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
  const dynamicRoutes = useDynamicRoutes();
  const isDefaultPage = location.pathname === "/" || location.pathname === "/home";
  const isAuthPage = location.pathname === "/login" || location.pathname === "/activate";
  const shouldWaitForPermissions = loading && !isDefaultPage && !isAuthPage;

  if (shouldWaitForPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spin size="large" />
      </div>
    );
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
              <Toaster position="top-right" richColors />
            </StoreProvider>
          </DataProvider>
        </PermissionsProvider>
      </AuthProvider>
    </AntdLocaleProvider>
  </LocaleProvider>
);

export default App;
