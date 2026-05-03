import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useData } from "./DataContext";
import { setCurrentStoreId } from "../lib/apiClient";
import { merchantApi } from "../lib/merchantApi";

interface StoreContextType {
  selectedStoreId: string;
  setSelectedStoreId: (id: string) => void;
}

const StoreContext = createContext<StoreContextType>({
  selectedStoreId: "",
  setSelectedStoreId: () => {},
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { stores, lastStoreId, reloadForStore } = useData();
  const [selectedStoreId, setSelectedStoreIdState] = useState<string>("");
  const previousStoreIdRef = useRef(selectedStoreId);
  const initializedRef = useRef(false);

  const fallbackStoreId = stores.find((store) => store.status === "enabled")?.id || stores[0]?.id || "";

  const setSelectedStoreId = (id: string) => {
    if (!id || id === "all") return;
    previousStoreIdRef.current = selectedStoreId;
    setSelectedStoreIdState(id);
  };

  useEffect(() => {
    setCurrentStoreId(selectedStoreId);
  }, [selectedStoreId]);

  useEffect(() => {
    if (stores.length === 0) {
      initializedRef.current = false;
      if (selectedStoreId) setSelectedStoreIdState("");
      return;
    }

    const storeIds = new Set(stores.map((store) => store.id));
    const nextStoreId = storeIds.has(lastStoreId)
      ? lastStoreId
      : storeIds.has(selectedStoreId)
      ? selectedStoreId
      : fallbackStoreId;

    if (!initializedRef.current || !storeIds.has(selectedStoreId)) {
      initializedRef.current = true;
      if (nextStoreId && selectedStoreId !== nextStoreId) {
        previousStoreIdRef.current = nextStoreId;
        setSelectedStoreIdState(nextStoreId);
      }
    }
  }, [fallbackStoreId, lastStoreId, selectedStoreId, stores]);

  useEffect(() => {
    if (!selectedStoreId || previousStoreIdRef.current === selectedStoreId) {
      return;
    }

    previousStoreIdRef.current = selectedStoreId;
    merchantApi.updateLastStore(selectedStoreId).catch((error) => {
      console.log("[StoreContext] failed to update last store:", error);
    });
    reloadForStore(selectedStoreId).catch((error) => {
      console.log("[StoreContext] failed to reload store context:", error);
    });
  }, [reloadForStore, selectedStoreId]);

  console.log("[StoreContext] selectedStoreId:", selectedStoreId);

  return (
    <StoreContext.Provider value={{ selectedStoreId, setSelectedStoreId }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
