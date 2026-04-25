import React, { createContext, useContext, useState, useEffect } from "react";
import { useData } from "./DataContext";

interface StoreContextType {
  selectedStoreId: string;
  setSelectedStoreId: (id: string) => void;
}

const StoreContext = createContext<StoreContextType>({
  selectedStoreId: "all",
  setSelectedStoreId: () => {},
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { stores, reloadForStore } = useData();
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");

  // When stores change and the selected store no longer exists, reset to "all"
  useEffect(() => {
    if (selectedStoreId !== "all") {
      const exists = stores.find((s) => s.id === selectedStoreId);
      if (!exists) {
        console.log("[StoreContext] selected store no longer exists, resetting to all");
        queueMicrotask(() => setSelectedStoreId("all"));
      }
    }
  }, [stores, selectedStoreId]);

  useEffect(() => {
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
