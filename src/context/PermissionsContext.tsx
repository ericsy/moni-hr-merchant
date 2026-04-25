import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { collectMerchantEndpointOverrides, configureMerchantEndpoints, resetMerchantEndpoints } from "../config/merchantEndpoints";
import { getStoredAccessToken } from "../lib/apiClient";
import { merchantApi, type MerchantFeatureTreeNode } from "../lib/merchantApi";
import { useAuth } from "./AuthContext";

interface PermissionsContextType {
  permissions: MerchantFeatureTreeNode[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [permissions, setPermissions] = useState<MerchantFeatureTreeNode[]>([]);
  const [loading, setLoading] = useState(status === "authenticated");
  const [loadedToken, setLoadedToken] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const fetchPermissions = useCallback(async () => {
    const token = getStoredAccessToken();

    if (status !== "authenticated" || !token) {
      resetMerchantEndpoints();
      setPermissions([]);
      setError(null);
      setLoadedToken("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await merchantApi.permissionsTree();
      const nextPermissions = Array.isArray(data) ? data : [];
      configureMerchantEndpoints(collectMerchantEndpointOverrides(nextPermissions));
      setPermissions(nextPermissions);
      setLoadedToken(token);
    } catch (err) {
      resetMerchantEndpoints();
      setError(err instanceof Error ? err : new Error("Failed to fetch permissions"));
      setPermissions([]);
      setLoadedToken(token);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    Promise.resolve().then(fetchPermissions);
  }, [fetchPermissions]);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading: status === "authenticated" && Boolean(getStoredAccessToken()) && (loading || loadedToken !== getStoredAccessToken()),
        error,
        refetch: fetchPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
