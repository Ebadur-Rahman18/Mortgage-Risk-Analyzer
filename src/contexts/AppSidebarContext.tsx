import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type AppSidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
};

const AppSidebarContext = createContext<AppSidebarContextValue | null>(null);

const STORAGE_KEY = "app-sidebar-collapsed";

export function AppSidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {}
  }, []);

  return (
    <AppSidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </AppSidebarContext.Provider>
  );
}

export function useAppSidebar() {
  const ctx = useContext(AppSidebarContext);
  return ctx;
}
