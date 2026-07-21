import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isStoreManagerLikePrincipal } from "../lib/merchantApi";
import { useData } from "./DataContext";

export type UiMode = "simple" | "standard";

interface UiModeContextType {
  uiMode: UiMode;
  setUiMode: (mode: UiMode) => void;
  canUseSimpleUi: boolean;
  isSimpleUi: boolean;
}

const UiModeContext = createContext<UiModeContextType>({
  uiMode: "standard",
  setUiMode: () => {},
  canUseSimpleUi: false,
  isSimpleUi: false,
});

const UI_MODE_STORAGE_PREFIX = "moni_hr_ui_mode";

function storageKey(adminId?: string | number | null) {
  const id = adminId === undefined || adminId === null ? "" : String(adminId).trim();
  return id ? `${UI_MODE_STORAGE_PREFIX}:${id}` : UI_MODE_STORAGE_PREFIX;
}

function readStoredUiMode(adminId?: string | number | null): UiMode | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(storageKey(adminId));
  return stored === "simple" || stored === "standard" ? stored : null;
}

function writeStoredUiMode(mode: UiMode, adminId?: string | number | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(adminId), mode);
}

export function UiModeProvider({ children }: { children: React.ReactNode }) {
  const { merchantPrincipal } = useData();
  const canUseSimpleUi = useMemo(
    () => isStoreManagerLikePrincipal(merchantPrincipal),
    [merchantPrincipal],
  );
  const adminId = merchantPrincipal?.merchantAdminId;

  const [uiMode, setUiModeState] = useState<UiMode>(() => {
    const stored = readStoredUiMode(adminId);
    if (stored) return stored;
    return "simple";
  });

  useEffect(() => {
    if (!canUseSimpleUi) {
      setUiModeState("standard");
      return;
    }
    const stored = readStoredUiMode(adminId);
    setUiModeState(stored ?? "simple");
  }, [adminId, canUseSimpleUi]);

  const setUiMode = useCallback(
    (mode: UiMode) => {
      if (!canUseSimpleUi) return;
      writeStoredUiMode(mode, adminId);
      setUiModeState(mode);
    },
    [adminId, canUseSimpleUi],
  );

  const value = useMemo(
    () => ({
      uiMode: canUseSimpleUi ? uiMode : "standard",
      setUiMode,
      canUseSimpleUi,
      isSimpleUi: canUseSimpleUi && uiMode === "simple",
    }),
    [canUseSimpleUi, setUiMode, uiMode],
  );

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>;
}

export function useUiMode() {
  return useContext(UiModeContext);
}
