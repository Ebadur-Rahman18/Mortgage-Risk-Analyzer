import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type AdminSidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
};

const AdminSidebarContext = createContext<AdminSidebarContextValue | null>(null);

const STORAGE_KEY = "admin-sidebar-collapsed";

export function AdminSidebarProvider({ children }: { children: ReactNode }) {
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
    <AdminSidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </AdminSidebarContext.Provider>
  );
}

export function useAdminSidebar() {
  const ctx = useContext(AdminSidebarContext);
  return ctx;
}
