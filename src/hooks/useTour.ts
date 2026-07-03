import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TourControls {
  isOpen: boolean;
  startTour: () => void;
  completeTour: () => void;
  skipTour: () => void;
}

/**
 * Manages tour state for a given user.
 * Persistence: `profiles.tour_completed_at` in Supabase.
 * Fail-closed: if the SELECT errors, treat as completed (do not nag).
 */
export function useTour(userId: string | undefined): TourControls {
  const [isOpen, setIsOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(true);
  const [isCompletedLoaded, setIsCompletedLoaded] = useState(false);
  const autoStarted = useRef(false);

  // Load completion state from DB on mount / userId change
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setIsCompleted(true);
      setIsCompletedLoaded(true);
      return;
    }
    setIsCompletedLoaded(false);
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("tour_completed_at")
        .eq("id", userId)
        .single();
      if (cancelled) return;
      if (error) {
        setIsCompleted(true); // fail-closed
      } else {
        setIsCompleted(!!(data as { tour_completed_at?: string | null })?.tour_completed_at);
      }
      setIsCompletedLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markCompleted = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("profiles")
      .update({ tour_completed_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setIsCompleted(true);
  }, [userId]);

  // Auto-open once for users who have not seen the tour
  useEffect(() => {
    if (!userId) return;
    if (!isCompletedLoaded) return;
    if (isCompleted) return;
    if (autoStarted.current) return;

    autoStarted.current = true;
    const timer = setTimeout(() => setIsOpen(true), 800);
    return () => clearTimeout(timer);
  }, [userId, isCompletedLoaded, isCompleted]);

  const startTour = useCallback(() => setIsOpen(true), []);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    void markCompleted();
  }, [markCompleted]);

  const skipTour = useCallback(() => {
    setIsOpen(false);
    void markCompleted();
  }, [markCompleted]);

  return { isOpen, startTour, completeTour, skipTour };
}
