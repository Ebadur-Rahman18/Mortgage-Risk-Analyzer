import React, { createContext, useContext } from "react";
import type { TourControls } from "@/hooks/useTour";

const TourContext = createContext<TourControls | null>(null);

export function TourProvider({
  value,
  children,
}: {
  value: TourControls;
  children: React.ReactNode;
}) {
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

/**
 * Returns tour controls from the nearest TourProvider.
 * Returns a no-op object when used outside a provider so consumers
 * never crash in admin/public contexts where the tour is not wired.
 */
export function useTourContext(): TourControls {
  const ctx = useContext(TourContext);
  if (!ctx) {
    return {
      isOpen: false,
      startTour: () => {},
      completeTour: () => {},
      skipTour: () => {},
    };
  }
  return ctx;
}
