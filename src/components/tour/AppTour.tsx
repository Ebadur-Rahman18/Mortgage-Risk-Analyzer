import Joyride, { CallBackProps, STATUS } from "react-joyride";
import type { TourControls } from "@/hooks/useTour";
import { getTourSteps, type TourVariant } from "./tourSteps";

interface AppTourProps {
  tour: TourControls;
  variant: TourVariant;
}

/**
 * Thin wrapper around react-joyride.
 * Mounts only when the tour is open to avoid unnecessary DOM work.
 * Calls completeTour / skipTour when the user finishes or skips.
 */
export function AppTour({ tour, variant }: AppTourProps) {
  if (!tour.isOpen) return null;

  const handleEvent = ({ status }: CallBackProps) => {
    if (status === STATUS.FINISHED) {
      tour.completeTour();
    } else if (status === STATUS.SKIPPED) {
      tour.skipTour();
    }
  };

  return (
    <Joyride
      steps={getTourSteps(variant)}
      run={tour.isOpen}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      callback={handleEvent}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: "0.75rem",
          fontSize: "0.875rem",
        },
        tooltipTitle: {
          fontSize: "1rem",
          fontWeight: 600,
        },
        buttonNext: {
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
        },
        buttonBack: {
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
        },
        buttonSkip: {
          borderRadius: "0.5rem",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  );
}
