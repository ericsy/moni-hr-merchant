import React from "react";
import { Toaster, toast } from "sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LocaleProvider } from "./context/LocaleContext";
import { DataProvider } from "./context/DataContext";
import { StoreProvider } from "./context/StoreContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Index from "./pages/Index";
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
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <LocaleProvider>
    <AuthProvider>
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
    </AuthProvider>
  </LocaleProvider>
);

export default App;
