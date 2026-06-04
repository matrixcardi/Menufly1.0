import { createContext, useContext, useState, ReactNode } from "react";

interface PDVKioskContextType {
  isKioskMode: boolean;
  setKioskMode: (mode: boolean) => void;
}

const PDVKioskContext = createContext<PDVKioskContextType | undefined>(undefined);

export function PDVKioskProvider({ children }: { children: ReactNode }) {
  const [isKioskMode, setIsKioskMode] = useState(false);

  const setKioskMode = (mode: boolean) => {
    setIsKioskMode(mode);
    if (mode) {
      document.documentElement.requestFullscreen?.();
      document.body.classList.add("pdv-kiosk-mode");
    } else {
      document.exitFullscreen?.();
      document.body.classList.remove("pdv-kiosk-mode");
    }
  };

  return (
    <PDVKioskContext.Provider value={{ isKioskMode, setKioskMode }}>
      {children}
    </PDVKioskContext.Provider>
  );
}

export function usePDVKiosk() {
  const context = useContext(PDVKioskContext);
  if (context === undefined) {
    throw new Error("usePDVKiosk must be used within a PDVKioskProvider");
  }
  return context;
}
